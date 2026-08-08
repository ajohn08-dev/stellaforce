import type { AgentStatus } from "@/lib/agents"

export const AGENT_STATUS_OPTIONS: AgentStatus[] = ["active", "inactive"]

/** No `statuses` param yet -> default (show everything). `statuses=` (empty) -> filter explicitly cleared. */
export function parseAgentStatusesParam(param: string | null): AgentStatus[] {
  if (param === null) return [...AGENT_STATUS_OPTIONS]
  if (param === "") return []
  return param
    .split(",")
    .filter((s): s is AgentStatus => AGENT_STATUS_OPTIONS.includes(s as AgentStatus))
}

export function listToParam(values: string[]): string {
  return values.join(",")
}
