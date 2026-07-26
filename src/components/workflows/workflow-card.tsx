import Link from "next/link"
import { Building2, Calendar, Layers } from "lucide-react"

import { Checkbox } from "@/components/ui/checkbox"
import { WorkflowStatusBadge } from "@/components/workflows/workflow-status-badge"
import { WorkflowActions } from "@/components/workflows/workflow-actions"
import { formatDate } from "@/lib/constants"
import type { MockWorkflow } from "@/lib/mock-workflows"

export function WorkflowCard({ workflow }: { workflow: MockWorkflow }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-white p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2 text-sm">
          <Checkbox aria-label={`Select ${workflow.name}`} className="shrink-0" />
          <Link
            href={`/workflows/${workflow.workflow_id}`}
            className="truncate font-semibold hover:underline"
          >
            {workflow.name}
          </Link>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <WorkflowStatusBadge status={workflow.status} />
          <WorkflowActions workflow={workflow} />
        </div>
      </div>

      <p className="line-clamp-2 min-h-10 text-sm text-muted-foreground">
        {workflow.description}
      </p>

      <div className="grid grid-cols-[1fr_1fr_auto] items-center gap-2 text-sm text-muted-foreground">
        <span className="inline-flex min-w-0 items-center gap-1.5">
          <Building2 className="size-4 shrink-0" />
          <span className="truncate">{workflow.client_name ?? "Generic template"}</span>
        </span>
        <span className="inline-flex min-w-0 items-center gap-1.5">
          <Layers className="size-4 shrink-0" />
          <span className="truncate">{workflow.department}</span>
        </span>
        <span className="inline-flex shrink-0 items-center gap-1.5 justify-self-end">
          <Calendar className="size-4 shrink-0" />
          {formatDate(workflow.updated_at)}
        </span>
      </div>
    </div>
  )
}
