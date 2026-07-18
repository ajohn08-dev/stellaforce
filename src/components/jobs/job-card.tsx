import { Building2, MapPin } from "lucide-react"

import { Checkbox } from "@/components/ui/checkbox"
import { JobStatusBadge } from "@/components/jobs/job-status-badge"
import { JobActions } from "@/components/jobs/job-actions"
import { JobPipelineStages } from "@/components/jobs/job-pipeline-stages"
import type { MockJob } from "@/lib/mock-jobs"

export function JobCard({ job }: { job: MockJob }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Checkbox aria-label={`Select ${job.title}`} />
          <span className="font-semibold">{job.title}</span>
          <JobStatusBadge status={job.status} />
          <span className="text-muted-foreground">•</span>
          <Building2 className="size-4 shrink-0 text-muted-foreground" />
          <span>{job.client_name}</span>
          <span className="text-muted-foreground">•</span>
          <MapPin className="size-4 shrink-0 text-muted-foreground" />
          <span className="text-muted-foreground">{job.location}</span>
          <span className="text-muted-foreground">•</span>
          <span className="text-muted-foreground">
            {job.openings} opening{job.openings === 1 ? "" : "s"}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <span className="text-sm text-muted-foreground">
            Recruiter: {job.recruiter}
          </span>
          <JobActions job={job} />
        </div>
      </div>

      <JobPipelineStages pipeline={job.pipeline} />
    </div>
  )
}
