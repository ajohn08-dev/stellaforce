import { notFound } from "next/navigation"

import { JobDraftSpace } from "@/components/jobs/draft/job-draft-space"
import { JobWorkspaceHeader } from "@/components/jobs/workspace/job-workspace-header"
import { PipelineBoard } from "@/components/jobs/workspace/pipeline-board"
import { SetJobBreadcrumb } from "@/components/jobs/workspace/set-job-breadcrumb"
import { titleCase } from "@/lib/constants"
import {
  getCandidates,
  getJobOrder,
  getJobPipeline,
  getJobTargetCompanies,
  getWorkflowTemplates,
} from "@/lib/data"
import { getCurrentProfile } from "@/lib/auth"
import { toBoardStages, toMockJob } from "@/lib/job-adapter"

export default async function JobWorkspacePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const job = await getJobOrder(id)
  if (!job) notFound()

  const mockJob = toMockJob(job, { candidatesInPipeline: job.applications.length })

  // Draft → the 5-step setup wizard, pre-filled with any AI-generated role data.
  if (job.status === "draft") {
    const profile = await getCurrentProfile()
    const [templates, targetCompanies] = await Promise.all([
      getWorkflowTemplates({ clientId: profile?.client_id ?? null }),
      getJobTargetCompanies(id),
    ])
    const roleInitial = {
      title: job.title,
      workplace_type: job.workplace_type,
      office_location: job.office_location,
      description: job.description,
      company: job.company,
      industry: job.industry,
      job_function: job.job_function,
      employment_type: job.employment_type,
      experience_required: job.experience_required,
      education_required: job.education_required,
      salary_from: job.salary_from,
      salary_to: job.salary_to,
      salary_currency: job.salary_currency,
      target_companies: targetCompanies,
    }
    return (
      <>
        <SetJobBreadcrumb title={job.title} badge={titleCase(job.status)} />
        <JobDraftSpace
          job={mockJob}
          templates={templates.map((t) => ({ id: t.id, name: t.name, status: t.status }))}
          roleInitial={roleInitial}
        />
      </>
    )
  }

  // Published/open → the pipeline board fed by real applications.
  const [pipeline, candidates] = await Promise.all([getJobPipeline(id), getCandidates()])
  // Request-time timestamp for "days in stage" — legitimate in a server render.
  // eslint-disable-next-line react-hooks/purity
  const nowMs = Date.now()
  const stages = toBoardStages(pipeline, nowMs)
  const inPipeline = new Set(pipeline.applications.map((a) => a.candidate_id))
  const candidateOptions = candidates
    .filter((c) => !inPipeline.has(c.candidate_id))
    .map((c) => ({
      id: c.candidate_id,
      name: c.full_name ?? `${c.first_name} ${c.last_name}`.trim(),
      title: c.currentRole?.title ?? c.current_title ?? "",
    }))

  return (
    <div className="flex flex-col overflow-hidden p-4" style={{ height: "calc(100vh - 3.5rem)" }}>
      <SetJobBreadcrumb title={job.title} />
      <div className="shrink-0 pb-4">
        <JobWorkspaceHeader job={mockJob} jobId={id} candidateOptions={candidateOptions} />
      </div>
      <div className="min-h-0 flex-1">
        <PipelineBoard stages={stages} />
      </div>
    </div>
  )
}
