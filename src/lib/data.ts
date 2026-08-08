import "server-only"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { isSupabaseConfigured } from "@/lib/env"
import type {
  ActivityEventRow,
  ApplicationRow,
  CandidateCertificationRow,
  CandidateEducationRow,
  CandidateRow,
  CandidateSkillWithSkill,
  CandidateToolWithTool,
  CandidateWorkExperienceRow,
  ClientRow,
  JobOrderRow,
  JobTeamMemberRow,
  JobWorkflowSubStageRow,
  PipelineStageRow,
  ProfileRow,
  WorkflowTemplateRow,
  WorkflowTemplateSubStageRow,
} from "@/lib/supabase/types"

/** A candidate list row decorated with its current role + primary education —
 * both now live in child tables (candidate_work_experiences/candidate_education)
 * rather than flat columns, so list/grid views need this to render a title/
 * company/education line without a per-row query. */
export type CandidateListItem = CandidateRow & {
  currentRole: { title: string; company_name: string; location: string | null } | null
  primaryEducation: CandidateEducationRow | null
}
import {
  parseTranscriptText,
  type AudioStatus,
  type Conversation,
} from "@/lib/conversations"
import type { ScreeningAgent } from "@/lib/agents"
import type { WorkHistoryEntry } from "@/lib/work-history"
import type { Competency } from "@/components/jobs/draft/steps/competency-data"
import type { ScoreCardCategory } from "@/components/jobs/draft/steps/score-card-step"

/**
 * Server-side read helpers used by Server Components. Every function degrades
 * gracefully to empty/null when Supabase isn't configured yet, so the app runs
 * with `pnpm dev` before the project is connected. All reads go through the
 * request-scoped anon client, so RLS applies.
 */

export type CandidateFilters = {
  tiers?: string[]
  skill?: string
  location?: string
  q?: string
}

/** date (YYYY-MM-DD) -> the "YYYY-MM" shape WorkHistoryEntry expects. */
function toWorkHistoryEntry(row: CandidateWorkExperienceRow): WorkHistoryEntry {
  return {
    company: row.company_name,
    title: row.title,
    location: row.location ?? undefined,
    start_date: row.start_date.slice(0, 7),
    end_date: row.end_date ? row.end_date.slice(0, 7) : null,
    description: row.description ?? undefined,
  }
}

export async function getCandidates(
  filters: CandidateFilters = {}
): Promise<CandidateListItem[]> {
  if (!isSupabaseConfigured) return []
  const supabase = await createClient()

  let query = supabase
    .from("candidates")
    .select("*")
    .order("date_added", { ascending: false })

  if (filters.tiers && filters.tiers.length > 0) {
    // Untiered candidates (candidate_tier is null — e.g. every resume-upload
    // ingestion, which has no tier signal to assign) should never be hidden
    // by a tier filter: `.in()` alone excludes NULLs (SQL semantics), which
    // would silently disappear anyone not yet tiered. OR in an explicit
    // is-null check so they stay visible under any tier filter.
    const tierList = filters.tiers.join(",")
    query = query.or(`candidate_tier.is.null,candidate_tier.in.(${tierList})`)
  }
  if (filters.q) query = query.ilike("full_name", `%${filters.q}%`)
  if (filters.location)
    query = query.ilike("location_raw", `%${filters.location}%`)

  const { data, error } = await query
  if (error) {
    console.error("getCandidates error:", error.message)
    return []
  }

  let rows = data ?? []

  // Skill filter requires two joins (skills -> candidate_skills); do the
  // lookup and filter in memory for the demo (fine at this scale). Structured
  // skill search moves server-side later.
  if (filters.skill) {
    const { data: matchingSkills } = await supabase
      .from("skills")
      .select("id")
      .ilike("name", `%${filters.skill}%`)
    const skillIds = (matchingSkills ?? []).map((s) => s.id)

    let ids = new Set<string>()
    if (skillIds.length > 0) {
      const { data: candidateSkillRows } = await supabase
        .from("candidate_skills")
        .select("candidate_id")
        .in("skill_id", skillIds)
      ids = new Set((candidateSkillRows ?? []).map((r) => r.candidate_id))
    }
    rows = rows.filter((c) => ids.has(c.candidate_id))
  }

  const candidateIds = rows.map((c) => c.candidate_id)
  const roleByCandidate = new Map<
    string,
    { title: string; company_name: string; location: string | null }
  >()
  const educationByCandidate = new Map<string, CandidateEducationRow>()

  if (candidateIds.length > 0) {
    const [{ data: currentRoles }, { data: educationRows }] = await Promise.all([
      supabase
        .from("candidate_work_experiences")
        .select("candidate_id, title, company_name, location")
        .in("candidate_id", candidateIds)
        .eq("display_order", 0),
      supabase
        .from("candidate_education")
        .select("*")
        .in("candidate_id", candidateIds)
        .order("created_at", { ascending: true }),
    ])

    for (const r of currentRoles ?? [])
      roleByCandidate.set(r.candidate_id, r)
    for (const e of educationRows ?? [])
      if (!educationByCandidate.has(e.candidate_id))
        educationByCandidate.set(e.candidate_id, e)
  }

  return rows.map((c) => ({
    ...c,
    currentRole: roleByCandidate.get(c.candidate_id) ?? null,
    primaryEducation: educationByCandidate.get(c.candidate_id) ?? null,
  }))
}

