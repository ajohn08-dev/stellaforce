import { Badge } from "@/components/ui/badge"
import { AGENT_STATUS_BADGE_CLASS, titleCase } from "@/lib/constants"
import { cn } from "@/lib/utils"
import type { AgentStatus } from "@/lib/mock-agents"

export function AgentStatusBadge({ status }: { status: AgentStatus }) {
  return (
    <Badge className={cn("border-transparent", AGENT_STATUS_BADGE_CLASS[status])}>
      {titleCase(status)}
    </Badge>
  )
}
