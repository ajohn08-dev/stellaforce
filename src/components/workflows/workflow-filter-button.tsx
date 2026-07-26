"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { Filter } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { WorkflowChecklistFilterSubmenuItem } from "@/components/workflows/workflow-filter-menu"
import { titleCase } from "@/lib/constants"
import {
  WORKFLOW_STATUS_OPTIONS,
  listToParam,
  parseWorkflowStatusesParam,
} from "@/lib/workflow-status"

/**
 * "Filter" opens a menu of filterable fields — currently just Status.
 * Department and Client have their own always-visible chips in the toolbar
 * (WorkflowClientFilterChip/WorkflowDepartmentFilterChip) instead of living
 * here, since those are the fields recruiters narrow by most often.
 */
export function WorkflowFilterButton() {
  const router = useRouter()
  const params = useSearchParams()

  const statuses = parseWorkflowStatusesParam(params.get("statuses"))

  function setParam(key: string, values: string[]) {
    const sp = new URLSearchParams(params.toString())
    sp.set(key, listToParam(values))
    router.push(`/workflows?${sp.toString()}`)
  }

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
        <WorkflowChecklistFilterSubmenuItem
          label="Status"
          options={WORKFLOW_STATUS_OPTIONS}
          selected={statuses}
          onChange={(v) => setParam("statuses", v)}
          formatLabel={titleCase}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