export type AddedByProfile = { full_name: string | null; email: string }

export type CandidateResumeFile = {
  filename: string
  fileSize: number | null
  mimeType: string | null
  uploadedAt: string
  signedUrl: string
}

export async function getCandidate(id: string): Promise<{
  candidate: CandidateRow
  skills: CandidateSkillWithSkill[]
  tools: CandidateToolWithTool[]
  education: CandidateEducationRow[]
  certifications: CandidateCertificationRow[]
  workHistory: WorkHistoryEntry[]
  addedBy: AddedByProfile | null
  resume: CandidateResumeFile | null
} | null> {
  if (!isSupabaseConfigured) return null
  const supabase = await createClient()

  const { data: candidate, error } = await supabase
    .from("candidates")
    .select("*, added_by_profile:profiles(full_name, email)")
    .eq("candidate_id", id)
    .single()

  if (error || !candidate) return null

  const { added_by_profile: addedBy, ...candidateFields } = candidate as CandidateRow & {
    added_by_profile: AddedByProfile | null
  }

  const { data: skills } = await supabase
    .from("candidate_skills")
    .select("*, skill:skills(name, skill_type, category)")
    .eq("candidate_id", id)

  const { data: tools } = await supabase
    .from("candidate_tools")
    .select("*, tool:tools(name)")
    .eq("candidate_id", id)

  const { data: education } = await supabase
    .from("candidate_education")
    .select("*")
    .eq("candidate_id", id)

  const { data: certifications } = await supabase
    .from("candidate_certifications")
    .select("*")
    .eq("candidate_id", id)

  const { data: workExperiences } = await supabase
    .from("candidate_work_experiences")
    .select("*")
    .eq("candidate_id", id)
    .order("display_order", { ascending: true })

  const { data: resumeRow } = await supabase
    .from("resumes")
    .select("filename, file_size, mime_type, storage_path, created_at")
    .eq("candidate_id", id)
    .eq("is_current", true)
    .maybeSingle()

  let resume: CandidateResumeFile | null = null
  if (resumeRow) {
    const { data: signed } = await supabase.storage
      .from("resumes")
      .createSignedUrl(resumeRow.storage_path, 3600) // 1 hour
    if (signed?.signedUrl) {
      resume = {
        filename: resumeRow.filename,
        fileSize: resumeRow.file_size,
        mimeType: resumeRow.mime_type,
        uploadedAt: resumeRow.created_at,
        signedUrl: signed.signedUrl,
      }
    }
  }

  return {
    candidate: candidateFields,
    skills: (skills ?? []) as CandidateSkillWithSkill[],
    tools: (tools ?? []) as CandidateToolWithTool[],
    education: education ?? [],
    certifications: certifications ?? [],
    workHistory: (workExperiences ?? []).map(toWorkHistoryEntry),
    addedBy,
    resume,
  }
}

