import { JobsTable } from "@/components/jobs/jobs-table"
import { JobsGrid } from "@/components/jobs/jobs-grid"
import { JobSearch } from "@/components/jobs/job-search"
import { JobFilterButton } from "@/components/jobs/job-filter-button"
import { JobActiveFilters } from "@/components/jobs/job-active-filters"
import { AddJobDialog } from "@/components/jobs/add-job-dialog"
import { JobViewToggle } from "@/components/jobs/job-view-toggle"
import { parseStatusesParam } from "@/lib/job-status"
import { MOCK_JOBS } from "@/lib/mock-jobs"

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = await searchParams
  const get = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined)

  const statuses = parseStatusesParam(get("statuses") ?? null)
  const q = get("q")?.trim().toLowerCase()

  const jobs = MOCK_JOBS.filter((job) => {
    if (!statuses.includes(job.status)) return false
    if (q) {
      const haystack = `${job.title} ${job.client_name}`.toLowerCase()
      if (!haystack.includes(q)) return false
    }
    return true
  })

  const view = get("view") === "grid" ? "grid" : "list"

  return (
    <div
      className="flex flex-col gap-6 overflow-hidden"
      // Inline style, not an arbitrary Tailwind class: matches the same
      // "main's padding + app header" subtraction used on the candidate
      // profile page. Fixed (not min-) height so the header stays put and
      // only the grid/table body below it scrolls.
      style={{ height: "calc(100vh - 7.5rem)" }}
    >
      <div className="shrink-0 space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Jobs</h1>
            <p className="text-sm text-muted-foreground">
              {jobs.length} job{jobs.length === 1 ? "" : "s"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <JobSearch />
            <JobFilterButton />
            <JobViewToggle />
            <AddJobDialog />
          </div>
        </div>

        <JobActiveFilters />
      </div>

      <div className="min-h-0 flex-1">
        {view === "grid" ? (
          <div className="h-full overflow-y-auto">
            <JobsGrid data={jobs} />
          </div>
        ) : (
          <JobsTable data={jobs} />
        )}
      </div>
    </div>
  )
}
