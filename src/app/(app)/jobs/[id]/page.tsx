import { notFound } from "next/navigation"

import { JobDraftSpace } from "@/components/jobs/draft/job-draft-space"
import { JobWorkspaceHeader } from "@/components/jobs/workspace/job-workspace-header"
import { PipelineBoard } from "@/components/jobs/workspace/pipeline-board"
import { SetJobBreadcrumb } from "@/components/jobs/workspace/set-job-breadcrumb"
import { titleCase } from "@/lib/constants"
import { getSubStageBoard } from "@/lib/pipeline-candidates"
import { MOCK_JOBS } from "@/lib/mock-jobs"

/**
 * UI-preview data only — renders from MOCK_JOBS (src/lib/mock-jobs.ts), not
 * job_orders/applications. See CandidatesTable's real-data equivalent for
 * how this would eventually be wired to Supabase.
 */
export default async function JobWorkspacePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const job = MOCK_JOBS.find((j) => j.job_id === id)
  if (!job) notFound()

  if (job.status === "draft") {
    return (
      <>
        <SetJobBreadcrumb title={job.title} badge={titleCase(job.status)} />
        <JobDraftSpace job={job} />
      </>
    )
  }

  const stages = getSubStageBoard(job)

  return (
    <div
      className="flex flex-col overflow-hidden p-4"
      // Inline style, not an arbitrary Tailwind class: <main> has no padding
      // of its own, so only the app header (h-14 = 3.5rem) needs
      // subtracting — this div's own p-4 is included via border-box. Fixed
      // (not min-) height so the header stays put and the pipeline board
      // fills the rest.
      style={{ height: "calc(100vh - 3.5rem)" }}
    >
      <SetJobBreadcrumb title={job.title} />
      <div className="shrink-0 pb-4">
        <JobWorkspaceHeader job={job} />
      </div>
      <div className="min-h-0 flex-1">
        <PipelineBoard stages={stages} />
      </div>
    </div>
  )
}
