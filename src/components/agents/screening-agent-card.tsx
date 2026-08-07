import { Building2, Calendar } from "lucide-react"

import { AgentStatusBadge } from "@/components/agents/agent-status-badge"
import { TestRunAgentDialog } from "@/components/agents/test-run-agent-dialog"
import { formatDate } from "@/lib/constants"
import type { MockScreeningAgent } from "@/lib/mock-agents"

export function ScreeningAgentCard({ agent }: { agent: MockScreeningAgent }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-white p-4">
      <div className="flex items-start justify-between gap-2">
        <span className="truncate text-sm font-semibold">{agent.name}</span>
        <div className="flex shrink-0 items-center gap-1">
          <AgentStatusBadge status={agent.status} />
          <TestRunAgentDialog agentName={agent.name} />
        </div>
      </div>

      <p className="line-clamp-2 min-h-10 text-sm text-muted-foreground">
        {agent.description}
      </p>

      <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
        <span className="inline-flex min-w-0 items-center gap-1.5">
          <Building2 className="size-4 shrink-0" />
          <span className="truncate">
            {agent.client_names.length > 0
              ? agent.client_names.join(", ")
              : "Not yet assigned"}
          </span>
        </span>
        <span className="inline-flex shrink-0 items-center gap-1.5">
          <Calendar className="size-4 shrink-0" />
          {formatDate(agent.updated_at)}
        </span>
      </div>
    </div>
  )
}
