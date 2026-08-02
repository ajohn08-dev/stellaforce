"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { getCurrentProfile } from "@/lib/auth"
import { resolveWorkflowSettings } from "@/lib/workflow-settings"
import { getJobCompetencies, getJobScorecard } from "@/lib/data"
import { serverEnv } from "@/lib/env"
import { applyAiScorecard, parseAiScorecardResponse } from "@/lib/server/job-ai-scorecard"
import type { Competency } from "@/components/jobs/draft/steps/competency-data"
import type { ScoreCardCategory } from "@/components/jobs/draft/steps/score-card-step"
import { applyAiRoleOutput, parseAiRoleResponse } from "@/lib/server/job-ai-role"
import {
  applyAiCompetencies,
  parseAiCompetenciesResponse,
} from "@/lib/server/job-ai-competencies"
import { sendCalendarConnectInvite } from "@/lib/server/calendar-invite"
import type {
  ActivityEventType,
  ActorType,
  EmploymentType,
  EventSeverity,
  Json,
  TablesUpdate,
} from "@/lib/supabase/types"

/**
 * Server Actions for jobs: draft creation, publish (which snapshots the chosen
 * workflow template + resolved settings onto the job, freezing it), and the
 * candidate-movement runtime. Every candidate added to a job becomes an
 * `applications` row — that is the only candidate↔job link. All state changes
 * emit `activity_events` in the same request for the compliance/analytics
 * timeline + transactional outbox.
 */

export type ActionResult<T = unknown> =
  | ({ ok: true } & T)
  | { ok: false; error: string }

type SupabaseServer = Awaited<ReturnType<typeof createClient>>

type ActivityInput = {
  event_type: ActivityEventType
  client_id?: string | null
  candidate_id?: string | null
  job_id?: string | null
  application_id?: string | null
  sub_stage_id?: string | null
  actor_type?: ActorType
  actor_profile_id?: string | null
  severity?: EventSeverity
  payload?: Json
  idempotency_key?: string | null
}

/** Append an activity event. When an idempotency_key is given, a redelivery is a no-op. */
async function logActivity(supabase: SupabaseServer, e: ActivityInput) {
  const row = {
    event_type: e.event_type,
    client_id: e.client_id ?? null,
    candidate_id: e.candidate_id ?? null,
    job_id: e.job_id ?? null,
    application_id: e.application_id ?? null,
    sub_stage_id: e.sub_stage_id ?? null,
    actor_type: e.actor_type ?? "user",
    actor_profile_id: e.actor_profile_id ?? null,
    severity: e.severity ?? "info",
    payload: e.payload ?? {},
    idempotency_key: e.idempotency_key ?? null,
  }
  if (row.idempotency_key) {
    await supabase
      .from("activity_events")
      .upsert(row, { onConflict: "idempotency_key", ignoreDuplicates: true })
  } else {
    await supabase.from("activity_events").insert(row)
  }
}

// ── Draft creation ───────────────────────────────────────────────────────────

export type CreateJobDraftInput = {
  title: string
  client_id: string
  workflow_template_id?: string | null
  location?: string | null
  description?: string | null
  notes?: string | null
}

/**
 * Send the raw Add-Job inputs to the n8n "generate-role" webhook, then CONSUME
 * its response (the LLM's structured role + target_companies) and persist it
 * onto the draft — so the wizard opens pre-filled with no callback node needed.
 * Best-effort: any failure (n8n down, timeout, bad shape) leaves the draft
 * created but un-prefilled rather than erroring. n8n holds the connection until
 * the LLM finishes, so allow a generous timeout.
 */
