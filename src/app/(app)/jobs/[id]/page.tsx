import { notFound } from "next/navigation"

import { JobWorkspaceHeader } from "@/components/jobs/workspace/job-workspace-header"
import { PipelineBoard } from "@/components/jobs/workspace/pipeline-board"
import { SetJobBreadcrumb } from "@/components/jobs/workspace/set-job-breadcrumb"
import { getPipelineCandidates } from "@/lib/pipeline-candidates"
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

  const pipeline = getPipelineCandidates(job)

  return (
    <div className="space-y-6 p-4">
      <SetJobBreadcrumb title={job.title} />
      <JobWorkspaceHeader job={job} />
      <PipelineBoard pipeline={pipeline} />
    </div>
  )
}
