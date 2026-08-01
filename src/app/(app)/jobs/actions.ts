"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { getCurrentProfile } from "@/lib/auth"
import { resolveWorkflowSettings } from "@/lib/workflow-settings"
import { serverEnv } from "@/lib/env"
import type {
  ActivityEventType,
  ActorType,
  EventSeverity,
  Json,
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
 * Fire the "AI job intake" webhook: hands the raw Add-Job inputs to n8n, which
 * runs an LLM and (in a later phase) returns a structured role/competencies/
 * scorecard draft. Best-effort — never blocks job creation if n8n is down.
 * Configure the n8n Webhook node to "Respond Immediately" so this returns fast
 * while the LLM work continues asynchronously.
 */
async function sendJobIntakeToN8n(payload: {
  job_id: string
  title: string
  client_id: string
  location: string | null
  description: string | null
  notes: string | null
}) {
  try {
    const res = await fetch(serverEnv.n8nJobWebhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serverEnv.n8nWebhookSecret}`,
      },
      body: JSON.stringify(payload),
    })
    if (!res.ok) console.error(`[job-intake] n8n webhook responded ${res.status}`)
  } catch (err) {
    console.error("[job-intake] n8n webhook failed", err)
  }
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

  // Hand the raw intake to n8n for AI pre-fill (best-effort).
  await sendJobIntakeToN8n({
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