/** Every profile (both sides), for the admin "Switch User" menu — grouped/labeled by side in the UI. */
export type SwitchableProfile = Pick<
  ProfileRow,
  "id" | "email" | "full_name" | "side" | "role" | "client_role"
> & { client_name: string | null }

export async function getSwitchableProfiles(): Promise<SwitchableProfile[]> {
  if (!isSupabaseConfigured) return []
  const supabase = await createClient()
  const { data } = await supabase
    .from("profiles")
    .select("id, email, full_name, side, role, client_role, client:clients(client_name)")
    .order("full_name")
  return (data ?? []).map((p) => ({
    id: p.id,
    email: p.email,
    full_name: p.full_name,
    side: p.side,
    role: p.role,
    client_role: p.client_role,
    client_name: p.client?.client_name ?? null,
  }))
}

export async function getClients(): Promise<ClientRow[]> {
  if (!isSupabaseConfigured) return []
  const supabase = await createClient()
  const { data } = await supabase
    .from("clients")
    .select("*")
    .order("client_name")
  return data ?? []
}

export async function getJobOrders(): Promise<
  (JobOrderRow & { client: ClientRow | null })[]
> {
  if (!isSupabaseConfigured) return []
  const supabase = await createClient()
  const { data } = await supabase
    .from("job_orders")
    .select("*, client:clients(*)")
    .order("created_at", { ascending: false })
  return (data ?? []) as (JobOrderRow & { client: ClientRow | null })[]
}

export async function getJobOrder(id: string): Promise<
  | (JobOrderRow & {
      client: ClientRow | null
      applications: (ApplicationRow & { candidate: CandidateRow | null })[]
    })
  | null
> {
  if (!isSupabaseConfigured) return null
  const supabase = await createClient()

  const { data: job, error } = await supabase
    .from("job_orders")
    .select("*, client:clients(*)")
    .eq("job_id", id)
    .single()

  if (error || !job) return null

  const { data: applications } = await supabase
    .from("applications")
    .select("*, candidate:candidates(*)")
    .eq("job_id", id)
    .order("date_applied", { ascending: false })

  return {
    ...(job as JobOrderRow & { client: ClientRow | null }),
    applications: (applications ?? []) as (ApplicationRow & {
      candidate: CandidateRow | null
    })[],
  }
}

// ── Workflow templates ───────────────────────────────────────────────────────

/** Templates visible to a client: Stellaforce-global (client_id null) + the
 * client's own. Pass clientId = null for a Stellaforce-side user (sees all —
 * RLS already scopes reads, this just orders/labels). */
export async function getWorkflowTemplates(
  opts: { clientId?: string | null } = {}
): Promise<(WorkflowTemplateRow & { client: ClientRow | null })[]> {
  if (!isSupabaseConfigured) return []
  const supabase = await createClient()
  let query = supabase
    .from("workflow_templates")
    .select("*, client:clients(*)")
    .order("updated_at", { ascending: false })
  if (opts.clientId) query = query.or(`client_id.is.null,client_id.eq.${opts.clientId}`)
  const { data } = await query
  return (data ?? []) as (WorkflowTemplateRow & { client: ClientRow | null })[]
}

/** Sub-stages carry a `display_order` that only orders them *within* their own
 * pipeline stage (each stage's sub-stages restart at 0) — a plain `.order()`
 * on that column alone ties across different stages and can interleave them
 * (e.g. every stage's first sub-stage before any stage's second). Sort by
 * the joined pipeline stage's own `display_order` first, then the sub-stage's,
 * so Source/Screen/Interview/Offer/Close always come out in that order. */
