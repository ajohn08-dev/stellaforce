/**
 * Agent-name filter for the Conversations page. Options are passed in from the
 * server (derived from the conversations themselves — see
 * `conversationAgentNames` in data.ts) rather than being a module-level
 * constant, so the list always reflects what's actually in the table.
 */

/** No `agents` param -> null (no filtering at all, show everything). `agents=`
 * (empty) -> [] (filter explicitly cleared, show nothing). Otherwise the
 * selected subset, intersected with the options that actually exist. */
export function parseAgentNamesParam(
  param: string | null,
  options: string[]
): string[] | null {
  if (param === null) return null
  if (param === "") return []
  return param.split(",").filter((s) => options.includes(s))
}

export function listToParam(values: string[]): string {
  return values.join(",")
}
