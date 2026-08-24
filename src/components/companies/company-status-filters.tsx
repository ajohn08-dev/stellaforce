"use client"

import { useRouter, useSearchParams } from "next/navigation"

import { cn } from "@/lib/utils"
import {
  READINESS_TONE_LABELS,
  READINESS_TONE_ORDER,
  type ReadinessTone,
} from "@/lib/company-readiness"

/**
 * Readiness filter pills, in the row Jobs uses for its active filters.
 *
 * **URL-driven, and that's the fix.** These were component state while the view
 * toggle was a `?view=` param, so switching between table and cards remounted
 * the toolbar and silently dropped your filter and search — the opposite of what
 * the code claimed. One source of truth for scope, shareable, and consistent
 * with every other list in the app.
 */
export function CompanyStatusFilters({
  counts,
  total,
}: {
  /** Keyed by tone, not status — `ready` and `ready_with_caveats` are one pill. */
  counts: Partial<Record<ReadinessTone, number>>
  total: number
}) {
  const router = useRouter()
  const params = useSearchParams()
  const active = params.get("status")

  function select(next: ReadinessTone | null) {
    const sp = new URLSearchParams(params.toString())
    if (next) sp.set("status", next)
    else sp.delete("status")
    router.push(`/companies?${sp.toString()}`)
  }

  const pills: { key: ReadinessTone | null; label: string; count: number }[] = [
    { key: null, label: "All", count: total },
    ...READINESS_TONE_ORDER.filter((t) => (counts[t] ?? 0) > 0).map((t) => ({
      key: t,
      label: READINESS_TONE_LABELS[t],
      count: counts[t] ?? 0,
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
