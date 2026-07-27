"use client"

import * as React from "react"
import { ChevronDown, ChevronLeft, Filter, X } from "lucide-react"

import { Button } from "@/components/ui/button"
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
import {
  ANALYTICS_DATE_RANGE_OPTIONS,
  CLIENT_NAMES,
  DEFAULT_ANALYTICS_DATE_RANGE,
  type AnalyticsDateRange,
} from "@/lib/mock-agent-analytics"

/**
 * Same "Label: value ⌄ | ✕" pill shape used by every other list page's
 * active-filter chips (see WorkflowClientFilterChip/WorkflowDepartmentFilterChip)
 * — kept local rather than shared since each domain hand-rolls its own.
 */
function FilterChipShell({
  label,
  summary,
  onReset,
  children,
}: {
  label: string
  summary: string
  onReset: () => void
  children: React.ReactNode
}) {
  return (
    <div className="inline-flex items-center gap-1 rounded-full bg-accent py-1 pr-1 pl-3 text-xs font-medium text-accent-foreground">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button type="button" className="flex items-center gap-1">
              {label}: {summary}
              <ChevronDown className="size-3" />
            </button>
          }
        />
        <DropdownMenuContent align="start">
          <DropdownMenuLabel>{label}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {children}
        </DropdownMenuContent>
      </DropdownMenu>
      <span className="h-4 w-px bg-accent-foreground/20" aria-hidden />
      <button
        type="button"
        aria-label={`Reset ${label.toLowerCase()} filter`}
        onClick={onReset}
        className="rounded-full p-1 hover:bg-accent-foreground/10"
      >
        <X className="size-3" />
      </button>
    </div>
  )
}

/** The actual selectable date-range options, reused by both the chip and the Filter menu. */
function DateRangeOptionsList({
  value,
  onChange,
}: {
  value: AnalyticsDateRange
  onChange: (value: AnalyticsDateRange) => void
}) {
  return (
    <>
      {ANALYTICS_DATE_RANGE_OPTIONS.map((option) => (
        <DropdownMenuCheckboxItem
          key={option}
          checked={option === value}
          onCheckedChange={() => onChange(option)}
        >
          {option}
        </DropdownMenuCheckboxItem>
      ))}
    </>
  )
}

/** The actual selectable client options, reused by both the chip and the Filter menu. */
function ClientOptionsList({
  selected,
  onChange,
}: {
  selected: string[]
  onChange: (clients: string[]) => void
}) {
  return (
    <>
      <DropdownMenuCheckboxItem
        checked={selected.length === CLIENT_NAMES.length}
        onCheckedChange={() => onChange([...CLIENT_NAMES])}
      >
        All
      </DropdownMenuCheckboxItem>
      {CLIENT_NAMES.map((client) => (
        <DropdownMenuCheckboxItem
          key={client}
          checked={selected.includes(client)}
          onCheckedChange={(checked) =>
            onChange(checked ? [...selected, client] : selected.filter((c) => c !== client))
          }
        >
          {client}
        </DropdownMenuCheckboxItem>
      ))}
      <DropdownMenuItem onClick={() => onChange([])}>None</DropdownMenuItem>
    </>
  )
}

/**
 * Controlled (not local state) — the selected range also drives each stat
 * card's "vs. ___" comparison caption, so the page needs to hold this value.
 */
function AnalyticsDateFilterChip({
  value,
  onChange,
}: {
  value: AnalyticsDateRange
  onChange: (value: AnalyticsDateRange) => void
}) {
  return (
    <FilterChipShell
      label="Date"
      summary={value}
      onReset={() => onChange(DEFAULT_ANALYTICS_DATE_RANGE)}
    >
      <DateRangeOptionsList value={value} onChange={onChange} />
    </FilterChipShell>
  )
}

function AnalyticsClientFilterChip({
  selected,
  onChange,
}: {
  selected: string[]
  onChange: (clients: string[]) => void
}) {
  const summary =
    selected.length === CLIENT_NAMES.length
      ? "All"
      : selected.length === 0
        ? "None"
        : selected.join(", ")

  return (
    <FilterChipShell label="Clients" summary={summary} onReset={() => onChange([...CLIENT_NAMES])}>
      <ClientOptionsList selected={selected} onChange={onChange} />
    </FilterChipShell>
  )
}

/** "Filter" opens a menu of filterable fields — Date and Clients, which also have their own always-visible chips in the toolbar. */
function AnalyticsFilterButton({
  dateRange,
  onDateRangeChange,
  selectedClients,
  onSelectedClientsChange,
}: {
  dateRange: AnalyticsDateRange
  onDateRangeChange: (value: AnalyticsDateRange) => void
  selectedClients: string[]
  onSelectedClientsChange: (clients: string[]) => void
}) {
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
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <ChevronLeft className="size-4" />
            <span className="flex-1">Date</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DateRangeOptionsList value={dateRange} onChange={onDateRangeChange} />
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <ChevronLeft className="size-4" />
            <span className="flex-1">Clients</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <ClientOptionsList selected={selectedClients} onChange={onSelectedClientsChange} />
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function AnalyticsFilterBar({
  dateRange,
  onDateRangeChange,
}: {
  dateRange: AnalyticsDateRange
  onDateRangeChange: (value: AnalyticsDateRange) => void
}) {
  const [selectedClients, setSelectedClients] = React.useState<string[]>([...CLIENT_NAMES])

  return (
    <div className="flex items-center gap-2">
      <AnalyticsFilterButton
        dateRange={dateRange}
        onDateRangeChange={onDateRangeChange}
        selectedClients={selectedClients}
        onSelectedClientsChange={setSelectedClients}
      />
      <AnalyticsDateFilterChip value={dateRange} onChange={onDateRangeChange} />
      <AnalyticsClientFilterChip selected={selectedClients} onChange={setSelectedClients} />
    </div>
  )
}
