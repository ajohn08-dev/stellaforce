import { notFound } from "next/navigation"

import { JobDraftSpace } from "@/components/jobs/draft/job-draft-space"
import { JobWorkspaceHeader } from "@/components/jobs/workspace/job-workspace-header"
import { JobWorkspaceTabs } from "@/components/jobs/workspace/job-workspace-tabs"
import { SetJobBreadcrumb } from "@/components/jobs/workspace/set-job-breadcrumb"
import { titleCase } from "@/lib/constants"
import {
  getApplicationActivity,
  getApplicationEvaluations,
  getApplicationScorecards,
  getApplicationStageHistory,
  getCandidates,
  getJobActivity,
  getJobCompetencies,
  getJobOrder,
  getJobPipeline,
  getJobScorecard,
  getJobTargetCompanies,
  getJobTeamMembers,
  getJobWorkflowSubStages,
  getWorkflowTemplates,
} from "@/lib/data"
import { getCurrentProfile } from "@/lib/auth"
import { buildJobEvalContext, toBoardStages, toMockJob } from "@/lib/job-adapter"
import {
  buildPulseActions,
  buildPulseEvents,
  buildPulseFilterOptions,
  buildPulseStats,
} from "@/lib/job-pulse"

export default async function JobWorkspacePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ edit?: string }>
}) {
  const { id } = await params
  const { edit } = await searchParams
  const job = await getJobOrder(id)
  if (!job) notFound()

  const mockJob = toMockJob(job, { candidatesInPipeline: job.applications.length })
  const hasCandidates = job.applications.length > 0

  // Draft → the 5-step setup wizard. Published jobs can also re-enter the
  // same wizard (via "Edit job" → ?edit=1) to edit in place — the workflow
  // template picker locks itself once hasCandidates is true (see
  // WorkflowStep), and the final step becomes "Done" instead of "Publish
  // job" (see JobDraftSpace).
  const isPublished = job.status === "open"
  if (job.status === "draft" || (isPublished && edit === "1")) {
    const profile = await getCurrentProfile()
    const [templates, targetCompanies, competencies, scorecard, teamMembers, workflowSubStages] =
      await Promise.all([
        getWorkflowTemplates({ clientId: profile?.client_id ?? null }),
        getJobTargetCompanies(id),
        getJobCompetencies(id),
        getJobScorecard(id),
        getJobTeamMembers(id),
        getJobWorkflowSubStages(id),
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
          competenciesInitial={competencies}
          scorecardInitial={scorecard}
          membersInitial={teamMembers.map((m) => ({
            id: m.id,
            name: m.name,
            email: m.email,
            role: m.role,
          }))}
          workflowTemplateIdInitial={job.workflow_template_id}
          workflowSubStagesInitial={workflowSubStages}
          isPublished={isPublished}
          hasCandidates={hasCandidates}
        />
      </>
    )
  }

  // Published/open → the pipeline board fed by real applications.
  const [pipeline, candidates, teamMembers, subStages, competencies, scorecardCategories] =
    await Promise.all([
      getJobPipeline(id),
      getCandidates(),
      getJobTeamMembers(id),
      getJobWorkflowSubStages(id),
      getJobCompetencies(id),
      getJobScorecard(id),
    ])
  const applicationIds = pipeline.applications.map((a) => a.application_id)
  const [evaluations, scorecards, activity, jobActivity, stageHistory] = await Promise.all([
    getApplicationEvaluations(applicationIds),
    getApplicationScorecards(applicationIds),
    getApplicationActivity(applicationIds),
    getJobActivity(id),
    getApplicationStageHistory(applicationIds),
  ])
  const jobEvalContext = buildJobEvalContext(
    subStages,
    competencies,
    scorecardCategories,
    evaluations,
    scorecards,
    activity
  )
  // Request-time timestamp for "days in stage" — legitimate in a server render.
  // eslint-disable-next-line react-hooks/purity
  const nowMs = Date.now()
  const stages = toBoardStages(pipeline, nowMs)
  const pulseStats = buildPulseStats({
    jobCreatedAt: job.created_at,
    events: jobActivity,
    applications: pipeline.applications,
    stageHistory,
    nowMs,
  })
  const pulseEvents = buildPulseEvents(jobActivity)
  const pulseActions = buildPulseActions({
    applications: pipeline.applications,
    subStages,
    evaluations,
    events: jobActivity,
    nowMs,
  })
  const pulseFilters = buildPulseFilterOptions(subStages, pipeline.applications)
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
        <JobWorkspaceHeader
          job={mockJob}
          jobId={id}
          candidateOptions={candidateOptions}
          teamMembers={teamMembers}
        />
      </div>
      <div className="min-h-0 flex-1">
        <JobWorkspaceTabs
          stats={pulseStats}
          events={pulseEvents}
          actions={pulseActions}
          stageOptions={pulseFilters.stages}
          candidateOptions={pulseFilters.candidates}
          stages={stages}
          jobEvalContext={jobEvalContext}
        />
      </div>
    </div>
  )
}
