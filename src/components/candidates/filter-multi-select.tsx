"use client"

import * as React from "react"
import { ChevronDown } from "lucide-react"

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

/**
 * A labelled multi-select for the Advanced Search rail.
 *
 * Built on the same `DropdownMenuCheckboxItem` the tier filter already uses,
 * rather than on a new listbox: the rail is 280px wide, and seventeen roles or
 * ten seniority rungs rendered as inline checkboxes would push every other
 * filter below the fold. The trigger says what is selected so the closed state
 * is still readable — "Any" / the single label / "3 selected".
 *
 * Options may carry a `group`, which renders as a heading inside the menu.
 * That is what makes the role list navigable: seventeen flat rows are a wall,
 * the same seventeen under their families are three or four short lists.
 */

export type MultiSelectOption = {
  value: string
  label: string
  /** Optional heading this option sits under. Options must arrive grouped. */
  group?: string
}

export function FilterMultiSelect({
  id,
  label,
  options,
  selected,
  onChange,
  placeholder = "Any",
  hint,
  emptyMessage = "No options",
}: {
  id: string
  label: string
  options: MultiSelectOption[]
  selected: string[]
  onChange: (next: string[]) => void
  placeholder?: string
  hint?: string
  emptyMessage?: string
}) {
  // Only count selections the current option list can actually show. A stale
  // value from a shared link still filters the search — the server decides
  // that — but claiming "2 selected" while one of them is invisible reads as
  // a broken control.
  const known = React.useMemo(() => new Set(options.map((o) => o.value)), [options])
  const visible = selected.filter((v) => known.has(v))

  const summary =
    visible.length === 0
      ? placeholder
      : visible.length === 1
        ? options.find((o) => o.value === visible[0])?.label ?? placeholder
        : `${visible.length} selected`

  function toggle(value: string, checked: boolean) {
    onChange(checked ? [...selected, value] : selected.filter((v) => v !== value))
  }

  // Render order follows the options array, so the caller controls both
  // grouping and sequence (families in taxonomy order, seniority as a ladder).
  const rows: React.ReactNode[] = []
  let lastGroup: string | undefined
  for (const option of options) {
    if (option.group && option.group !== lastGroup) {
      if (lastGroup !== undefined) rows.push(<DropdownMenuSeparator key={`sep-${option.group}`} />)
      rows.push(<DropdownMenuLabel key={`grp-${option.group}`}>{option.group}</DropdownMenuLabel>)
      lastGroup = option.group
    }
    rows.push(
      <DropdownMenuCheckboxItem
        key={option.value}
        checked={selected.includes(option.value)}
        onCheckedChange={(checked) => toggle(option.value, checked)}
        // The menu stays open on tick (base-ui's default for a checkbox item),
        // which is what these need: picking three roles is one visit.
      >
        {option.label}
      </DropdownMenuCheckboxItem>
    )
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              id={id}
              type="button"
              className={cn(
                "flex h-9 w-full items-center justify-between gap-2 rounded-lg border border-input bg-white px-3 text-sm outline-none transition-colors",
                "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
                visible.length === 0 && "text-muted-foreground"
              )}
            >
              <span className="truncate">{summary}</span>
              <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
            </button>
          }
        />
        <DropdownMenuContent
          align="start"
          className="max-h-80 w-[248px] overflow-y-auto"
        >
          {options.length === 0 ? (
            <DropdownMenuItem disabled>{emptyMessage}</DropdownMenuItem>
          ) : (
            <>
              {rows}
              {visible.length > 0 && (
                <>
                  <DropdownMenuSeparator />
                  {/* Clears this control only — "Clear filters" below the rail
                      is what resets the whole search. */}
                  <DropdownMenuItem onClick={() => onChange([])}>Clear</DropdownMenuItem>
                </>
              )}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}
