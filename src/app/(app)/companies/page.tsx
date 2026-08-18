import Link from "next/link"
import { allAnswers } from "@/lib/company-inheritance"
import { Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { CompaniesIndex } from "@/components/companies/companies-index"
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

  return (
    <div className="space-y-6 p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Companies</h1>
          <p className="text-sm text-muted-foreground">
            {companies.length} compan{companies.length === 1 ? "y" : "ies"} · company
            knowledge is reused by every job and grounds candidate-facing agents
          </p>
        </div>

        <Button className="gap-1.5" render={<Link href="/companies/new" />}>
          <Plus className="size-4" />
          Add company
        </Button>
      </div>

      <CompaniesIndex companies={companies} view={view} />
    </div>
  )
}
