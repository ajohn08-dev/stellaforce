import type {
  ApplicationRow,
  CandidateRow,
  CandidateTier,
  ClientRow,
  JobOrderRow,
  JobWorkflowSubStageRow,
  PipelineStageRow,
} from "@/lib/supabase/types"
import type {
  ApplicationActivityEvent,
  ApplicationEvaluation,
  ApplicationScorecardCategory,
  JobWorkflowSubStageWithLinks,
} from "@/lib/data"
import type { Competency } from "@/components/jobs/draft/steps/competency-data"
import type { ScoreCardCategory } from "@/components/jobs/draft/steps/score-card-step"
import type { MockJob, PipelineCounts } from "@/lib/mock-jobs"
import type { PipelineCandidate, StageKey, SubStage } from "@/lib/pipeline-candidates"

const EMPTY_PIPELINE: PipelineCounts = { source: 0, screen: 0, interview: 0, offer: 0, close: 0 }

/**
 * Adapts a real `job_orders` row (+ its client join) to the `MockJob` shape the
 * jobs list / detail / board UI was built against, so those presentational
 * components can render real data without a rewrite. Fields that don't exist on
 * `job_orders` (openings, recruiter, live pipeline counts) fall back to sane
 * defaults; callers that have the numbers (e.g. from getJobPipeline) can pass
 * them in.
 */
export function toMockJob(
  job: JobOrderRow & { client?: ClientRow | null },
  opts: { candidatesInPipeline?: number; pipeline?: PipelineCounts } = {}
): MockJob {
  return {
    job_id: job.job_id,
    title: job.title,
    openings: 1,
    client_name: job.client?.client_name ?? "—",
    status: job.status,
    location: job.location ?? "",
    candidates_in_pipeline: opts.candidatesInPipeline ?? 0,
    recruiter: "",
    pipeline: opts.pipeline ?? EMPTY_PIPELINE,
  }
}

type PipelineData = {
  subStages: (JobWorkflowSubStageRow & { pipeline_stage: PipelineStageRow | null })[]
  applications: (ApplicationRow & { candidate: CandidateRow | null })[]
}

/**
 * Converts real `getJobPipeline` output into the `SubStage[]` the workspace
 * board renders: one column per snapshotted sub-stage, applications grouped by
 * `current_stage_id`. `nowMs` is passed in (not read inside) to keep this pure.
 */
export function toBoardStages(pipeline: PipelineData, nowMs: number): SubStage[] {
  const byStage = new Map<string, PipelineCandidate[]>()
  for (const app of pipeline.applications) {
    const c = app.candidate
    if (!app.current_stage_id || !c) continue
    const days = Math.max(0, Math.floor((nowMs - new Date(app.date_updated).getTime()) / 86_400_000))
    const card: PipelineCandidate = {
      candidate_id: c.candidate_id,
      application_id: app.application_id,
      current_stage_id: app.current_stage_id,
      full_name: c.full_name ?? `${c.first_name} ${c.last_name}`.trim(),
      tier: (c.candidate_tier ?? "bronze") as CandidateTier,
      days_in_stage: days,
      title: c.current_title ?? "",
      company: c.current_company ?? "",
      location: c.location_city ?? c.location_raw ?? "",
      summary: c.professional_summary ?? c.headline ?? "",
      skills: [],
      email: c.email ?? "",
      phone: c.phone ?? "",
      linkedin_url: c.linkedin_url ?? "",
      github_url: c.github_url ?? "",
    }
    const arr = byStage.get(app.current_stage_id) ?? []
    arr.push(card)
    byStage.set(app.current_stage_id, arr)
  }
  return pipeline.subStages.map((ss) => ({
    key: ss.id,
    name: ss.name,
    group: (ss.pipeline_stage?.key ?? "source") as StageKey,
    candidates: byStage.get(ss.id) ?? [],
  }))
}

/**
 * The sub-stages an application has actually reached: `currentStageId`'s
 * position in the job's real, snapshotted pipeline order and everything
 * before it. `subStages` must already be sorted by `sortByPipelineStage`
 * (both `getJobPipeline` and `getJobWorkflowSubStages` return it that way).
 * Drives what the pipeline board's Scorecard/Evaluation/Overview tabs are
 * allowed to show — stages after this point haven't happened yet.
 */
