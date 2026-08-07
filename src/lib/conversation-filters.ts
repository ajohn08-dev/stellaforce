import { MOCK_SCREENING_AGENTS } from "@/lib/mock-agents"

export const AGENT_NAME_OPTIONS: string[] = MOCK_SCREENING_AGENTS.map((a) => a.name)

/** No `agents` param yet -> default (show everything). `agents=` (empty) -> filter explicitly cleared. */
export function parseAgentNamesParam(param: string | null): string[] {
  if (param === null) return [...AGENT_NAME_OPTIONS]
  if (param === "") return []
  return param.split(",").filter((s) => AGENT_NAME_OPTIONS.includes(s))
}

export function listToParam(values: string[]): string {
  return values.join(",")
}