async function requestAndApplyAiRole(
  supabase: SupabaseServer,
  payload: {
    job_id: string
    title: string
    client_id: string
    location: string | null
    description: string | null
    notes: string | null
  }
) {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 55_000)
    const res = await fetch(serverEnv.n8nJobWebhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serverEnv.n8nWebhookSecret}`,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout))

    if (!res.ok) {
      console.error(`[job-intake] n8n webhook responded ${res.status}`)
      return
    }

    const raw = await res.json().catch(() => null)
    const out = parseAiRoleResponse(raw)
    if (!out) {
      console.error("[job-intake] n8n response did not match the expected role shape")
      return
    }
    await applyAiRoleOutput(supabase, payload.job_id, out)
  } catch (err) {
    console.error("[job-intake] n8n intake/apply failed", err)
  }
}

/**
 * Second cascade step: pass the job's persisted role definition to the n8n
 * "generate-competencies" webhook, consume the response, and replace the job's
 * competencies (Evaluation Criteria). Best-effort. Reads the role from the DB
 * so it works both chained after role-generation and as a standalone regenerate.
 */
async function requestAndApplyAiCompetencies(supabase: SupabaseServer, jobId: string) {
  try {
    const { data: job } = await supabase
      .from("job_orders")
      .select(
        "job_id, title, description, workplace_type, company, industry, job_function, employment_type, experience_required, education_required, salary_from, salary_to, salary_currency"
      )
      .eq("job_id", jobId)
      .single()
    if (!job) return

    const { data: tc } = await supabase
      .from("job_target_companies")
      .select("name")
      .eq("job_id", jobId)

    const payload = {
      job_id: jobId,
      title: job.title,
      description: job.description,
      role: {
        workplace_type: job.workplace_type,
        company: job.company,
        industry: job.industry,
        job_function: job.job_function,
        employment_type: job.employment_type,
        experience_required: job.experience_required,
        education_required: job.education_required,
        salary_from: job.salary_from,
        salary_to: job.salary_to,
        salary_currency: job.salary_currency,
      },
      target_companies: (tc ?? []).map((t) => t.name),
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 55_000)
    const res = await fetch(serverEnv.n8nCompetenciesWebhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serverEnv.n8nWebhookSecret}`,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout))

    if (!res.ok) {
      console.error(`[competencies] n8n webhook responded ${res.status}`)
      return
    }
    const raw = await res.json().catch(() => null)
    const out = parseAiCompetenciesResponse(raw)
    if (!out) {
      console.error("[competencies] n8n response did not match the expected shape")
      return
    }
    await applyAiCompetencies(supabase, jobId, out)
  } catch (err) {
    console.error("[competencies] n8n request/apply failed", err)
  }
}

/**
 * Third cascade step: pass the job's competencies to the n8n
 * "generate-scorecard" webhook, consume the response, and replace the job's
 * scorecard (weighted categories linking competencies). Best-effort.
 */