export function getReachedSubStages(
  subStages: JobWorkflowSubStageWithLinks[],
  currentStageId: string
): JobWorkflowSubStageWithLinks[] {
  const idx = subStages.findIndex((s) => s.id === currentStageId)
  return idx === -1 ? [] : subStages.slice(0, idx + 1)
}

export type ReachedScope = {
  /** Competency ids assessed by any reached sub-stage — what the Scorecard
   * tab is allowed to show evidence for. */
  reachedCompetencyIds: Set<string>
  /** Reached sub-stages minus the `source` group — sourcing isn't an
   * interview, so it never gets an Evaluation-tab card. */
  reachedEvaluableStages: { id: string; name: string }[]
  /** Name of the sub-stage the candidate is actually in, for empty-state copy. */
  currentStageName: string
}

/** Everything the Overview/Scorecard/Evaluation tabs need to know about how
 * far one application has progressed through the job's real pipeline. */
export function getReachedScope(
  subStages: JobWorkflowSubStageWithLinks[],
  currentStageId: string | undefined
): ReachedScope {
  const reached = currentStageId ? getReachedSubStages(subStages, currentStageId) : []
  return {
    reachedCompetencyIds: new Set(reached.flatMap((s) => s.competency_ids)),
    reachedEvaluableStages: reached
      .filter((s) => s.pipeline_stage?.key !== "source")
      .map((s) => ({ id: s.id, name: s.name })),
    currentStageName: reached.at(-1)?.name ?? "an unreached stage",
  }
}

/** A job's scorecard categories narrowed to competencies assessed by a
 * reached sub-stage; categories left with none are dropped entirely — the
 * candidate hasn't progressed far enough for that category to apply yet. */
export function filterReachedScorecardCategories(
  categories: ScoreCardCategory[],
  reachedCompetencyIds: Set<string>
): ScoreCardCategory[] {
  return categories
    .map((c) => ({
      ...c,
      competencyIds: c.competencyIds.filter((id) => reachedCompetencyIds.has(id)),
    }))
    .filter((c) => c.competencyIds.length > 0)
}

export type JobEvalContext = {
  subStages: JobWorkflowSubStageWithLinks[]
  competencies: Competency[]
  scorecardCategories: ScoreCardCategory[]
  evaluationsByApplication: Map<string, ApplicationEvaluation[]>
  scorecardByApplication: Map<string, ApplicationScorecardCategory[]>
  activityByApplication: Map<string, ApplicationActivityEvent[]>
}

/** Groups the job-wide template data + the batch-fetched real evaluation/
 * scorecard/activity rows by `application_id`, once per page load, so
 * selecting a candidate on the board is a local lookup rather than a
 * network round trip. */
export function buildJobEvalContext(
  subStages: JobWorkflowSubStageWithLinks[],
  competencies: Competency[],
  scorecardCategories: ScoreCardCategory[],
  evaluations: ApplicationEvaluation[],
  scorecards: ApplicationScorecardCategory[],
  activity: ApplicationActivityEvent[] = []
): JobEvalContext {
  const evaluationsByApplication = new Map<string, ApplicationEvaluation[]>()
  for (const e of evaluations) {
    evaluationsByApplication.set(e.application_id, [
      ...(evaluationsByApplication.get(e.application_id) ?? []),
      e,
    ])
  }
  const scorecardByApplication = new Map<string, ApplicationScorecardCategory[]>()
  for (const s of scorecards) {
    scorecardByApplication.set(s.application_id, [
      ...(scorecardByApplication.get(s.application_id) ?? []),
      s,
    ])
  }
  const activityByApplication = new Map<string, ApplicationActivityEvent[]>()
  for (const a of activity) {
    if (!a.application_id) continue
    activityByApplication.set(a.application_id, [
      ...(activityByApplication.get(a.application_id) ?? []),
      a,
    ])
  }
  return {
    subStages,
    competencies,
    scorecardCategories,
    evaluationsByApplication,
    scorecardByApplication,
    activityByApplication,
  }
}
