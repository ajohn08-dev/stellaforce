export const TIER_OPTIONS = ["gold", "silver"] as const

export const DEFAULT_TIERS: string[] = ["gold", "silver"]

/** No `tiers` param yet -> default to Gold+Silver. `tiers=` (empty) -> filter explicitly cleared. */
export function parseTiersParam(param: string | null): string[] {
  if (param === null) return DEFAULT_TIERS
  if (param === "") return []
  return param
    .split(",")
    .filter((t) => (TIER_OPTIONS as readonly string[]).includes(t))
}

export function tiersToParam(tiers: string[]): string {
  return tiers.join(",")
}
