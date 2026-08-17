import { titleCase } from "@/lib/constants"
import type { ApplicationEvaluation, JobActivityEvent, JobWorkflowSubStageWithLinks } from "@/lib/data"
import type {
  ActivityEventType,
  ApplicationRow,
  ApplicationStageHistoryRow,
  CandidateRow,
} from "@/lib/supabase/types"

/**
 * The job workspace Pulse tab's data layer: three headline stats, the job-wide
 * activity feed, and the suggested next actions derived from both. Everything
 * here is pure — `nowMs` is passed in rather than read — so the page can
 * compute it during the server render and hand plain, serializable objects to
 * the client component.
 */

const DAY_MS = 86_400_000

/** How long an application may sit in one sub-stage before the Actions list
 * calls it stalled. There is no per-stage SLA on `job_workflow_sub_stages`
 * (SLAs live in `sla_policies`, which nothing resolves at read time yet), so
 * this is a flat house rule until that resolver is wired up. */
const STALL_DAYS = 7

/** Same, for an application sitting on an offer stage — offers go stale faster. */
const OFFER_STALL_DAYS = 3

export type PulseStat = {
  label: string
  /** Preformatted — "12", "—", "3.5". */
  value: string
  /** Trailing unit rendered smaller next to the value ("days"). */
  unit?: string
}

export type PulseEvent = {
  id: string
  label: string
  candidateId: string | null
  candidateName: string | null
  stageId: string | null
  stageName: string | null
  actor: string
  at: string
  severity: "info" | "warning" | "critical"
}

export type PulseAction = {
  id: string
  title: string
  detail: string
  candidateId: string | null
  candidateName: string | null
  stageId: string | null
  stageName: string | null
  priority: "high" | "medium" | "low"
}

type PipelineApplication = ApplicationRow & { candidate: CandidateRow | null }

function daysBetween(fromIso: string, toMs: number): number {
  return Math.max(0, Math.floor((toMs - new Date(fromIso).getTime()) / DAY_MS))
}

function candidateName(candidate: CandidateRow | null): string {
  if (!candidate) return "Unknown candidate"
  return candidate.full_name ?? `${candidate.first_name} ${candidate.last_name}`.trim()
}

/** Human labels for the event types whose enum name doesn't read well
 * title-cased. Everything else falls through to `titleCase`. */
const EVENT_LABELS: Partial<Record<ActivityEventType, string>> = {
  application_created: "Candidate added to job",
  candidate_added_to_stage: "Moved into stage",
  candidate_leaves_stage: "Left stage",
  candidate_data_updated: "Candidate details updated",
  all_required_evaluations_completed: "All evaluations completed",
  stage_sla_breached: "Stage SLA breached",
  interview_no_show_candidate: "Candidate no-showed",
  interview_no_show_interviewer: "Interviewer no-showed",
  job_workflow_snapshotted: "Workflow snapshotted",
  resume_ingested: "Resume ingested",
}

/** Event types that read as problems rather than progress — they drive the
 * feed's tone and seed the Actions list. */
const WARNING_EVENTS = new Set<ActivityEventType>([
  "evaluation_overdue",
  "interview_canceled",
  "interview_no_show_candidate",
  "interview_no_show_interviewer",
  "candidate_withdraws",
  "offer_declined",
  "offer_expired",
])

const CRITICAL_EVENTS = new Set<ActivityEventType>([
  "stage_sla_breached",
  "offer_rescinded",
])

function eventSeverity(type: ActivityEventType): PulseEvent["severity"] {
  if (CRITICAL_EVENTS.has(type)) return "critical"
  if (WARNING_EVENTS.has(type)) return "warning"
  return "info"
}

function actorLabel(event: JobActivityEvent): string {
  if (event.actor_type === "system") return event.system_source ?? "System"
  if (event.actor_type === "candidate") return event.candidate?.full_name ?? "Candidate"
  return event.actor?.full_name ?? "Someone"
}

