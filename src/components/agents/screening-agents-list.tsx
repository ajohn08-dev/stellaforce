import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { AgentStatusBadge } from "@/components/agents/agent-status-badge"
import { TestRunAgentDialog } from "@/components/agents/test-run-agent-dialog"
import { formatDate } from "@/lib/constants"
import type { MockScreeningAgent } from "@/lib/mock-agents"

export function ScreeningAgentsList({ agents }: { agents: MockScreeningAgent[] }) {
  return (
    <div className="rounded-lg border border-border bg-white">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Client(s)</TableHead>
            <TableHead>Last Updated</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {agents.length ? (
            agents.map((agent) => (
              <TableRow key={agent.agent_id}>
                <TableCell className="font-medium">{agent.name}</TableCell>
                <TableCell>
                  <AgentStatusBadge status={agent.status} />
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {agent.client_names.length > 0
                    ? agent.client_names.join(", ")
                    : "Not yet assigned"}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {formatDate(agent.updated_at)}
                </TableCell>
                <TableCell>
                  <TestRunAgentDialog agentName={agent.name} />
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                No screening agents match these filters.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}
