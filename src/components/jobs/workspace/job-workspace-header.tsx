import { Building2, MapPin } from "lucide-react"

import { JobStatusBadge } from "@/components/jobs/job-status-badge"
import { JobActions } from "@/components/jobs/job-actions"
import { AddCandidateToJobButton } from "@/components/jobs/workspace/add-candidate-to-job-button"
import type { MockJob } from "@/lib/mock-jobs"

export function JobWorkspaceHeader({ job }: { job: MockJob }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            {job.title}
          </h1>
          <JobStatusBadge status={job.status} />
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <Building2 className="size-4 shrink-0" />
          <span>{job.client_name}</span>
          <span>•</span>
          <MapPin className="size-4 shrink-0" />
          <span>{job.location}</span>
          <span>•</span>
          <span>
            {job.openings} opening{job.openings === 1 ? "" : "s"}
          </span>
          <span>•</span>
          <span>Recruiter: {job.recruiter}</span>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {job.status === "open" && <AddCandidateToJobButton />}
        <JobActions job={job} />
      </div>
    </div>
  )
}
