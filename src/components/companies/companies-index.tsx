import Link from "next/link"
import { Building2, Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { CompaniesCards } from "@/components/companies/companies-cards"
import { CompaniesTable } from "@/components/companies/companies-table"
import type { CompanyListItem } from "@/components/companies/company-list-item"

/**
 * Whichever view is active, and nothing else.
 *
 * The toolbar moved out to the page: search, the readiness pills, and the view
 * toggle are all `?` params now, filtered server-side, matching `/jobs`. They
 * used to be component state alongside a URL-driven view toggle, so switching
 * between table and cards remounted this component and silently dropped your
 * search and filter — which the old comment here claimed it preserved.
 */
export function CompaniesIndex({
  companies,
  hasAny,
  view,
}: {
  companies: CompanyListItem[]
  /** False only when the account has no companies at all, versus none matching. */
  hasAny: boolean
  view: "list" | "grid"
}) {
  if (companies.length === 0) return <EmptyState hasCompanies={hasAny} />

  return view === "grid" ? (
    <div className="h-full overflow-y-auto">
      <CompaniesCards companies={companies} />
    </div>
  ) : (
    <CompaniesTable data={companies} />
  )
}

function EmptyState({ hasCompanies }: { hasCompanies: boolean }) {
  return (
    <div className="rounded-lg border border-dashed border-border p-12 text-center">
      <Building2 className="mx-auto size-8 text-muted-foreground" />
      <p className="mt-3 font-medium">
        {hasCompanies ? "No matching companies" : "No companies yet"}
      </p>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
        {hasCompanies
          ? "Try a different search, or clear the readiness filter."
          : "Add your first company after a client intake call — a name and an industry are enough to start."}
      </p>
      {!hasCompanies && (
        <Button className="mt-4 gap-1.5" render={<Link href="/companies/new" />}>
          <Plus className="size-4" />
          Add company
        </Button>
      )}
    </div>
  )
}