export function sortByPipelineStage<
  T extends { pipeline_stage: PipelineStageRow | null; display_order: number },
>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const stageDiff = (a.pipeline_stage?.display_order ?? 0) - (b.pipeline_stage?.display_order ?? 0)
    return stageDiff !== 0 ? stageDiff : a.display_order - b.display_order
  })
}

export type WorkflowTemplateSubStageWithStage = WorkflowTemplateSubStageRow & {
  pipeline_stage: PipelineStageRow | null
}

export async function getWorkflowTemplate(id: string): Promise<
  | (WorkflowTemplateRow & {
      client: ClientRow | null
      sub_stages: WorkflowTemplateSubStageWithStage[]
    })
  | null
> {
  if (!isSupabaseConfigured) return null
  const supabase = await createClient()

  const { data: template, error } = await supabase
    .from("workflow_templates")
    .select("*, client:clients(*)")
    .eq("id", id)
    .single()
  if (error || !template) return null

  const { data: subStages } = await supabase
    .from("workflow_template_sub_stages")
    .select("*, pipeline_stage:pipeline_stages(*)")
    .eq("template_id", id)
    .order("display_order", { ascending: true })

  return {
    ...(template as WorkflowTemplateRow & { client: ClientRow | null }),
    sub_stages: sortByPipelineStage((subStages ?? []) as WorkflowTemplateSubStageWithStage[]),
  }
}

// ── Pipeline board + activity timelines ──────────────────────────────────────

/** A published job's snapshotted sub-stages + its applications, for the board. */
export async function getJobPipeline(jobId: string): Promise<{
  subStages: (JobWorkflowSubStageRow & { pipeline_stage: PipelineStageRow | null })[]
  applications: (ApplicationRow & { candidate: CandidateRow | null })[]
}> {
  if (!isSupabaseConfigured) return { subStages: [], applications: [] }
  const supabase = await createClient()
  const [subRes, appRes] = await Promise.all([
    supabase
      .from("job_workflow_sub_stages")
      .select("*, pipeline_stage:pipeline_stages(*)")
      .eq("job_id", jobId)
      .order("display_order", { ascending: true }),
    supabase
      .from("applications")
      .select("*, candidate:candidates(*)")
      .eq("job_id", jobId)
      .order("date_applied", { ascending: false }),
  ])
  return {
    subStages: sortByPipelineStage(
      (subRes.data ?? []) as (JobWorkflowSubStageRow & {
        pipeline_stage: PipelineStageRow | null
      })[]
    ),
    applications: (appRes.data ?? []) as (ApplicationRow & {
      candidate: CandidateRow | null
    })[],
  }
}

export type JobWorkflowSubStageWithLinks = JobWorkflowSubStageRow & {
  pipeline_stage: PipelineStageRow | null
  competency_ids: string[]
  reviewer_ids: string[]
}

/** A draft job's snapshotted sub-stages plus their per-stage competency/reviewer
 * assignments, for the Workflow step of the job-creation wizard. */
