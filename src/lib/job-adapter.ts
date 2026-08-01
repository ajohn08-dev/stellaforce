import type {
  ApplicationRow,
  CandidateRow,
  CandidateTier,
  ClientRow,
  JobOrderRow,
  JobWorkflowSubStageRow,
  PipelineStageRow,
} from "@/lib/supabase/types"
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
