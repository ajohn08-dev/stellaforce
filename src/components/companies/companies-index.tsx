"use client"

import * as React from "react"
import Link from "next/link"
import { Building2, Plus, Search } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { CompaniesCards } from "@/components/companies/companies-cards"
import { CompaniesTable } from "@/components/companies/companies-table"
import { CompanyViewToggle } from "@/components/companies/company-view-toggle"
import type { CompanyListItem } from "@/components/companies/company-list-item"
import { READINESS_LABELS, type ReadinessStatus } from "@/lib/company-readiness"

const FILTERS: { key: ReadinessStatus | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "blocked", label: READINESS_LABELS.blocked },
  { key: "review_required", label: READINESS_LABELS.review_required },
  { key: "ready_with_caveats", label: READINESS_LABELS.ready_with_caveats },
  { key: "ready", label: READINESS_LABELS.ready },
]

/**
 * Toolbar plus whichever view is active. Search and the readiness filter live
 * here rather than inside either view, so switching between list and cards keeps
 * your scope.
 */
export function CompaniesIndex({
  companies,
  view,
}: {
  companies: CompanyListItem[]
  view: "list" | "grid"
}) {
  const [query, setQuery] = React.useState("")
  const [filter, setFilter] = React.useState<ReadinessStatus | "all">("all")

  const visible = companies.filter((c) => {
    if (filter !== "all" && c.readiness !== filter) return false
    const q = query.trim().toLowerCase()
    if (!q) return true
    return `${c.name} ${c.industry ?? ""} ${c.headquarters ?? ""} ${c.accountOwner}`
      .toLowerCase()
      .includes(q)
  })

  const counts = companies.reduce<Record<string, number>>((acc, c) => {
    acc[c.readiness] = (acc[c.readiness] ?? 0) + 1
    return acc
  }, {})

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search companies"
            aria-label="Search companies"
            className="pl-8"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1">
          {FILTERS.map((f) => {
            const count = f.key === "all" ? companies.length : (counts[f.key] ?? 0)
            if (f.key !== "all" && count === 0) return null
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                className={cn(
                  "rounded-md px-2.5 py-1.5 text-sm transition-colors",
                  filter === f.key
                    ? "bg-muted font-medium text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {f.label}
                <span className="ml-1.5 text-xs tabular-nums">{count}</span>
              </button>
            )
          })}
        </div>

        <div className="ml-auto">
          <CompanyViewToggle />
        </div>
      </div>

      {visible.length === 0 ? (
        <EmptyState hasCompanies={companies.length > 0} />
      ) : view === "grid" ? (
        <CompaniesCards companies={visible} />
      ) : (
        <CompaniesTable data={visible} />
      )}
    </div>
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
