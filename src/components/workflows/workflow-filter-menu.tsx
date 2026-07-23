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

/** Reusable "All / each option / None" checklist body — shared by status, department, and client filters. */
function ChecklistOptionsList({
  options,
  selected,
  onChange,
  formatLabel = (v) => v,
}: {
  options: string[]
  selected: string[]
  onChange: (values: string[]) => void
  formatLabel?: (value: string) => string
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
          {formatLabel(o)}
        </DropdownMenuCheckboxItem>
      ))}
      <DropdownMenuItem onClick={() => onChange([])}>None</DropdownMenuItem>
    </>
  )
}

/** Standalone dropdown — used by an active-filter pill, already scoped to one field. */
export function WorkflowChecklistFilterMenu({
  label,
  options,
  selected,
  onChange,
  trigger,
  align = "end",
  formatLabel,
}: {
  label: string
  options: string[]
  selected: string[]
  onChange: (values: string[]) => void
  trigger: ReactElement
  align?: "start" | "end"
  formatLabel?: (value: string) => string
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={trigger} />
      <DropdownMenuContent align={align}>
        <DropdownMenuLabel>{label}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <ChecklistOptionsList
          options={options}
          selected={selected}
          onChange={onChange}
          formatLabel={formatLabel}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** Entry inside the general Filter menu — cascades a submenu to the left. */
export function WorkflowChecklistFilterSubmenuItem({
  label,
  options,
  selected,
  onChange,
  formatLabel,
}: {
  label: string
  options: string[]
  selected: string[]
  onChange: (values: string[]) => void
  formatLabel?: (value: string) => string
}) {
  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>
        <ChevronLeft className="size-4" />
        <span className="flex-1">{label}</span>
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent>
        <ChecklistOptionsList
          options={options}
          selected={selected}
          onChange={onChange}
          formatLabel={formatLabel}
        />
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  )
}
