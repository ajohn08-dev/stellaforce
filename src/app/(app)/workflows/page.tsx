import { SetSidebarCollapsed } from "@/components/set-sidebar-collapsed"
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
import type { MockWorkflow } from "@/lib/mock-workflows"
import {
  parseWorkflowClientsParam,
  parseWorkflowDepartmentsParam,
  parseWorkflowStatusesParam,
} from "@/lib/workflow-status"
import { getWorkflowTemplates } from "@/lib/data"
import { getCurrentProfile } from "@/lib/auth"

export default async function WorkflowsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = await searchParams
  const get = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined)

  const profile = await getCurrentProfile()
  const templates = await getWorkflowTemplates({ clientId: profile?.client_id ?? null })

  // Map DB rows into the shape the existing grid/table components render.
  const allWorkflows: MockWorkflow[] = templates.map((t) => ({
    workflow_id: t.id,
    name: t.name,
    status: t.status,
    description: t.description ?? "",
    department: t.department ?? "General",
    client_name: t.client?.client_name ?? null,
    created_by: "",
    created_at: t.created_at,
    updated_at: t.updated_at,
    stages: [],
  }))

  const allDepartments = Array.from(new Set(allWorkflows.map((w) => w.department))).sort()
  const allClients = Array.from(
    new Set(allWorkflows.map((w) => w.client_name).filter((c): c is string => c !== null))
  ).sort()

  const statuses = parseWorkflowStatusesParam(get("statuses") ?? null)
  const departments = parseWorkflowDepartmentsParam(get("departments") ?? null, allDepartments)
  const clients = parseWorkflowClientsParam(get("clients") ?? null, allClients)
  const q = get("q")?.trim().toLowerCase()

  const workflows = allWorkflows.filter((workflow) => {
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
      <SetSidebarCollapsed />
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
