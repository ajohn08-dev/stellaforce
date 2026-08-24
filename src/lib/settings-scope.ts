import type { SettingsScope } from "@/lib/supabase/types"

/**
 * How specific each rung of the settings cascade is.
 *
 * Its own module, and client-safe, because two different resolvers depend on
 * it — `src/lib/workflow-settings.ts` for SLAs and communication templates,
 * `src/lib/automation-resolve.ts` for automations — and a disagreement between
 * them about what "more specific" means would show up as two screens giving
 * different answers about the same job. One definition, imported twice.
 */
export const SCOPE_RANK: Record<SettingsScope, number> = {
  global: 0,
  client: 1,
  workflow: 2,
  job: 3,
}

export function rankOf(scope: SettingsScope): number {
  return SCOPE_RANK[scope]
}