async function requestAndApplyAiScorecard(supabase: SupabaseServer, jobId: string) {
  try {
    const { data: job } = await supabase
      .from("job_orders")
      .select("title")
      .eq("job_id", jobId)
      .single()
    const { data: comps } = await supabase
      .from("job_competencies")
      .select("id, type, description, recommended_level, skills")
      .eq("job_id", jobId)
    if (!comps || comps.length === 0) return

    const payload = {
      job_id: jobId,
      title: job?.title ?? "",
      competencies: comps.map((c) => ({
        id: c.id,
        type: c.type,
        description: c.description,
        recommended_level: c.recommended_level,
        skills: c.skills,
      })),
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 55_000)
    const res = await fetch(serverEnv.n8nScorecardWebhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serverEnv.n8nWebhookSecret}`,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout))

    if (!res.ok) {
      console.error(`[scorecard] n8n webhook responded ${res.status}`)
      return
    }
    const raw = await res.json().catch(() => null)
    const out = parseAiScorecardResponse(raw)
    if (!out) {
      console.error("[scorecard] n8n response did not match the expected shape")
      return
    }
    await applyAiScorecard(supabase, jobId, out)
  } catch (err) {
    console.error("[scorecard] n8n request/apply failed", err)
  }
}

/**
 * Called from the wizard's "Next" on the Evaluation Criteria step: generate the
 * Scorecard from the job's competencies — but only if the job has none yet (or
 * an explicit regenerate), so edits/existing categories aren't clobbered.
 * Returns the fresh scorecard so the client can update immediately.
 */
export async function generateScorecard(
  jobId: string,
  opts: { regenerate?: boolean } = {}
): Promise<ActionResult<{ scorecard: ScoreCardCategory[] }>> {
  const profile = await getCurrentProfile()
  if (!profile) return { ok: false, error: "Not signed in." }
  const supabase = await createClient()

  const { count } = await supabase
    .from("job_scorecard_categories")
    .select("id", { count: "exact", head: true })
    .eq("job_id", jobId)
  if (opts.regenerate || (count ?? 0) === 0) {
    await requestAndApplyAiScorecard(supabase, jobId)
  }

  const scorecard = await getJobScorecard(jobId)
  revalidatePath(`/jobs/${jobId}`)
  return { ok: true, scorecard }
}

/** Standalone trigger for regenerating a job's Evaluation Criteria from its role. */
export async function generateEvaluationCriteria(jobId: string): Promise<ActionResult> {
  const profile = await getCurrentProfile()
  if (!profile) return { ok: false, error: "Not signed in." }
  const supabase = await createClient()
  await requestAndApplyAiCompetencies(supabase, jobId)
  revalidatePath(`/jobs/${jobId}`)
  return { ok: true }
}

const EMPLOYMENT_TYPES = ["full-time", "part-time", "contract", "freelance", "internship"] as const

export type RoleFormInput = {
  title?: string
  workplace_type?: "on-site" | "hybrid" | "remote" | null
  office_location?: string | null
  description?: string | null
  industry?: string | null
  job_function?: string | null
  employment_type?: string | null
  experience_required?: string | null
  education_required?: string | null
  salary_from?: number | null
  salary_to?: number | null
  salary_currency?: string | null
  target_companies?: { name: string; source: string }[]
}

/**
 * Called from the wizard's "Next" on the Role Definition step: persist the
 * recruiter's current (possibly-edited) role values + target companies, then
 * generate the Evaluation Criteria from them. `company` is left untouched (it's
 * resolved from the client). Best-effort on the AI step.
 */
export async function saveRoleAndGenerateCompetencies(
  jobId: string,
  values: RoleFormInput,
  opts: { regenerate?: boolean } = {}
): Promise<ActionResult<{ competencies: Competency[] }>> {
  const profile = await getCurrentProfile()
  if (!profile) return { ok: false, error: "Not signed in." }
  const supabase = await createClient()

  const update: TablesUpdate<"job_orders"> = {
    workplace_type: values.workplace_type ?? null,
    office_location: values.office_location || null,
    description: values.description || null,
    industry: values.industry || null,
    job_function: values.job_function || null,
    experience_required: values.experience_required || null,
    education_required: values.education_required || null,
    salary_from: values.salary_from ?? null,
    salary_to: values.salary_to ?? null,
    salary_currency: values.salary_currency || null,
  }
  if (values.title?.trim()) update.title = values.title.trim()
  const emp = values.employment_type?.trim()
  if (emp && (EMPLOYMENT_TYPES as readonly string[]).includes(emp)) {
    update.employment_type = emp as EmploymentType
  } else if (!emp) {
    update.employment_type = null
  } // invalid non-empty token → leave the existing value

  const { error } = await supabase.from("job_orders").update(update).eq("job_id", jobId)
  if (error) return { ok: false, error: error.message }

  // Replace target companies with the current UI list.
  await supabase.from("job_target_companies").delete().eq("job_id", jobId)
  const companies = (values.target_companies ?? []).filter((c) => c.name.trim())
  if (companies.length > 0) {
    await supabase
      .from("job_target_companies")
      .insert(companies.map((c) => ({ job_id: jobId, name: c.name.trim(), source: c.source })))
  }

  // Generate Evaluation Criteria only if the job has none yet (or an explicit
  // regenerate was requested) — don't clobber already-generated/edited
  // competencies on every "Next".
  const { count } = await supabase
    .from("job_competencies")
    .select("id", { count: "exact", head: true })
    .eq("job_id", jobId)
  if (opts.regenerate || (count ?? 0) === 0) {
    await requestAndApplyAiCompetencies(supabase, jobId)
  }

  const competencies = await getJobCompetencies(jobId)
  revalidatePath(`/jobs/${jobId}`)
  return { ok: true, competencies }
}

export async function createJobDraft(
  input: CreateJobDraftInput
): Promise<ActionResult<{ job_id: string }>> {
  const profile = await getCurrentProfile()
  if (!profile) return { ok: false, error: "Not signed in." }
  if (!input.title?.trim()) return { ok: false, error: "Job title is required." }
  if (!input.client_id) return { ok: false, error: "A client is required." }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("job_orders")
    .insert({
      title: input.title.trim(),
      client_id: input.client_id, // NOT NULL
      status: "draft",
      workflow_template_id: input.workflow_template_id ?? null,
      location: input.location ?? null,
      description: input.description ?? null,
    })
    .select("job_id")
    .single()
  if (error || !data) return { ok: false, error: error?.message ?? "Could not create job." }

  await logActivity(supabase, {
    event_type: "job_created",
    client_id: input.client_id,
    job_id: data.job_id,
    actor_profile_id: profile.id,
    payload: { title: input.title },
  })

  // Generate the role definition to pre-fill the wizard (best-effort). The next
  // step — Evaluation Criteria — is generated when the recruiter clicks "Next"
  // on the Role Definition step (saveRoleAndGenerateCompetencies), using their
  // reviewed/edited role.
  await requestAndApplyAiRole(supabase, {
    job_id: data.job_id,
    title: input.title.trim(),
    client_id: input.client_id,
    location: input.location ?? null,
    description: input.description ?? null,
    notes: input.notes ?? null,
  })

  revalidatePath("/jobs")
  return { ok: true, job_id: data.job_id }
}

/**
 * Delete a job — restricted to `draft` status. A draft has no snapshotted
 * pipeline or applications yet, so removal is safe; child rows (competencies,
 * scorecard, target companies) cascade. Published jobs must be closed, not
 * deleted, to preserve their application history.
 */
export async function deleteJob(jobId: string): Promise<ActionResult> {
  const profile = await getCurrentProfile()
  if (!profile) return { ok: false, error: "Not signed in." }
  const supabase = await createClient()

  const { data: job } = await supabase
    .from("job_orders")
    .select("job_id, status")
    .eq("job_id", jobId)
    .single()
  if (!job) return { ok: false, error: "Job not found." }
  if (job.status !== "draft")
    return { ok: false, error: "Only draft jobs can be deleted — close a published job instead." }

  // Remove the job's audit events first (job_id is ON DELETE SET NULL, which
  // would otherwise leave detached rows) so a discarded draft is fully gone.
  // Must run before the job delete, while job_id still matches.
  await supabase.from("activity_events").delete().eq("job_id", jobId)

  const { error } = await supabase.from("job_orders").delete().eq("job_id", jobId)
  if (error) return { ok: false, error: error.message }

  revalidatePath("/jobs")
  return { ok: true }
}

// ── Hiring team ───────────────────────────────────────────────────────────────

export type TeamMemberInput = { name: string; email: string; role: string }

/**
 * Inserts one job_team_members row, opportunistically linking it to an
 * existing profile by email match, logs the event, and fires the Google
 * Calendar connect invite (a no-op if that email is already connected — see
 * sendCalendarConnectInvite). Shared by addJobTeamMember and publishJob (for
 * members collected during the draft wizard).
 */
async function persistTeamMember(
  supabase: SupabaseServer,
  job: { job_id: string; client_id: string },
  actorProfileId: string,
  member: TeamMemberInput,
  sendInvite = true
): Promise<ActionResult<{ id: string }>> {
  const email = member.email.trim().toLowerCase()
  const { data: matchingProfile } = await supabase
    .from("profiles")
    .select("id")
    .ilike("email", email)
    .maybeSingle()

  const { data, error } = await supabase
    .from("job_team_members")
    .insert({
      job_id: job.job_id,
      profile_id: matchingProfile?.id ?? null,
      name: member.name.trim(),
      email,
      role: member.role.trim(),
    })
    .select("id")
    .single()
  if (error || !data) return { ok: false, error: error?.message ?? "Could not add team member." }

  await logActivity(supabase, {
    event_type: "job_team_member_added",
    client_id: job.client_id,
    job_id: job.job_id,
    actor_profile_id: actorProfileId,
    payload: { name: member.name.trim(), email, role: member.role.trim() },
  })

  if (sendInvite) {
    await sendCalendarConnectInvite({
      email,
      name: member.name.trim(),
      jobId: job.job_id,
      jobTeamMemberId: data.id,
    })
  }

  return { ok: true, id: data.id }
}

/** Add a hiring-team member to an already-published job (job workspace "Team" panel). */
export async function addJobTeamMember(
  jobId: string,
  input: TeamMemberInput
): Promise<ActionResult<{ id: string }>> {
  const profile = await getCurrentProfile()
  if (!profile) return { ok: false, error: "Not signed in." }
  if (!input.name?.trim() || !input.email?.trim() || !input.role?.trim())
    return { ok: false, error: "Name, email, and role are required." }

  const supabase = await createClient()
  const { data: job } = await supabase
    .from("job_orders")
    .select("job_id, client_id")
    .eq("job_id", jobId)
    .single()
  if (!job) return { ok: false, error: "Job not found." }

  const result = await persistTeamMember(supabase, job, profile.id, input)
  if (result.ok) revalidatePath(`/jobs/${jobId}`)
  return result
}

/**
 * Auto-save a team member added in the DRAFT wizard. Persists the row so it
 * survives navigation/refresh, but does NOT send the calendar-connect invite —
 * invites fire at publish (a draft may still be discarded).
 */
export async function addDraftTeamMember(
  jobId: string,
  input: TeamMemberInput
): Promise<ActionResult<{ id: string }>> {
  const profile = await getCurrentProfile()
  if (!profile) return { ok: false, error: "Not signed in." }
  if (!input.name?.trim() || !input.email?.trim() || !input.role?.trim())
    return { ok: false, error: "Name, email, and role are required." }

  const supabase = await createClient()
  const { data: job } = await supabase
    .from("job_orders")
    .select("job_id, client_id")
    .eq("job_id", jobId)
    .single()
  if (!job) return { ok: false, error: "Job not found." }

  const result = await persistTeamMember(supabase, job, profile.id, input, false)
  if (result.ok) revalidatePath(`/jobs/${jobId}`)
  return result
}

/** Remove a team member (draft or published job). */
export async function removeJobTeamMember(memberId: string): Promise<ActionResult> {
  const profile = await getCurrentProfile()
  if (!profile) return { ok: false, error: "Not signed in." }
  const supabase = await createClient()
  const { error } = await supabase.from("job_team_members").delete().eq("id", memberId)
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

// ── Publish: snapshot template stages + resolved settings onto the job ────────

export async function publishJob(
  jobId: string,
  payload: { workflow_template_id?: string | null } = {}
): Promise<ActionResult> {
  const profile = await getCurrentProfile()
  if (!profile) return { ok: false, error: "Not signed in." }
  const supabase = await createClient()

  const { data: job } = await supabase
    .from("job_orders")
    .select("job_id, client_id, status, workflow_template_id")
    .eq("job_id", jobId)
    .single()
  if (!job) return { ok: false, error: "Job not found." }
  if (job.status !== "draft")
    return { ok: false, error: "Only draft jobs can be published (workflow is frozen once published)." }

  const templateId = payload.workflow_template_id ?? job.workflow_template_id
  if (!templateId) return { ok: false, error: "Select a workflow template before publishing." }

  const { data: template } = await supabase
    .from("workflow_templates")
    .select("id, version")
    .eq("id", templateId)
    .single()
  if (!template) return { ok: false, error: "Workflow template not found." }

  const { data: templateStages } = await supabase
    .from("workflow_template_sub_stages")
    .select("*")
    .eq("template_id", templateId)
    .order("display_order", { ascending: true })
  if (!templateStages || templateStages.length === 0)
    return { ok: false, error: "This workflow template has no stages — add at least one before publishing." }

  // 1) Snapshot the template sub-stages into the per-job table (frozen copy).
  const snapshotRows = templateStages.map((s) => ({
    job_id: jobId,
    pipeline_stage_id: s.pipeline_stage_id,
    name: s.name,
    purpose: s.purpose,
    duration_minutes: s.duration_minutes,
    format: s.format,
    visibility: s.visibility,
    owner_role: s.owner_role,
    collaborator_role: s.collaborator_role,
    entry_conditions: s.entry_conditions,
    interviewer_type: s.interviewer_type,
    question_source: s.question_source,
    required_questions: s.required_questions,
    capture_feedback_form: s.capture_feedback_form,
    capture_transcript: s.capture_transcript,
    decision_mode: s.decision_mode,
    decision_owner: s.decision_owner,
    rating_scale: s.rating_scale,
    hire_recommendation_enabled: s.hire_recommendation_enabled,
    override_enabled: s.override_enabled,
    override_roles: s.override_roles,
    allowed_outcomes: s.allowed_outcomes,
    needs_final_approval: s.needs_final_approval,
    display_order: s.display_order,
    config: s.config,
  }))
  const { error: snapErr } = await supabase
    .from("job_workflow_sub_stages")
    .insert(snapshotRows)
  if (snapErr) return { ok: false, error: `Snapshot failed: ${snapErr.message}` }

  // 2) Resolve global⊕client⊕workflow settings and write them as scope='job'.
  const resolved = await resolveWorkflowSettings({
    clientId: job.client_id,
    templateId,
  })
  const jobSettings = Object.entries(resolved.settings).map(([category, config]) => ({
    scope: "job" as const,
    scope_id: jobId,
    client_id: job.client_id,
    category,
    config,
  }))
  if (jobSettings.length > 0) await supabase.from("workflow_settings").insert(jobSettings)
  if (resolved.sla.length > 0)
    await supabase.from("sla_policies").insert(
      resolved.sla.map((s) => ({
        scope: "job" as const,
        scope_id: jobId,
        client_id: job.client_id,
        sla_type: s.sla_type,
        threshold_hours: s.threshold_hours,
        enabled: s.enabled,
        config: s.config,
      }))
    )
  if (resolved.communications.length > 0)
    await supabase.from("communication_templates").insert(
      resolved.communications.map((c) => ({
        scope: "job" as const,
        scope_id: jobId,
        client_id: job.client_id,
        trigger_event_type: c.trigger_event_type,
        channel: c.channel,
        subject: c.subject,
        body: c.body,
        recipients: c.recipients,
        enabled: c.enabled,
      }))
    )

  // 3) Flip to open + record provenance.
  const { error: updErr } = await supabase
    .from("job_orders")
    .update({
      status: "open",
      workflow_template_id: templateId,
      workflow_template_version: template.version,
    })
    .eq("job_id", jobId)
  if (updErr) return { ok: false, error: updErr.message }

  // 4) The hiring team was auto-saved during the draft (addDraftTeamMember,
  // without invites). Now that the job is published, send each member the
  // Google Calendar connect invite (skipped per-person if already connected).
  const { data: teamMembers } = await supabase
    .from("job_team_members")
    .select("id, name, email")
    .eq("job_id", jobId)
  for (const m of teamMembers ?? []) {
    await sendCalendarConnectInvite({
      email: m.email,
      name: m.name,
      jobId,
      jobTeamMemberId: m.id,
    })
  }

  await logActivity(supabase, {
    event_type: "job_published",
    client_id: job.client_id,
    job_id: jobId,
    actor_profile_id: profile.id,
  })
  await logActivity(supabase, {
    event_type: "job_workflow_snapshotted",
    client_id: job.client_id,
    job_id: jobId,
    actor_profile_id: profile.id,
    payload: { template_id: templateId, stages: snapshotRows.length },
  })

  revalidatePath(`/jobs/${jobId}`)
  revalidatePath("/jobs")
  return { ok: true }
}

// ── Candidate movement runtime ───────────────────────────────────────────────

export async function addCandidateToPipeline(
  jobId: string,
  candidateId: string
): Promise<ActionResult<{ application_id: string }>> {
  const profile = await getCurrentProfile()
  if (!profile) return { ok: false, error: "Not signed in." }
  const supabase = await createClient()

  const { data: job } = await supabase
    .from("job_orders")
    .select("job_id, client_id")
    .eq("job_id", jobId)
    .single()
  if (!job) return { ok: false, error: "Job not found." }

  // First sub-stage (lowest display_order) — the pipeline entry point.
  const { data: firstStage } = await supabase
    .from("job_workflow_sub_stages")
    .select("id")
    .eq("job_id", jobId)
    .order("display_order", { ascending: true })
    .limit(1)
    .maybeSingle()
  if (!firstStage)
    return { ok: false, error: "This job has no pipeline stages yet — publish the job first." }

  const { data: app, error } = await supabase
    .from("applications")
    .insert({
      candidate_id: candidateId,
      job_id: jobId,
      client_id: job.client_id, // NOT NULL — copied from the job
      current_stage_id: firstStage.id,
      status: "active",
      owner_profile_id: profile.id,
    })
    .select("application_id")
    .single()

  if (error || !app) {
    // 23505 = unique_violation on (candidate_id, job_id)
    if (error?.code === "23505")
      return { ok: false, error: "This candidate is already in this job's pipeline." }
    return { ok: false, error: error?.message ?? "Could not add candidate." }
  }

  await supabase.from("application_stage_history").insert({
    application_id: app.application_id,
    sub_stage_id: firstStage.id,
  })

  const base = {
    client_id: job.client_id,
    candidate_id: candidateId,
    job_id: jobId,
    application_id: app.application_id,
    actor_profile_id: profile.id,
  }
  await logActivity(supabase, {
    ...base,
    event_type: "application_created",
    idempotency_key: `application_created:${app.application_id}`,
  })
  await logActivity(supabase, {
    ...base,
    event_type: "candidate_added_to_stage",
    sub_stage_id: firstStage.id,
    idempotency_key: `candidate_added_to_stage:${app.application_id}:${firstStage.id}`,
  })

  revalidatePath(`/jobs/${jobId}`)
  return { ok: true, application_id: app.application_id }
}

export async function moveCandidate(
  applicationId: string,
  targetSubStageId: string,
  opts: { idempotencyKey?: string } = {}
): Promise<ActionResult> {
  const profile = await getCurrentProfile()
  if (!profile) return { ok: false, error: "Not signed in." }
  const supabase = await createClient()

  const { data: app } = await supabase
    .from("applications")
    .select("application_id, candidate_id, job_id, client_id, current_stage_id, status")
    .eq("application_id", applicationId)
    .single()
  if (!app) return { ok: false, error: "Application not found." }
  if (app.status !== "active")
    return { ok: false, error: "This application is already closed." }

  // Transition validation: target sub-stage must belong to this job.
  const { data: target } = await supabase
    .from("job_workflow_sub_stages")
    .select("id, display_order")
    .eq("id", targetSubStageId)
    .eq("job_id", app.job_id)
    .maybeSingle()
  if (!target) return { ok: false, error: "That stage is not part of this job's pipeline." }
  if (target.id === app.current_stage_id)
    return { ok: false, error: "Candidate is already in that stage." }

  // Close the open stage-history row, open a new one.
  await supabase
    .from("application_stage_history")
    .update({ exited_at: new Date().toISOString(), outcome: "advance", decided_by: profile.id })
    .eq("application_id", applicationId)
    .is("exited_at", null)
  await supabase
    .from("application_stage_history")
    .insert({ application_id: applicationId, sub_stage_id: targetSubStageId })
  await supabase
    .from("applications")
    .update({ current_stage_id: targetSubStageId })
    .eq("application_id", applicationId)

  const base = {
    client_id: app.client_id,
    candidate_id: app.candidate_id,
    job_id: app.job_id,
    application_id: applicationId,
    actor_profile_id: profile.id,
  }
  const keyBase = opts.idempotencyKey ?? `${applicationId}:${targetSubStageId}`
  await logActivity(supabase, {
    ...base,
    event_type: "candidate_leaves_stage",
    sub_stage_id: app.current_stage_id,
    idempotency_key: `candidate_leaves_stage:${keyBase}`,
  })
  await logActivity(supabase, {
    ...base,
    event_type: "candidate_advanced",
    sub_stage_id: targetSubStageId,
    severity: "action_needed",
    idempotency_key: `candidate_advanced:${keyBase}`,
  })
  await logActivity(supabase, {
    ...base,
    event_type: "candidate_added_to_stage",
    sub_stage_id: targetSubStageId,
    idempotency_key: `candidate_added_to_stage:${keyBase}`,
  })

  revalidatePath(`/jobs/${app.job_id}`)
  return { ok: true }
}

async function closeApplication(
  applicationId: string,
  status: "rejected" | "withdrawn",
  eventType: ActivityEventType,
  reason: string | null
): Promise<ActionResult> {
  const profile = await getCurrentProfile()
  if (!profile) return { ok: false, error: "Not signed in." }
  const supabase = await createClient()

  const { data: app } = await supabase
    .from("applications")
    .select("application_id, candidate_id, job_id, client_id, current_stage_id, status")
    .eq("application_id", applicationId)
    .single()
  if (!app) return { ok: false, error: "Application not found." }
  if (app.status !== "active") return { ok: false, error: "This application is already closed." }

  await supabase
    .from("applications")
    .update({ status, status_reason: reason })
    .eq("application_id", applicationId)
  await supabase
    .from("application_stage_history")
    .update({
      exited_at: new Date().toISOString(),
      outcome: status === "rejected" ? "reject" : "withdraw",
      decided_by: profile.id,
    })
    .eq("application_id", applicationId)
    .is("exited_at", null)

  const base = {
    client_id: app.client_id,
    candidate_id: app.candidate_id,
    job_id: app.job_id,
    application_id: applicationId,
    actor_profile_id: profile.id,
  }
  await logActivity(supabase, {
    ...base,
    event_type: eventType,
    sub_stage_id: app.current_stage_id,
    severity: "action_needed",
    payload: reason ? { reason } : {},
    idempotency_key: `${eventType}:${applicationId}`,
  })
  await logActivity(supabase, {
    ...base,
    event_type: "application_closed",
    idempotency_key: `application_closed:${applicationId}`,
  })

  revalidatePath(`/jobs/${app.job_id}`)
  return { ok: true }
}

export async function rejectCandidate(
  applicationId: string,
  reason: string | null = null
): Promise<ActionResult> {
  return closeApplication(applicationId, "rejected", "candidate_rejected", reason)
}

export async function withdrawCandidate(
  applicationId: string,
  reason: string | null = null
): Promise<ActionResult> {
  return closeApplication(applicationId, "withdrawn", "candidate_withdraws", reason)
}