export async function getJobWorkflowSubStages(
  jobId: string
): Promise<JobWorkflowSubStageWithLinks[]> {
  if (!isSupabaseConfigured) return []
  const supabase = await createClient()
  const { data: subStages } = await supabase
    .from("job_workflow_sub_stages")
    .select("*, pipeline_stage:pipeline_stages(*)")
    .eq("job_id", jobId)
    .order("display_order", { ascending: true })
  if (!subStages || subStages.length === 0) return []

  const ids = subStages.map((s) => s.id)
  const [{ data: comps }, { data: revs }] = await Promise.all([
    supabase
      .from("job_workflow_sub_stage_competencies")
      .select("sub_stage_id, competency_id")
      .in("sub_stage_id", ids),
    supabase
      .from("job_workflow_sub_stage_reviewers")
      .select("sub_stage_id, member_id")
      .in("sub_stage_id", ids),
  ])

  const competencyIdsByStage = new Map<string, string[]>()
  for (const c of comps ?? []) {
    competencyIdsByStage.set(c.sub_stage_id, [
      ...(competencyIdsByStage.get(c.sub_stage_id) ?? []),
      c.competency_id,
    ])
  }
  const reviewerIdsByStage = new Map<string, string[]>()
  for (const r of revs ?? []) {
    reviewerIdsByStage.set(r.sub_stage_id, [
      ...(reviewerIdsByStage.get(r.sub_stage_id) ?? []),
      r.member_id,
    ])
  }

  return sortByPipelineStage(
    subStages as (JobWorkflowSubStageRow & { pipeline_stage: PipelineStageRow | null })[]
  ).map((s) => ({
    ...s,
    competency_ids: competencyIdsByStage.get(s.id) ?? [],
    reviewer_ids: reviewerIdsByStage.get(s.id) ?? [],
  }))
}

/** A job's competencies (Evaluation Criteria step), mapped to the wizard shape. */
export async function getJobCompetencies(jobId: string): Promise<Competency[]> {
  if (!isSupabaseConfigured) return []
  const supabase = await createClient()
  const { data: comps } = await supabase
    .from("job_competencies")
    .select("id, type, description, recommended_level, skills, tools")
    .eq("job_id", jobId)
    .order("created_at", { ascending: true })
  if (!comps || comps.length === 0) return []

  const { data: levels } = await supabase
    .from("job_competency_level_descriptions")
    .select("competency_id, level, description")
    .in(
      "competency_id",
      comps.map((c) => c.id)
    )
  const levelByComp = new Map<string, Partial<Record<string, string>>>()
  for (const l of levels ?? []) {
    const m = levelByComp.get(l.competency_id) ?? {}
    m[l.level] = l.description
    levelByComp.set(l.competency_id, m)
  }

  return comps.map((c) => {
    const ld = levelByComp.get(c.id) ?? {}
    return {
      id: c.id,
      type: c.type,
      description: c.description,
      recommendedLevel: c.recommended_level,
      selectedLevel: c.recommended_level,
      levelDescriptions: {
        aware: ld.aware ?? "",
        proficient: ld.proficient ?? "",
        expert: ld.expert ?? "",
      },
      skills: c.skills ?? [],
      tools: c.tools ?? [],
    }
  })
}

/** A job's scorecard (categories + their competency ids), for the Scorecard step. */
export async function getJobScorecard(jobId: string): Promise<ScoreCardCategory[]> {
  if (!isSupabaseConfigured) return []
  const supabase = await createClient()
  const { data: cats } = await supabase
    .from("job_scorecard_categories")
    .select("id, name, weight")
    .eq("job_id", jobId)
  if (!cats || cats.length === 0) return []

  const { data: links } = await supabase
    .from("job_scorecard_category_competencies")
    .select("category_id, competency_id")
    .in(
      "category_id",
      cats.map((c) => c.id)
    )
  const byCategory = new Map<string, string[]>()
  for (const l of links ?? []) {
    const arr = byCategory.get(l.category_id) ?? []
    arr.push(l.competency_id)
    byCategory.set(l.category_id, arr)
  }

  return cats.map((c) => ({
    id: c.id,
    name: c.name,
    weight: Number(c.weight),
    competencyIds: byCategory.get(c.id) ?? [],
  }))
}

export type ApplicationEvaluation = {
  id: string
  application_id: string
  sub_stage_id: string
  status: "pending" | "completed"
  interviewer_name: string | null
  interview_date: string | null
  mode: "phone" | "video" | "onsite" | "async" | null
  rubric_score: number | null
  summary: string | null
  notes: string[]
}

