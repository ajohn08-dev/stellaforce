import { WorkflowsTable } from "@/components/workflows/workflows-table"
import { WorkflowsGrid } from "@/components/workflows/workflows-grid"
import { WorkflowSearch } from "@/components/workflows/workflow-search"
import { WorkflowFilterButton } from "@/components/workflows/workflow-filter-button"
import {
  WorkflowClientFilterChip,
  WorkflowDepartmentFilterChip,
} from "@/components/workflows/workflow-filter-chips"
import { WorkflowActiveFilters } from "@/components/workflows/workflow-active-filters"
import { WorkflowViewToggle } from "@/components/workflows/workflow-view-toggle"
import { AddWorkflowButton } from "@/components/workflows/add-workflow-button"
import {
  MOCK_WORKFLOWS,
  MOCK_WORKFLOW_CLIENTS,
  MOCK_WORKFLOW_DEPARTMENTS,
} from "@/lib/mock-workflows"
import {
  parseWorkflowClientsParam,
  parseWorkflowDepartmentsParam,
  parseWorkflowStatusesParam,
} from "@/lib/workflow-status"

export default async function WorkflowsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = await searchParams
  const get = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined)

  const statuses = parseWorkflowStatusesParam(get("statuses") ?? null)
  const departments = parseWorkflowDepartmentsParam(
    get("departments") ?? null,
    MOCK_WORKFLOW_DEPARTMENTS
  )
  const clients = parseWorkflowClientsParam(get("clients") ?? null, MOCK_WORKFLOW_CLIENTS)
  const q = get("q")?.trim().toLowerCase()

  const workflows = MOCK_WORKFLOWS.filter((workflow) => {
    if (!statuses.includes(workflow.status)) return false
    if (!departments.includes(workflow.department)) return false
    if (workflow.client_name && !clients.includes(workflow.client_name)) return false
    if (q) {
      const haystack = `${workflow.name} ${workflow.client_name ?? ""} ${workflow.department}`.toLowerCase()
      if (!haystack.includes(q)) return false
    }
    return true
  })

  const view = get("view") === "list" ? "list" : "grid"

  return (
    <div
      className="flex flex-col overflow-hidden"
      // Inline style, not an arbitrary Tailwind class: <main> has no padding
      // of its own — every section below manages its own — so only the app
      // header (h-14 = 3.5rem) needs subtracting. Fixed (not min-) height so
      // the header stays put and only the grid/table body below it scrolls.
      style={{ height: "calc(100vh - 3.5rem)" }}
    >
      <div className="shrink-0 border-b border-border px-4 py-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <WorkflowSearch />
            <WorkflowFilterButton />
          </div>
          <AddWorkflowButton />
        </div>
      </div>

      <div className="shrink-0 px-4 pt-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <WorkflowActiveFilters />
            <WorkflowClientFilterChip />
            <WorkflowDepartmentFilterChip />
          </div>
          <WorkflowViewToggle />
        </div>
      </div>

      <div className="min-h-0 flex-1 p-4">
        {view === "grid" ? (
          <div className="h-full overflow-y-auto">
            <WorkflowsGrid data={workflows} />
          </div>
        ) : (
          <WorkflowsTable data={workflows} />
        )}
      </div>
    </div>
  )
}
