"use client"

import { useRouter, useSearchParams } from "next/navigation"

import { cn } from "@/lib/utils"
import { READINESS_LABELS, type ReadinessStatus } from "@/lib/company-readiness"

/**
 * Readiness filter pills, in the row Jobs uses for its active filters.
 *
 * **URL-driven, and that's the fix.** These were component state while the view
 * toggle was a `?view=` param, so switching between table and cards remounted
 * the toolbar and silently dropped your filter and search — the opposite of what
 * the code claimed. One source of truth for scope, shareable, and consistent
 * with every other list in the app.
 */
const ORDER: ReadinessStatus[] = [
  "blocked",
  "review_required",
  "ready_with_caveats",
  "ready",
]

export function CompanyStatusFilters({
  counts,
  total,
}: {
  counts: Partial<Record<ReadinessStatus, number>>
  total: number
}) {
  const router = useRouter()
  const params = useSearchParams()
  const active = params.get("status")

  function select(next: ReadinessStatus | null) {
    const sp = new URLSearchParams(params.toString())
    if (next) sp.set("status", next)
    else sp.delete("status")
    router.push(`/companies?${sp.toString()}`)
  }

  const pills: { key: ReadinessStatus | null; label: string; count: number }[] = [
    { key: null, label: "All", count: total },
    ...ORDER.filter((s) => (counts[s] ?? 0) > 0).map((s) => ({
      key: s,
      label: READINESS_LABELS[s],
      count: counts[s] ?? 0,
    })),
  ]

  return (
    <div className="flex flex-wrap items-center gap-1">
      {pills.map((pill) => (
        <button
          key={pill.key ?? "all"}
          type="button"
          onClick={() => select(pill.key)}
          aria-pressed={active === (pill.key ?? null)}
          className={cn(
            "rounded-md px-2.5 py-1.5 text-sm transition-colors",
            (active ?? null) === pill.key
              ? "bg-muted font-medium text-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {pill.label}
          <span className="ml-1.5 text-xs tabular-nums">{pill.count}</span>
        </button>
      ))}
    </div>
  )
}
