import Link from "next/link"
import { Briefcase } from "lucide-react"

import { Progress } from "@/components/ui/progress"
import { CompanyLogo } from "@/components/companies/company-logo"
import { ReadinessPill } from "@/components/companies/shared/readiness-pill"
import type { CompanyListItem } from "@/components/companies/company-list-item"
import { COMPANY_STAGE_LABELS } from "@/lib/mock-companies"

/** The alternate `?view=grid` view. Roomier per row, better for browsing. */
export function CompaniesCards({ companies }: { companies: CompanyListItem[] }) {
  return (
    <ul className="grid gap-3 lg:grid-cols-2">
      {companies.map((company) => (
        <li key={company.id}>
          <Link
            href={`/companies/${company.id}`}
            className="flex h-full flex-col gap-3 rounded-lg border border-border p-4 transition-colors hover:border-foreground/20 hover:bg-muted/40"
          >
            <div className="flex items-start gap-3">
              <CompanyLogo name={company.name} logoPath={company.logoPath} />

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{company.name}</span>
                  <ReadinessPill status={company.readiness} size="sm" />
                </div>
                <p className="mt-0.5 truncate text-sm text-muted-foreground">
                  {[
                    company.industry,
                    company.stage ? COMPANY_STAGE_LABELS[company.stage] : null,
                    company.headquarters,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
            </div>

            <p className="text-sm text-muted-foreground">{company.readinessHeadline}</p>

            <div className="mt-auto space-y-2">
              <div className="flex items-baseline justify-between gap-2 text-xs text-muted-foreground">
                <span>Profile complete</span>
                <span className="font-medium tabular-nums text-foreground">
                  {company.completeness}%
                </span>
              </div>
              <Progress
                value={company.completeness}
                aria-label={`Profile ${company.completeness}% complete`}
              />

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Briefcase className="size-3" />
                  {company.activeJobCount} active job
                  {company.activeJobCount === 1 ? "" : "s"}
                </span>
                <span>Owner: {company.accountOwner}</span>
                <span>
                  {company.lastVerified
                    ? `Last verified ${company.lastVerified}`
                    : "Never verified"}
                </span>
              </div>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  )
}