/** Real per-application interview evaluations (L2) for a batch of applications,
 * one row per (application, sub-stage) — for the pipeline board's Evaluation
 * tab. Currently unpopulated end-to-end (no submission UI yet), so this
 * reliably returns `[]` until that write path exists. */
export async function getApplicationEvaluations(
  applicationIds: string[]
): Promise<ApplicationEvaluation[]> {
  if (!isSupabaseConfigured || applicationIds.length === 0) return []
  const supabase = await createClient()
  const { data: evals } = await supabase
    .from("application_stage_evaluations")
    .select("*, interviewer:job_team_members(name)")
    .in("application_id", applicationIds)
  if (!evals || evals.length === 0) return []

  const { data: notes } = await supabase
    .from("application_stage_evaluation_notes")
    .select("evaluation_id, note, display_order")
    .in(
      "evaluation_id",
      evals.map((e) => e.id)
    )
    .order("display_order", { ascending: true })
  const notesByEvaluation = new Map<string, string[]>()
  for (const n of notes ?? []) {
    notesByEvaluation.set(n.evaluation_id, [
      ...(notesByEvaluation.get(n.evaluation_id) ?? []),
      n.note,
    ])
  }

  return evals.map((e) => ({
    id: e.id,
    application_id: e.application_id,
    sub_stage_id: e.sub_stage_id,
    status: e.status,
    interviewer_name: (e.interviewer as { name: string } | null)?.name ?? null,
    interview_date: e.interview_date,
    mode: e.mode,
    rubric_score: e.rubric_score,
    summary: e.summary,
    notes: notesByEvaluation.get(e.id) ?? [],
  }))
}

export type ApplicationScorecardCompetency = {
  competency_id: string
  achieved_proficiency: "aware" | "proficient" | "expert"
  confidence: "low" | "medium" | "high"
  summary: string | null
}

export type ApplicationScorecardCategory = {
  application_id: string
  category_id: string
  current_score: number | null
  target_score: number | null
  confidence: "low" | "medium" | "high" | null
  competencies: ApplicationScorecardCompetency[]
}

/** Real per-application computed scorecard rollups (L3) for a batch of
 * applications — for the pipeline board's Scorecard tab. Currently
 * unpopulated end-to-end (no evaluation submission or scoring pipeline yet),
 * so this reliably returns `[]` until that exists. */
export async function getApplicationScorecards(
  applicationIds: string[]
): Promise<ApplicationScorecardCategory[]> {
  if (!isSupabaseConfigured || applicationIds.length === 0) return []
  const supabase = await createClient()
  const { data: cats } = await supabase
    .from("application_scorecard_categories")
    .select("*")
    .in("application_id", applicationIds)
  if (!cats || cats.length === 0) return []

  const { data: comps } = await supabase
    .from("application_scorecard_competencies")
    .select("*")
    .in(
      "scorecard_category_id",
      cats.map((c) => c.id)
    )
  const compsByCategory = new Map<string, ApplicationScorecardCompetency[]>()
  for (const c of comps ?? []) {
    compsByCategory.set(c.scorecard_category_id, [
      ...(compsByCategory.get(c.scorecard_category_id) ?? []),
      {
        competency_id: c.competency_id,
        achieved_proficiency: c.achieved_proficiency,
        confidence: c.confidence,
        summary: c.summary,
      },
    ])
  }

  return cats.map((c) => ({
    application_id: c.application_id,
    category_id: c.category_id,
    current_score: c.current_score,
    target_score: c.target_score,
    confidence: c.confidence,
    competencies: compsByCategory.get(c.id) ?? [],
  }))
}

/** Target companies for a job (Role Definition step). */
export async function getJobTargetCompanies(
  jobId: string
): Promise<{ name: string; source: "extracted" | "ai_suggested" | "recruiter" }[]> {
  if (!isSupabaseConfigured) return []
  const supabase = await createClient()
  const { data } = await supabase
    .from("job_target_companies")
    .select("name, source")
    .eq("job_id", jobId)
    .order("created_at", { ascending: true })
  return (data ?? []).map((r) => ({
    name: r.name,
    source: (r.source as "extracted" | "ai_suggested" | "recruiter") ?? "ai_suggested",
  }))
}