/** The job-wide feed, newest first (`getJobActivity` already orders it that way). */
export function buildPulseEvents(events: JobActivityEvent[]): PulseEvent[] {
  return events.map((event) => ({
    id: event.id,
    label: EVENT_LABELS[event.event_type] ?? titleCase(event.event_type),
    candidateId: event.candidate?.candidate_id ?? event.candidate_id,
    candidateName: event.candidate?.full_name ?? null,
    stageId: event.sub_stage?.id ?? event.sub_stage_id,
    stageName: event.sub_stage?.name ?? null,
    actor: actorLabel(event),
    at: event.created_at,
    severity: eventSeverity(event.event_type),
  }))
}

/**
 * Open Days / Active Candidates / Average Time Per Stage.
 *
 * "Open days" counts from the `job_published` event when there is one and from
 * the job row's `created_at` otherwise — a job drafted in January and published
 * in March has been *open* since March.
 *
 * "Average time per stage" prefers completed stage visits
 * (`application_stage_history` rows with an `exited_at`). Nothing writes that
 * table yet, so when it's empty the stat falls back to how long the current
 * candidates have been sitting where they are — an under-count until stage
 * history is written, since those stays haven't finished.
 */
export function buildPulseStats({
  jobCreatedAt,
  events,
  applications,
  stageHistory,
  nowMs,
}: {
  jobCreatedAt: string
  events: JobActivityEvent[]
  applications: PipelineApplication[]
  stageHistory: ApplicationStageHistoryRow[]
  nowMs: number
}): PulseStat[] {
  const publishedAt = events
    .filter((e) => e.event_type === "job_published")
    .map((e) => e.created_at)
    .sort()[0]
  const openDays = daysBetween(publishedAt ?? jobCreatedAt, nowMs)

  const active = applications.filter((a) => a.status === "active")

  const completedVisits = stageHistory.filter((v) => v.exited_at !== null)
  let stageValue = "—"
  if (completedVisits.length > 0) {
    const totalDays = completedVisits.reduce(
      (sum, v) =>
        sum + (new Date(v.exited_at as string).getTime() - new Date(v.entered_at).getTime()) / DAY_MS,
      0
    )
    stageValue = (totalDays / completedVisits.length).toFixed(1)
  } else if (active.length > 0) {
    const totalDays = active.reduce(
      (sum, a) => sum + (nowMs - new Date(a.date_updated).getTime()) / DAY_MS,
      0
    )
    stageValue = (totalDays / active.length).toFixed(1)
  }

  return [
    { label: "Open Days", value: String(openDays), unit: "days" },
    { label: "Active Candidates", value: String(active.length) },
    { label: "Average Time Per Stage", value: stageValue, unit: "days" },
  ]
}

/**
 * What to do next to keep the job moving, derived from the same rows the rest
 * of the workspace renders — never invented. Five sources, highest-priority
 * first: an empty pipeline, unresolved SLA/overdue events, offers awaiting a
 * decision, candidates parked past the stall threshold, and interviews that
 * happened but were never evaluated.
 */
