import Link from "next/link"
import { allAnswers } from "@/lib/company-inheritance"
import { Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { CompaniesIndex } from "@/components/companies/companies-index"
import { CompanySearch } from "@/components/companies/company-search"
import { CompanyStatusFilters } from "@/components/companies/company-status-filters"
import { CompanyViewToggle } from "@/components/companies/company-view-toggle"
import type { CompanyListItem } from "@/components/companies/company-list-item"
import { formatDate } from "@/lib/constants"
import { evaluateReadiness } from "@/lib/company-readiness"
import { MOCK_COMPANIES } from "@/lib/mock-companies"

/**
 * The company knowledge base — see COMPANY.md.
 *
 * Renders from `MOCK_COMPANIES`, not from the `clients` table: this is a UI
 * preview and no schema exists for company knowledge yet. Readiness is computed
 * here, server-side, following the same split as `/jobs/[id]` and
 * `src/lib/job-pulse.ts`.
 */
export default async function CompaniesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = await searchParams
  const view = sp.view === "grid" ? "grid" : "list"
  const today = new Date()

  const companies: CompanyListItem[] = MOCK_COMPANIES.map((company) => {
    const readiness = evaluateReadiness(company, today)

    // The most recently verified item anywhere in the profile — a single
    // "how current is this account" signal.
    const lastVerified = [...company.knowledge, ...company.policies, ...allAnswers(company).map((a) => a.answer)]
      .map((i) => i.visibility.lastVerifiedAt)
      .filter((d): d is string => Boolean(d))
      .sort()
      .at(-1)

    return {
      id: company.id,
      name: company.preferredName,
      logoPath: company.logoPath,
      industry: company.industry,
      stage: company.stage,
      headquarters: company.headquarters,
      accountOwner: company.accountOwner,
      activeJobCount: company.jobs.filter(
        (j) => j.status === "open" || j.status === "draft"
      ).length,
      completeness: readiness.completeness.overall,
      readiness: readiness.status,
      readinessHeadline: readiness.headline,
      lastVerified: lastVerified ? formatDate(lastVerified) : null,
    }
  })

  const q = (typeof sp.q === "string" ? sp.q : "").trim().toLowerCase()
  const status = typeof sp.status === "string" ? sp.status : null

  const counts = companies.reduce<Record<string, number>>((acc, c) => {
    acc[c.readiness] = (acc[c.readiness] ?? 0) + 1
    return acc
  }, {})

  const visible = companies.filter((c) => {
    if (status && c.readiness !== status) return false
    if (!q) return true
    return `${c.name} ${c.industry ?? ""} ${c.headquarters ?? ""} ${c.accountOwner}`
      .toLowerCase()
      .includes(q)
  })

  return (
    // Same shell as /jobs: a bordered toolbar strip, a filter row, then a body
    // that scrolls on its own. The page title lived here as an <h1> duplicating
    // the breadcrumb in the app header, with a subtitle explaining what company
    // knowledge is for — orientation that belongs in the docs, not above every
    // visit to a list someone opens daily.
    <div
      className="flex flex-col overflow-hidden"
      style={{ height: "calc(100vh - 3.5rem)" }}
    >
      <div className="shrink-0 border-b border-border px-4 py-4">
        <div className="flex items-center justify-between gap-4">
          <CompanySearch />
          <Button className="gap-1.5" render={<Link href="/companies/new" />}>
            <Plus className="size-4" />
            Add company
          </Button>
        </div>
      </div>

      <div className="shrink-0 px-4 pt-4">
        <div className="flex items-center justify-between gap-4">
          <CompanyStatusFilters counts={counts} total={companies.length} />
          <CompanyViewToggle />
        </div>
      </div>

      <div className="min-h-0 flex-1 p-4">
        <CompaniesIndex
          companies={visible}
          hasAny={companies.length > 0}
          view={view}
        />
      </div>
    </div>
  )
}
