"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { ChevronDown, X } from "lucide-react"

import { TierFilterMenu, ALL_TIER } from "@/components/candidates/tier-filter-menu"
import { titleCase } from "@/lib/constants"

/** Row of removable/editable pills for currently active filters, shown above the list. */
export function CandidateActiveFilters() {
  const router = useRouter()
  const params = useSearchParams()
  const tier = params.get("tier") ?? ALL_TIER

  if (tier === ALL_TIER) return null

  function apply(next: string) {
    const sp = new URLSearchParams(params.toString())
    if (next !== ALL_TIER) sp.set("tier", next)
    else sp.delete("tier")
    router.push(`/candidates?${sp.toString()}`)
  }

  return (
    <div className="flex items-center gap-2">
      <div className="inline-flex items-center gap-1 rounded-full border border-border bg-muted py-1 pr-1 pl-3 text-xs font-medium">
        <TierFilterMenu
          tier={tier}
          onSelect={apply}
          align="start"
          trigger={
            <button type="button" className="flex items-center gap-1">
              Tier: {titleCase(tier)}
              <ChevronDown className="size-3" />
            </button>
          }
        />
        <button
          type="button"
          aria-label="Clear tier filter"
          onClick={() => apply(ALL_TIER)}
          className="rounded-full p-0.5 text-muted-foreground hover:bg-background hover:text-foreground"
        >
          <X className="size-3" />
        </button>
      </div>
    </div>
  )
}
