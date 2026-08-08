/**
 * Shared shapes for the Screening Agents pages. Kept out of `data.ts` so
 * client components can import the types without pulling in the `server-only`
 * data layer.
 */

import type { AgentRow } from "@/lib/supabase/types"

export type AgentStatus = AgentRow["status"]

/** An `agents` row plus the clients that use it — derived by joining
 * `job_workflow_sub_stages.agent_id` → `job_orders` → `clients`, since the
 * table deliberately has no per-client ownership column. */
export type ScreeningAgent = AgentRow & {
  client_names: string[]
}
