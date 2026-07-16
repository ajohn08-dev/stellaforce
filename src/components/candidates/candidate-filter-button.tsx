"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { Filter } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { TierFilterSubmenuItem } from "@/components/candidates/tier-filter-menu"
import { parseTiersParam, tiersToParam } from "@/lib/candidate-tiers"

/**
 * "Filter" opens a menu of filterable fields (currently just Tiers — more
 * are coming). Each field cascades its own options into a submenu rather
 * than exposing them directly here.
 */
export function CandidateFilterButton() {
  const router = useRouter()
  const params = useSearchParams()
  const tiers = parseTiersParam(params.get("tiers"))

  function setTiers(next: string[]) {
    const sp = new URLSearchParams(params.toString())
    sp.set("tiers", tiersToParam(next))
    router.push(`/candidates?${sp.toString()}`)
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
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
