"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { ChevronDown, X } from "lucide-react"

import { WorkflowChecklistFilterMenu } from "@/components/workflows/workflow-filter-menu"
import { titleCase } from "@/lib/constants"
import { WORKFLOW_STATUS_OPTIONS, listToParam, parseWorkflowStatusesParam } from "@/lib/workflow-status"

/** One removable/editable pill for a narrowed field — shown only when it excludes at least one option. */
function FilterPill({
  label,
  options,
  selected,
  onChange,
  formatLabel = (v) => v,
}: {
  label: string
  options: string[]
  selected: string[]
  onChange: (values: string[]) => void
  formatLabel?: (value: string) => string
}) {
  const summary = options.filter((o) => selected.includes(o)).map(formatLabel).join(", ")

  return (
    <div className="inline-flex items-center gap-1 rounded-full bg-accent py-1 pr-1 pl-3 text-xs font-medium text-accent-foreground">
      <WorkflowChecklistFilterMenu
        label={label}
        options={options}
        selected={selected}
        align="start"
        onChange={onChange}
        formatLabel={formatLabel}
        trigger={
          <button type="button" className="flex items-center gap-1">
            {label}: {selected.length === 0 ? "None" : summary}
            <ChevronDown className="size-3" />
          </button>
        }
      />
      <span className="h-4 w-px bg-accent-foreground/20" aria-hidden />
      <button
        type="button"
        aria-label={`Remove ${label.toLowerCase()} filter`}
        onClick={() => onChange([])}
        className="rounded-full p-1 hover:bg-accent-foreground/10"
      >
        <X className="size-3" />
      </button>
    </div>
  )
}

/**
 * Removable/editable pill for a narrowed Status filter, shown above the
 * list. Department and Client have their own always-visible pills
 * (WorkflowClientFilterChip/WorkflowDepartmentFilterChip) rendered
 * alongside this in the page, since those are narrowed more often.
 */
export function WorkflowActiveFilters() {
  const router = useRouter()
  const params = useSearchParams()

  const statuses = parseWorkflowStatusesParam(params.get("statuses"))

  function setParam(key: string, values: string[]) {
    const sp = new URLSearchParams(params.toString())
    sp.set(key, listToParam(values))
    router.push(`/workflows?${sp.toString()}`)
  }

  const statusNarrowed = statuses.length < WORKFLOW_STATUS_OPTIONS.length

  if (!statusNarrowed) return null

  return (
    <FilterPill
      label="Status"
      options={WORKFLOW_STATUS_OPTIONS}
      selected={statuses}
      onChange={(v) => setParam("statuses", v)}
      formatLabel={titleCase}
    />
  )
}
