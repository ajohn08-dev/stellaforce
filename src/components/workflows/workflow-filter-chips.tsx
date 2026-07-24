"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { ChevronDown, X } from "lucide-react"

import { WorkflowChecklistFilterMenu } from "@/components/workflows/workflow-filter-menu"
import { MOCK_WORKFLOW_CLIENTS, MOCK_WORKFLOW_DEPARTMENTS } from "@/lib/mock-workflows"
import {
  listToParam,
  parseWorkflowClientsParam,
  parseWorkflowDepartmentsParam,
} from "@/lib/workflow-status"

/**
 * Always-visible pill for one filterable field — identical format to the
 * Tiers pill on the candidates page (CandidateActiveFilters): "Label: value
 * ⌄ | ✕", always showing the colon/value/separator/X, never a bare "Label"
 * chip. Unlike Tiers (which hides itself when unfiltered, since its default
 * is zero-selected), this field's default is all-selected, so the pill
 * stays visible with "All" as its value and the X resets back to all
 * (the equivalent "remove this filter" action for that inverted default).
 */
function FilterChip({
  label,
  options,
  selected,
  onChange,
}: {
  label: string
  options: string[]
  selected: string[]
  onChange: (values: string[]) => void
}) {
  const summary =
    selected.length === options.length
      ? "All"
      : selected.length === 0
        ? "None"
        : options.filter((o) => selected.includes(o)).join(", ")

  return (
    <div className="inline-flex items-center gap-1 rounded-full bg-accent py-1 pr-1 pl-3 text-xs font-medium text-accent-foreground">
      <WorkflowChecklistFilterMenu
        label={label}
        options={options}
        selected={selected}
        align="start"
        onChange={onChange}
        trigger={
          <button type="button" className="flex items-center gap-1">
            {label}: {summary}
            <ChevronDown className="size-3" />
          </button>
        }
      />
      <span className="h-4 w-px bg-accent-foreground/20" aria-hidden />
      <button
        type="button"
        aria-label={`Remove ${label.toLowerCase()} filter`}
        onClick={() => onChange([...options])}
        className="rounded-full p-1 hover:bg-accent-foreground/10"
      >
        <X className="size-3" />
      </button>
    </div>
  )
}

export function WorkflowClientFilterChip() {
  const router = useRouter()
  const params = useSearchParams()
  const clients = parseWorkflowClientsParam(params.get("clients"), MOCK_WORKFLOW_CLIENTS)

  function setParam(values: string[]) {
    const sp = new URLSearchParams(params.toString())
    sp.set("clients", listToParam(values))
    router.push(`/workflows?${sp.toString()}`)
  }

  return (
    <FilterChip label="Client" options={MOCK_WORKFLOW_CLIENTS} selected={clients} onChange={setParam} />
  )
}

export function WorkflowDepartmentFilterChip() {
  const router = useRouter()
  const params = useSearchParams()
  const departments = parseWorkflowDepartmentsParam(
    params.get("departments"),
    MOCK_WORKFLOW_DEPARTMENTS
  )

  function setParam(values: string[]) {
    const sp = new URLSearchParams(params.toString())
    sp.set("departments", listToParam(values))
    router.push(`/workflows?${sp.toString()}`)
  }

  return (
    <FilterChip
      label="Department"
      options={MOCK_WORKFLOW_DEPARTMENTS}
      selected={departments}
      onChange={setParam}
    />
  )
}
