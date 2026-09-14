"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { Filter, SlidersHorizontal } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { TierFilterSubmenuItem } from "@/components/candidates/tier-filter-menu"
import { parseTiersParam, tiersToParam } from "@/lib/candidate-tiers"

/**
 * "Filter" opens a menu of filterable fields (currently just Tiers — more
 * are coming). Each field cascades its own options into a submenu rather
 * than exposing them directly here.
 *
 * "Advanced Filter" is the exception and sits below a separator: it leaves the
 * page instead of narrowing it in place, which is a different enough action to
 * be worth separating from the fields above it. It shares a destination with
 * the ask bar pinned to the bottom of the list — one screen answers both
 * "filter this precisely" and "describe who you want", because they are the
 * same question asked two ways.
 */
export function CandidateFilterButton({
  /**
   * Advanced Search is Stellaforce-internal for V1, so client-side profiles
   * don't get the entry point. This only hides the menu item — the route and
   * its query both refuse server-side, which is what actually enforces it.
   */
  canUseAdvancedSearch = false,
}: {
  canUseAdvancedSearch?: boolean
} = {}) {
  const router = useRouter()
  const params = useSearchParams()
  const tiers = parseTiersParam(params.get("tiers"))

  function setTiers(next: string[]) {
    const sp = new URLSearchParams(params.toString())
    sp.set("tiers", tiersToParam(next))
    router.push(`/candidates?${sp.toString()}`)
  }

  // Carry whatever is already narrowing the list through to the advanced
  // screen. Arriving there to find the tier filter silently dropped would make
  // it read as a separate tool rather than a wider view of the same one.
  function openAdvancedFilter() {
    const qs = params.toString()
    router.push(`/candidates/search${qs ? `?${qs}` : ""}`)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button type="button" variant="outline" className="gap-1.5">
            <Filter className="size-4" />
            Filter
          </Button>
        }
      />
      <DropdownMenuContent>
        <TierFilterSubmenuItem selected={tiers} onChange={setTiers} />
        {canUseAdvancedSearch && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={openAdvancedFilter}>
              <SlidersHorizontal className="size-4" />
              <span className="flex-1">Advanced Filter</span>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
