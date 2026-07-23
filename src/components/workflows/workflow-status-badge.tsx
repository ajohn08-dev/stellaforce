import { Badge } from "@/components/ui/badge"
import { WORKFLOW_STATUS_BADGE_CLASS, titleCase } from "@/lib/constants"
import { cn } from "@/lib/utils"
import type { WorkflowStatus } from "@/lib/mock-workflows"

export function WorkflowStatusBadge({ status }: { status: WorkflowStatus }) {
  return (
    <Badge className={cn("border-transparent", WORKFLOW_STATUS_BADGE_CLASS[status])}>
      {titleCase(status)}
    </Badge>
  )
}
