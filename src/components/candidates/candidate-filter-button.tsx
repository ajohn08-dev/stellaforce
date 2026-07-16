"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { Filter } from "lucide-react"

import { Button } from "@/components/ui/button"
import { TierFilterMenu, ALL_TIER } from "@/components/candidates/tier-filter-menu"

export function CandidateFilterButton() {
  const router = useRouter()
  const params = useSearchParams()
  const tier = params.get("tier") ?? ALL_TIER

  function apply(next: string) {
    const sp = new URLSearchParams(params.toString())
    if (next !== ALL_TIER) sp.set("tier", next)
    else sp.delete("tier")
    router.push(`/candidates?${sp.toString()}`)
  }

  return (
    <TierFilterMenu
      tier={tier}
      onSelect={apply}
      trigger={
        <Button
          type="button"
          variant={tier !== ALL_TIER ? "secondary" : "outline"}
          className="gap-1.5"
        >
          <Filter className="size-4" />
          Filter
        </Button>
      }
    />
  )
}
