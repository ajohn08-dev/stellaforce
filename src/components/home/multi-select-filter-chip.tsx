"use client"

import * as React from "react"

import { DropdownMenuCheckboxItem, DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { FilterChip } from "@/components/home/filter-chip"

/**
 * UI-only — selection is local state and doesn't filter anything on the
 * page yet. Defaults to every option selected, shown as "All".
 */
export function MultiSelectFilterChip({ label, options }: { label: string; options: string[] }) {
  const [selected, setSelected] = React.useState<string[]>([...options])

  const summary =
    selected.length === options.length
      ? "All"
      : selected.length === 0
        ? "None"
        : selected.join(", ")

  return (
    <FilterChip label={label} summary={summary} onReset={() => setSelected([...options])}>
      <DropdownMenuCheckboxItem
        checked={selected.length === options.length}
        onCheckedChange={() => setSelected([...options])}
      >
        All
      </DropdownMenuCheckboxItem>
      {options.map((option) => (
        <DropdownMenuCheckboxItem
          key={option}
          checked={selected.includes(option)}
          onCheckedChange={(checked) =>
            setSelected(checked ? [...selected, option] : selected.filter((o) => o !== option))
          }
        >
          {option}
        </DropdownMenuCheckboxItem>
      ))}
      <DropdownMenuItem onClick={() => setSelected([])}>None</DropdownMenuItem>
    </FilterChip>
  )
}
