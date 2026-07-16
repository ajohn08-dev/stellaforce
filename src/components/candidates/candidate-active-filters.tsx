"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { ChevronDown, X } from "lucide-react"

import { TierFilterMenu } from "@/components/candidates/tier-filter-menu"
import { TIER_OPTIONS, parseTiersParam, tiersToParam } from "@/lib/candidate-tiers"
import { titleCase } from "@/lib/constants"

/** Row of removable/editable pills for currently active filters, shown above the list. */
export function CandidateActiveFilters() {
  const router = useRouter()
  const params = useSearchParams()
  const tiers = parseTiersParam(params.get("tiers"))

  if (tiers.length === 0) return null

  function setTiers(next: string[]) {
    const sp = new URLSearchParams(params.toString())
    sp.set("tiers", tiersToParam(next))
    router.push(`/candidates?${sp.toString()}`)
  }

  const label = TIER_OPTIONS.filter((t) => tiers.includes(t))
    .map(titleCase)
    .join(", ")

  return (
    <div className="flex items-center gap-2">
      <div className="inline-flex items-center gap-1 rounded-full bg-accent py-1 pr-1 pl-3 text-xs font-medium text-accent-foreground">
        <TierFilterMenu
          selected={tiers}
          align="start"
          onChange={setTiers}
          trigger={
            <button type="button" className="flex items-center gap-1">
              Tiers: {label}
              <ChevronDown className="size-3" />
            </button>
          }
        />
        <span className="h-4 w-px bg-accent-foreground/20" aria-hidden />
        <button
          type="button"
          aria-label="Remove tier filter"
          onClick={() => setTiers([])}
          className="rounded-full p-1 hover:bg-accent-foreground/10"
        >
          <X className="size-3" />
        </button>
      </div>
    </div>
  )
}