/**
 * A job's hiring team, decorated with a derived `connected` boolean for the
 * Google Calendar consent flow. `google_calendar_connections` has no RLS
 * policy for `authenticated` (it holds encrypted refresh tokens), so — unlike
 * every other read in this file — that half of the query goes through the
 * admin client; only the derived boolean is returned, never the connection
 * row itself.
 */
export async function getJobTeamMembers(
  jobId: string
): Promise<(JobTeamMemberRow & { connected: boolean })[]> {
  if (!isSupabaseConfigured) return []
  const supabase = await createClient()
  const { data: members } = await supabase
    .from("job_team_members")
    .select("*")
    .eq("job_id", jobId)
    .order("created_at", { ascending: true })
  if (!members || members.length === 0) return []

  const admin = createAdminClient()
  const { data: connections } = await admin
    .from("google_calendar_connections")
    .select("email")
    .is("revoked_at", null)
    .in(
      "email",
      members.map((m) => m.email.toLowerCase())
    )
  const connectedEmails = new Set((connections ?? []).map((c) => c.email.toLowerCase()))

  return members.map((m) => ({ ...m, connected: connectedEmails.has(m.email.toLowerCase()) }))
}

/** All activity for one candidate (across every application) — compliance/analytics timeline. */
export async function getCandidateTimeline(candidateId: string): Promise<ActivityEventRow[]> {
  if (!isSupabaseConfigured) return []
  const supabase = await createClient()
  const { data } = await supabase
    .from("activity_events")
    .select("*")
    .eq("candidate_id", candidateId)
    .order("created_at", { ascending: false })
  return data ?? []
}

/** All activity for one job — compliance/analytics timeline. */
export async function getJobActivity(jobId: string): Promise<ActivityEventRow[]> {
  if (!isSupabaseConfigured) return []
  const supabase = await createClient()
  const { data } = await supabase
    .from("activity_events")
    .select("*")
    .eq("job_id", jobId)
    .order("created_at", { ascending: false })
  return data ?? []
}

export type ApplicationActivityEvent = ActivityEventRow & {
  actor: { full_name: string | null } | null
}

/** Activity scoped to specific applications (a candidate's run through one
 * specific job) — batch-fetched for the pipeline board's Activity tab, same
 * pattern as getApplicationEvaluations/getApplicationScorecards. */
export async function getApplicationActivity(
  applicationIds: string[]
): Promise<ApplicationActivityEvent[]> {
  if (!isSupabaseConfigured || applicationIds.length === 0) return []
  const supabase = await createClient()
  const { data } = await supabase
    .from("activity_events")
    .select("*, actor:profiles(full_name)")
    .in("application_id", applicationIds)
    .order("created_at", { ascending: false })
  return (data ?? []) as ApplicationActivityEvent[]
}

/** The candidate/job identity ElevenLabs echoes back as dynamic variables. Only
 * ever read as a *fallback* for display: test-run calls have no real
 * candidate/job row to join to, so the names live only in the raw payload. */
function payloadDynamicVariable(payload: unknown, key: string): string | null {
  if (typeof payload !== "object" || payload === null) return null
  const value = (payload as Record<string, unknown>)[key]
  return typeof value === "string" && value.trim() !== "" ? value : null
}

/** Agent Conversations page — AI-conducted calls landed by the ElevenLabs
 * post-call webhook. Scoped to `interviewer_type = 'ai'` since human/external
 * interview recordings aren't "conversations" in this page's sense. */
