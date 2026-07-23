import { WorkflowCard } from "@/components/workflows/workflow-card"
import type { MockWorkflow } from "@/lib/mock-workflows"

export function WorkflowsGrid({ data }: { data: MockWorkflow[] }) {
  if (data.length === 0) {
    return (
      <div className="rounded-lg border border-border p-10 text-center text-sm text-muted-foreground">
        No workflows found.
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {data.map((workflow) => (
        <WorkflowCard key={workflow.workflow_id} workflow={workflow} />
      ))}
    </div>
  )
}
