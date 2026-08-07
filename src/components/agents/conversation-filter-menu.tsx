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

/** Reusable "All / each option / None" checklist body — shared by the standalone chip and the general Filter menu. */
function ChecklistOptionsList({
  options,
  selected,
  onChange,
}: {
  options: string[]
  selected: string[]
  onChange: (values: string[]) => void
}) {
  return (
    <>
      <DropdownMenuItem onClick={() => onChange([...options])}>All</DropdownMenuItem>
      {options.map((o) => (
        <DropdownMenuCheckboxItem
          key={o}
          checked={selected.includes(o)}
          onCheckedChange={(checked) =>
            onChange(checked ? [...selected, o] : selected.filter((x) => x !== o))
          }
        >
          {o}
        </DropdownMenuCheckboxItem>
      ))}
      <DropdownMenuItem onClick={() => onChange([])}>None</DropdownMenuItem>
    </>
  )
}

/** Standalone dropdown — used by the always-visible Agent chip, already scoped to one field. */
export function ConversationAgentFilterMenu({
  options,
  selected,
  onChange,
  trigger,
  align = "end",
}: {
  options: string[]
  selected: string[]
  onChange: (values: string[]) => void
  trigger: ReactElement
  align?: "start" | "end"
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={trigger} />
      <DropdownMenuContent align={align}>
        <DropdownMenuLabel>Agent</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <ChecklistOptionsList options={options} selected={selected} onChange={onChange} />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** Entry inside the general Filter menu — cascades a submenu to the left. */
export function ConversationAgentFilterSubmenuItem({
  options,
  selected,
  onChange,
}: {
  options: string[]
  selected: string[]
  onChange: (values: string[]) => void
}) {
  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>
        <ChevronLeft className="size-4" />
        <span className="flex-1">Agent</span>
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent>
        <ChecklistOptionsList options={options} selected={selected} onChange={onChange} />
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  )
}
