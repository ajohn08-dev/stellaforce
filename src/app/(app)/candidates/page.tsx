import { CandidatesTable } from "@/components/candidates/candidates-table"
import { CandidatesGrid } from "@/components/candidates/candidates-grid"
import { CandidateSearch } from "@/components/candidates/candidate-search"
import { CandidateFilterButton } from "@/components/candidates/candidate-filter-button"
import { CandidateActiveFilters } from "@/components/candidates/candidate-active-filters"
import { AddCandidateDialog } from "@/components/candidates/add-candidate-dialog"
import { ViewToggle } from "@/components/candidates/view-toggle"
import { SupabaseNotice } from "@/components/supabase-notice"
import { parseTiersParam } from "@/lib/candidate-tiers"
import { getCandidates } from "@/lib/data"

export default async function CandidatesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = await searchParams
  const get = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined)

  const candidates = await getCandidates({
    tiers: parseTiersParam(get("tiers") ?? null),
    q: get("q"),
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
            <h1 className="text-2xl font-semibold tracking-tight">Candidates</h1>
            <p className="text-sm text-muted-foreground">
              {candidates.length} candidate{candidates.length === 1 ? "" : "s"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <CandidateSearch />
            <CandidateFilterButton />
            <ViewToggle />
            <AddCandidateDialog />
          </div>
        </div>

        <SupabaseNotice />
        <CandidateActiveFilters />
      </div>

      <div className="min-h-0 flex-1">
        {view === "grid" ? (
          <div className="h-full overflow-y-auto">
            <CandidatesGrid data={candidates} />
          </div>
        ) : (
          <CandidatesTable data={candidates} />
        )}
      </div>
    </div>
  )
}
