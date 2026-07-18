import { JobCard } from "@/components/jobs/job-card"
import type { MockJob } from "@/lib/mock-jobs"

export function JobsGrid({ data }: { data: MockJob[] }) {
  if (data.length === 0) {
    return (
      <div className="rounded-lg border border-border p-10 text-center text-sm text-muted-foreground">
        No jobs found.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {data.map((job) => (
        <JobCard key={job.job_id} job={job} />
      ))}
    </div>
  )
}
