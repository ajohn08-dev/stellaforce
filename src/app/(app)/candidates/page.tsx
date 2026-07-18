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
      className="flex flex-col overflow-hidden"
      // Inline style, not an arbitrary Tailwind class: <main> has no padding
      // of its own — every section below manages its own — so only the app
      // header (h-14 = 3.5rem) needs subtracting. Fixed (not min-) height so
      // the header stays put and only the grid/table body below it scrolls.
      style={{ height: "calc(100vh - 3.5rem)" }}
    >
      <div className="shrink-0 border-b border-border px-4 py-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <CandidateSearch />
            <CandidateFilterButton />
          </div>
          <AddCandidateDialog />
        </div>
      </div>

      <div className="shrink-0 space-y-6 px-4 pt-4">
        <SupabaseNotice />
        <div className="flex items-center justify-between gap-4">
          <div>
            <CandidateActiveFilters />
          </div>
          <ViewToggle />
        </div>
      </div>

      <div className="min-h-0 flex-1 p-4">
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
