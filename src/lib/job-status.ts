import { JOB_STATUSES } from "@/lib/constants"

export const JOB_STATUS_OPTIONS: string[] = JOB_STATUSES

/** Default view hides closed jobs — open/on-hold/filled is what a recruiter is actively tracking. */
export const DEFAULT_JOB_STATUSES: string[] = ["open", "on_hold", "filled"]

/** No `statuses` param yet -> default (hide closed). `statuses=` (empty) -> filter explicitly cleared. */
export function parseStatusesParam(param: string | null): string[] {
  if (param === null) return DEFAULT_JOB_STATUSES
  if (param === "") return []
  return param.split(",").filter((s) => JOB_STATUS_OPTIONS.includes(s))
}

export function statusesToParam(statuses: string[]): string {
  return statuses.join(",")
}
