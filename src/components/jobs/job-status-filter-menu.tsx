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
import { JOB_STATUS_OPTIONS } from "@/lib/job-status"

/** All, Open, On Hold, Filled, Closed, None — reused by both call sites below. */
function StatusOptionsList({
  selected,
  onChange,
}: {
  selected: string[]
  onChange: (statuses: string[]) => void
}) {
  return (
    <>
      <DropdownMenuItem onClick={() => onChange([...JOB_STATUS_OPTIONS])}>
        All
      </DropdownMenuItem>
      {JOB_STATUS_OPTIONS.map((s) => (
        <DropdownMenuCheckboxItem
          key={s}
          checked={selected.includes(s)}
          onCheckedChange={(checked) =>
            onChange(
              checked ? [...selected, s] : selected.filter((x) => x !== s)
            )
          }
        >
          {titleCase(s)}
        </DropdownMenuCheckboxItem>
      ))}
      <DropdownMenuItem onClick={() => onChange([])}>None</DropdownMenuItem>
    </>
  )
}

/** Standalone Status dropdown — used by the active-filter pill, already scoped to status. */
export function JobStatusFilterMenu({
  selected,
  onChange,
  trigger,
  align = "end",
}: {
  selected: string[]
  onChange: (statuses: string[]) => void
  trigger: ReactElement
  align?: "start" | "end"
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={trigger} />
      <DropdownMenuContent align={align}>
        <DropdownMenuLabel>Status</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <StatusOptionsList selected={selected} onChange={onChange} />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** "Status" entry inside the general Filter menu — cascades a submenu to the left. */
export function JobStatusFilterSubmenuItem({
  selected,
  onChange,
}: {
  selected: string[]
  onChange: (statuses: string[]) => void
}) {
  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>
        <ChevronLeft className="size-4" />
        <span className="flex-1">Status</span>
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent>
        <StatusOptionsList selected={selected} onChange={onChange} />
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  )
}