export async function getConversations(): Promise<Conversation[]> {
  if (!isSupabaseConfigured) return []
  const supabase = await createClient()
  const { data } = await supabase
    .from("call_recordings")
    .select(
      "id, elevenlabs_conversation_id, started_at, duration_seconds, is_test, to_number, transcript_text, raw_elevenlabs_payload, storage_path, mime_type, audio_status, video_url, agent:agents(name), candidate:candidates(full_name, first_name, last_name)"
    )
    .eq("interviewer_type", "ai")
    .order("started_at", { ascending: false, nullsFirst: false })

  // The bucket is private, so playable audio needs a signed URL. Batched here
  // rather than per-row on demand: the sheet is opened from an already-rendered
  // list, and there's no client-side session to sign with.
  const rows = data ?? []
  const signedUrlByPath = new Map<string, string>()
  const audioPaths = rows
    .filter((r) => r.audio_status === "uploaded" && r.storage_path)
    .map((r) => r.storage_path as string)
  if (audioPaths.length > 0) {
    const { data: signed } = await supabase.storage
      .from("call-recordings")
      .createSignedUrls(audioPaths, 3600) // 1 hour
    for (const entry of signed ?? [])
      if (entry.signedUrl && entry.path) signedUrlByPath.set(entry.path, entry.signedUrl)
  }

  return rows.map((row) => {
    const candidate = row.candidate as
      | { full_name: string | null; first_name: string; last_name: string }
      | null
    const candidateName =
      candidate?.full_name?.trim() ||
      (candidate ? `${candidate.first_name} ${candidate.last_name}`.trim() : null) ||
      payloadDynamicVariable(row.raw_elevenlabs_payload, "candidate_name")

    return {
      conversation_id: row.id,
      agent_name:
        (row.agent as { name: string } | null)?.name ??
        payloadDynamicVariable(row.raw_elevenlabs_payload, "agent_name"),
      candidate_name: candidateName,
      to_number: row.to_number,
      started_on: row.started_at ? row.started_at.slice(0, 10) : null,
      started_at: row.started_at,
      duration_seconds: row.duration_seconds,
      is_test_call: row.is_test,
      transcript: parseTranscriptText(row.transcript_text),
      audio_url: row.storage_path ? (signedUrlByPath.get(row.storage_path) ?? null) : null,
      audio_status: row.audio_status as AudioStatus,
      audio_mime_type: row.mime_type,
      video_url: row.video_url,
    }
  })
}

/** Distinct agent names available to filter conversations by — derived from the
 * conversations themselves rather than the `agents` table, so the filter never
 * offers an option that matches nothing (and still works while `agents` is
 * unpopulated and rows carry only a payload-echoed agent name). */
export function conversationAgentNames(conversations: Conversation[]): string[] {
  const names = new Set<string>()
  for (const c of conversations) if (c.agent_name) names.add(c.agent_name)
  return [...names].sort()
}

/** Screening agents for the Agents home page. `client_names` is derived by
 * joining through the workflow sub-stages that reference each agent, since
 * `agents` has no per-client ownership column by design. */
export async function getScreeningAgents(): Promise<ScreeningAgent[]> {
  if (!isSupabaseConfigured) return []
  const supabase = await createClient()

  const [{ data: agents }, { data: subStages }] = await Promise.all([
    supabase.from("agents").select("*").order("name"),
    supabase
      .from("job_workflow_sub_stages")
      .select("agent_id, job:job_orders(client:clients(client_name))")
      .not("agent_id", "is", null),
  ])

  const clientsByAgent = new Map<string, Set<string>>()
  for (const row of subStages ?? []) {
    const agentId = row.agent_id
    const name = (
      row.job as { client: { client_name: string } | null } | null
    )?.client?.client_name
    if (!agentId || !name) continue
    const set = clientsByAgent.get(agentId) ?? new Set<string>()
    set.add(name)
    clientsByAgent.set(agentId, set)
  }

  return (agents ?? []).map((agent) => ({
    ...agent,
    client_names: [...(clientsByAgent.get(agent.id) ?? [])].sort(),
  }))
}
