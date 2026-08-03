"use client"

import * as React from "react"
import { ChevronDown, X } from "lucide-react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

/**
 * "Label: value ⌄ | ✕" pill — same shape as every other list page's
 * active-filter chips (see WorkflowClientFilterChip / analytics-filter-bar's
 * FilterChipShell) — kept local here since each domain already hand-rolls
 * its own rather than sharing one.
 */
export function FilterChip({
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
