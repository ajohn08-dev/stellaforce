export const WORKFLOW_STATUS_OPTIONS: string[] = ["draft", "published"]

/** No `statuses` param yet -> default (show everything). `statuses=` (empty) -> filter explicitly cleared. */
export function parseWorkflowStatusesParam(param: string | null): string[] {
  if (param === null) return [...WORKFLOW_STATUS_OPTIONS]
  if (param === "") return []
  return param.split(",").filter((s) => WORKFLOW_STATUS_OPTIONS.includes(s))
}

export function workflowStatusesToParam(statuses: string[]): string {
  return statuses.join(",")
}

/** Generic comma-list URL param helper shared by the department/client filters below. */
function parseListParam(param: string | null, validOptions: string[]): string[] {
  if (param === null) return [...validOptions]
  if (param === "") return []
  return param.split(",").filter((v) => validOptions.includes(v))
}

export function parseWorkflowDepartmentsParam(
  param: string | null,
  validOptions: string[]
): string[] {
  return parseListParam(param, validOptions)
}

export function parseWorkflowClientsParam(
  param: string | null,
  validOptions: string[]
): string[] {
  return parseListParam(param, validOptions)
}

export function listToParam(values: string[]): string {
  return values.join(",")
}
