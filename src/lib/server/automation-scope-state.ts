import "server-only"

import { isSupabaseConfigured } from "@/lib/env"
import { createAdminClient } from "@/lib/supabase/admin"
import { scopeChain } from "@/lib/automation-resolve"
import {
  resolveScopeSwitch,
  type ScopeSwitch,
  type ScopeSwitchRow,
} from "@/lib/automation-scope-state"

/**
 * Loading half of the account-wide automation switch.
 *
 * Separate from `resolveAutomationsWithClient` because the outbound gate asks a
 * much smaller question — *"is this account running automations"* — and
 * resolving fourteen definitions plus their versions and bindings to answer it
 * would be four queries where one will do. Both halves call the same pure
 * `resolveScopeSwitch`, so they cannot disagree.
 *
 * ⚠️ Reads with the **service-role admin client on purpose**. The callers are
 * `logActivity` and the outbound gate, which run from cron ticks, n8n webhooks
 * and the public booking routes — none of which has a session. Under RLS a
 * sessionless read returns zero rows, which here would resolve to "nothing is
 * capped" and quietly let every suppressed call through. This is a read of one
 * configuration row, never of anyone's data.
 */

/** Every applicable switch row for an account. `null` clientId = global only. */
async function loadSwitchRows(clientId: string | null): Promise<ScopeSwitchRow[]> {
  if (!isSupabaseConfigured) return []
  const admin = createAdminClient()
  const filter = clientId
    ? `scope.eq.global,company_scope_client_id.eq.${clientId}`
    : "scope.eq.global"
  const { data } = await admin
    .from("automation_scope_settings")
    .select(
      "id, state, category, resume_at, scope, company_scope_client_id, workflow_template_id, job_id"
    )
    .or(filter)
  return data ?? []
}

/**
 * The account's name, for the provenance label.
 *
 * Fetched even though it costs a second query, because `source.label` is what
 * the banner and the header pill render — without it they say "Off · Company",
 * and naming where a decision came from is only useful if it names somewhere a
 * person recognises. `resolveAutomationsWithClient` resolves the same label via
 * `scopeLabels`; this is the small-query path's equivalent.
 */
async function clientName(clientId: string): Promise<string | null> {
  const admin = createAdminClient()
  const { data } = await admin
    .from("clients")
    .select("client_name")
    .eq("client_id", clientId)
    .maybeSingle()
  return data?.client_name ?? null
}

/**
 * Deliberately **not** wrapped in React `cache()`.
 *
 * A single stage move asks this about five times, and memoising would save four
 * queries against one indexed row of a table with a handful of rows in it —
 * nothing, next to the writes those paths already do. What it costs is
 * predictability: `cache()` is per-request only where a request scope exists,
 * and in a plain Node context (a script, a worker) it memoises for the life of
 * the process. A kill switch that keeps reporting a value from before it was
 * flipped is the exact failure this feature cannot have, and it would show up
 * first somewhere with no request scope rather than in the browser.
 */

/**
 * Is this account capped, and by what?
 *
 * `category` narrows the question to one automation category; omit it to ask
 * about the account as a whole, which is what non-automation outbound (calendar
 * invites, SLA mail, a test call) needs — those belong to no category, so only
 * an account-wide row may stop them.
 */
export async function scopeStateFor(
  clientId: string | null,
  category?: string
): Promise<ScopeSwitch | null> {
  const rows = await loadSwitchRows(clientId)
  if (rows.length === 0) return null

  // Only worth a query once we know something is actually stored — the common
  // case is no rows at all, and that path stays a single read.
  const chain = scopeChain(
    { companyId: clientId },
    { companyName: clientId ? await clientName(clientId) : null }
  )

  if (category) return resolveScopeSwitch(rows, chain, category, new Date())

  // No category named: only a catch-all row can answer. Passing a sentinel
  // category would let a `category = 'scheduling'` row cap a calendar invite,
  // which is a different axis entirely.
  return resolveScopeSwitch(
    rows.filter((r) => r.category === null),
    chain,
    "",
    new Date()
  )
}

/** True when the account is running automations for this category. */
export async function automationsRunFor(
  clientId: string | null,
  category?: string
): Promise<boolean> {
  return (await scopeStateFor(clientId, category)) === null
}
