"use client"

import * as React from "react"
import { Check } from "lucide-react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { titleCase } from "@/lib/constants"

export const ALL_TIER = "all"
export const TIER_OPTIONS = ["gold", "silver"] as const

/** Shared All/Gold/Silver dropdown content, opened from any trigger element. */
export function TierFilterMenu({
  tier,
  onSelect,
  trigger,
  align = "end",
}: {
  tier: string
  onSelect: (tier: string) => void
  trigger: React.ReactElement
  align?: "start" | "end"
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={trigger} />
      <DropdownMenuContent align={align}>
        <DropdownMenuLabel>Tier</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {[ALL_TIER, ...TIER_OPTIONS].map((t) => (
          <DropdownMenuItem key={t} onClick={() => onSelect(t)}>
            <span className="flex-1">
              {t === ALL_TIER ? "All tiers" : titleCase(t)}
            </span>
            {tier === t && <Check className="size-4" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
