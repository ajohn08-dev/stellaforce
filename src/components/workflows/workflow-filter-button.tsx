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
import { MOCK_WORKFLOW_CLIENTS, MOCK_WORKFLOW_DEPARTMENTS } from "@/lib/mock-workflows"
import {
  WORKFLOW_STATUS_OPTIONS,
  listToParam,
  parseWorkflowClientsParam,
  parseWorkflowDepartmentsParam,
  parseWorkflowStatusesParam,
} from "@/lib/workflow-status"

/**
 * "Filter" opens a menu of filterable fields — Status, Department, Client.
 * Each field cascades its own options into a submenu rather than exposing
 * them directly here (mirrors JobFilterButton).
 */
export function WorkflowFilterButton() {
  const router = useRouter()
  const params = useSearchParams()

  const statuses = parseWorkflowStatusesParam(params.get("statuses"))
  const departments = parseWorkflowDepartmentsParam(
    params.get("departments"),
    MOCK_WORKFLOW_DEPARTMENTS
  )
  const clients = parseWorkflowClientsParam(params.get("clients"), MOCK_WORKFLOW_CLIENTS)

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
        <WorkflowChecklistFilterSubmenuItem
          label="Department"
          options={MOCK_WORKFLOW_DEPARTMENTS}
          selected={departments}
          onChange={(v) => setParam("departments", v)}
        />
        <WorkflowChecklistFilterSubmenuItem
          label="Client"
          options={MOCK_WORKFLOW_CLIENTS}
          selected={clients}
          onChange={(v) => setParam("clients", v)}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
