"use client"

import type { ReactElement } from "react"
import { ChevronLeft } from "lucide-react"

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { titleCase } from "@/lib/constants"
import { TIER_OPTIONS } from "@/lib/candidate-tiers"

/** All, Gold, Silver, None — the actual selectable options, reused by both call sites below. */
function TierOptionsList({
  selected,
  onChange,
}: {
  selected: string[]
  onChange: (tiers: string[]) => void
}) {
  return (
    <>
      <DropdownMenuItem onClick={() => onChange([...TIER_OPTIONS])}>
        All
      </DropdownMenuItem>
      {TIER_OPTIONS.map((t) => (
        <DropdownMenuCheckboxItem
          key={t}
          checked={selected.includes(t)}
          onCheckedChange={(checked) =>
            onChange(
              checked ? [...selected, t] : selected.filter((x) => x !== t)
            )
          }
        >
          {titleCase(t)}
        </DropdownMenuCheckboxItem>
      ))}
      <DropdownMenuItem onClick={() => onChange([])}>None</DropdownMenuItem>
    </>
  )
}

/** Standalone Tier dropdown — used by the active-filter pill, which is already scoped to tier. */
export function TierFilterMenu({
  selected,
  onChange,
  trigger,
  align = "end",
}: {
  selected: string[]
  onChange: (tiers: string[]) => void
  trigger: ReactElement
  align?: "start" | "end"
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={trigger} />
      <DropdownMenuContent align={align}>
        <DropdownMenuLabel>Tier</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <TierOptionsList selected={selected} onChange={onChange} />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** "Tiers" entry inside the general Filter menu — cascades a submenu to the left. */
export function TierFilterSubmenuItem({
  selected,
  onChange,
}: {
  selected: string[]
  onChange: (tiers: string[]) => void
}) {
  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>
        <ChevronLeft className="size-4" />
        <span className="flex-1">Tiers</span>
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent>
        <TierOptionsList selected={selected} onChange={onChange} />
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  )
}