export function buildPulseActions({
  applications,
  subStages,
  evaluations,
  events,
  nowMs,
}: {
  applications: PipelineApplication[]
  subStages: JobWorkflowSubStageWithLinks[]
  evaluations: ApplicationEvaluation[]
  events: JobActivityEvent[]
  nowMs: number
}): PulseAction[] {
  const actions: PulseAction[] = []
  const stageById = new Map(subStages.map((s) => [s.id, s]))
  const active = applications.filter((a) => a.status === "active")

  if (active.length === 0) {
    actions.push({
      id: "empty-pipeline",
      title: "Add candidates to this job",
      detail: "No active candidates in the pipeline — nothing can move forward yet.",
      candidateId: null,
      candidateName: null,
      stageId: null,
      stageName: null,
      priority: "high",
    })
  }

  // Breach / overdue events that nothing has visibly resolved since. An event
  // counts as resolved once the same application records any advance, rejection
  // or completed-evaluation event afterwards.
  const RESOLVING = new Set<ActivityEventType>([
    "candidate_advanced",
    "candidate_rejected",
    "all_required_evaluations_completed",
    "interview_feedback_submitted",
  ])
  for (const event of events) {
    if (event.event_type !== "stage_sla_breached" && event.event_type !== "evaluation_overdue") {
      continue
    }
    const resolved = events.some(
      (later) =>
        later.application_id === event.application_id &&
        RESOLVING.has(later.event_type) &&
        new Date(later.created_at).getTime() > new Date(event.created_at).getTime()
    )
    if (resolved) continue
    const stage = event.sub_stage?.name ?? stageById.get(event.sub_stage_id ?? "")?.name ?? null
    actions.push({
      id: `event-${event.id}`,
      title:
        event.event_type === "stage_sla_breached"
          ? "Clear an SLA breach"
          : "Chase an overdue evaluation",
      detail:
        `${event.event_type === "stage_sla_breached" ? "SLA breached" : "Evaluation overdue"}` +
        `${stage ? ` at ${stage}` : ""} ${daysBetween(event.created_at, nowMs)} days ago.`,
      candidateId: event.candidate?.candidate_id ?? event.candidate_id,
      candidateName: event.candidate?.full_name ?? null,
      stageId: event.sub_stage?.id ?? event.sub_stage_id,
      stageName: stage,
      priority: "high",
    })
  }

  const evaluationsByApplication = new Map<string, ApplicationEvaluation[]>()
  for (const evaluation of evaluations) {
    evaluationsByApplication.set(evaluation.application_id, [
      ...(evaluationsByApplication.get(evaluation.application_id) ?? []),
      evaluation,
    ])
  }

  for (const app of active) {
    const stage = app.current_stage_id ? stageById.get(app.current_stage_id) : undefined
    if (!stage) continue
    const name = candidateName(app.candidate)
    const days = daysBetween(app.date_updated, nowMs)
    const group = stage.pipeline_stage?.key

    // An evaluation row that was created but never completed — the interview
    // happened, the feedback didn't.
    const pending = (evaluationsByApplication.get(app.application_id) ?? []).filter(
      (e) => e.status === "pending"
    )
    for (const evaluation of pending) {
      actions.push({
        id: `evaluation-${evaluation.id}`,
        title: `Submit ${name}'s evaluation`,
        detail: `${stageById.get(evaluation.sub_stage_id)?.name ?? "An interview"} is done but the scorecard is still pending.`,
        candidateId: app.candidate_id,
        candidateName: name,
        stageId: evaluation.sub_stage_id,
        stageName: stageById.get(evaluation.sub_stage_id)?.name ?? null,
        priority: "high",
      })
    }

    if (group === "offer" && days >= OFFER_STALL_DAYS) {
      actions.push({
        id: `offer-${app.application_id}`,
        title: `Follow up on ${name}'s offer`,
        detail: `Sitting at ${stage.name} for ${days} days with no decision recorded.`,
        candidateId: app.candidate_id,
        candidateName: name,
        stageId: stage.id,
        stageName: stage.name,
        priority: "high",
      })
      continue
    }

    if (days >= STALL_DAYS && group !== "close") {
      actions.push({
        id: `stalled-${app.application_id}`,
        title: `Move ${name} forward`,
        detail: `${days} days in ${stage.name} — advance, reject, or log why it's held.`,
        candidateId: app.candidate_id,
        candidateName: name,
        stageId: stage.id,
        stageName: stage.name,
        priority: days >= STALL_DAYS * 2 ? "high" : "medium",
      })
    }
  }

  const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 }
  return actions.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority])
}

/** Filter options for the Pulse toolbar's Stage / Candidates dropdowns —
 * the job's real sub-stages and the candidates actually in its pipeline. */
export function buildPulseFilterOptions(
  subStages: JobWorkflowSubStageWithLinks[],
  applications: PipelineApplication[]
): { stages: { id: string; name: string }[]; candidates: { id: string; name: string }[] } {
  const candidates = new Map<string, string>()
  for (const app of applications) {
    if (app.candidate) candidates.set(app.candidate_id, candidateName(app.candidate))
  }
  return {
    stages: subStages.map((s) => ({ id: s.id, name: s.name })),
    candidates: [...candidates].map(([id, name]) => ({ id, name })),
  }
}
