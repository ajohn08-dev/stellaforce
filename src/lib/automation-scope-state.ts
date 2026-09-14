import { rankOf } from "@/lib/settings-scope"
import {
  APP_SCOPE_TO_DB,
  DB_SCOPE_TO_APP,
  type Provenance,
} from "@/lib/automation-resolve"
import type { AutomationRunState, AutomationScope } from "@/lib/automation-rules"
import type { AutomationScopeSettingRow } from "@/lib/supabase/types"

/**
 * The account-wide automation switch — the pure half.
 *
 * `automation_bindings` answers *"at this scope, what is the state of THIS
 * rule"*. This answers a different question: *"at this scope, is the account
 * running automations at all"*. It resolves along the same
 * `global → company → workflow → job` chain, narrowest wins, and acts as a
 * **ceiling**: when it is not `active`, every automation at or below that scope
 * is forced off and locked.
 *
 * Two rules that look contradictory and aren't:
 *
 * - An inherited-off *binding* is **not** a lock — a job may turn it back on
 *   (`canActivateForJob`). That is right for a per-rule default.
 * - An inherited-off *scope switch* **is** a lock. An admin who turns an
 *   account off must not be undone by a recruiter on one req.
 *
 * One governs a rule's default; the other governs whether the account is
 * running at all.
 *
 * Global is a **default for accounts that haven't decided**, not an override.
 * Stellaforce `off` + Naehas `active` therefore resolves exactly as written, in
 * both directions, with no special casing — which a fail-closed union could not
 * express, and which is the whole reason accounts are independent here.
 *
 * No Supabase and no `server-only`, matching `automation-resolve.ts`: the
 * loading half is `src/lib/server/automation-scope-state.ts`, so
 * `npm run automation-scope-check` drives the real logic rather than a
 * re-implementation of it.
 */

/**
 * The columns resolution needs. A structural subset rather than the whole row,
 * so the check script can hand-build cases without inventing timestamps.
 */
export type ScopeSwitchRow = Pick<
  AutomationScopeSettingRow,
  | "id"
  | "state"
  | "category"
  | "resume_at"
  | "scope"
  | "company_scope_client_id"
  | "workflow_template_id"
  | "job_id"
>

/** A switch that is actively capping something. Never carries `active`. */
export type ScopeSwitch = {
  /** `paused` or `off` — `active` means nothing is capped, and returns null. */
  state: Exclude<AutomationRunState, "active">
  source: Provenance
  /** Null when the row covers every category. */
  category: string | null
  /** ISO instant a pause ends; null for an indefinite one. */
  resumeAt: string | null
}

/** Which rung a stored row sits on. Reads `scope`, never the tenant column. */
function layerOf(row: ScopeSwitchRow): { scope: AutomationScope; refId: string | null } {
  const scope = DB_SCOPE_TO_APP[row.scope]
  switch (scope) {
    case "company":
      return { scope, refId: row.company_scope_client_id }
    case "workflow":
      return { scope, refId: row.workflow_template_id }
    case "job":
      return { scope, refId: row.job_id }
    default:
      return { scope: "global", refId: null }
  }
}

/**
 * A pause whose end has passed stops applying — resolved here rather than by a
 * sweeper.
 *
 * If expiry depended on a cron, then between the resume time and the next tick
 * the account would still be paused, and a cron that fails to run would leave
 * an account silently frozen indefinitely. The sweep only tidies the dead row.
 */
function stillApplies(row: ScopeSwitchRow, now: Date): boolean {
  if (row.state !== "paused" || !row.resume_at) return true
  return new Date(row.resume_at).getTime() > now.getTime()
}

/**
 * Narrowest wins; at equal scope, a category-specific row beats a catch-all.
 *
 * Returns **null** when nothing caps this category — either no row applies, or
 * the winning row says `active`. An explicit `active` at a narrow scope is how
 * one account opts back in under a global default of `off`, so it has to be
 * resolved as a winner before being discarded.
 */
export function resolveScopeSwitch(
  rows: ScopeSwitchRow[],
  chain: Provenance[],
  category: string,
  now: Date
): ScopeSwitch | null {
  let winner: { row: ScopeSwitchRow; rung: Provenance } | null = null

  for (const row of rows) {
    if (row.category !== null && row.category !== category) continue
    if (!stillApplies(row, now)) continue

    const at = layerOf(row)
    // A rung only counts when its refId matches the context, so a row for a
    // different account or job can never leak into this answer.
    const rung = chain.find((r) => r.scope === at.scope && r.refId === at.refId)
    if (!rung) continue

    if (!winner) {
      winner = { row, rung }
      continue
    }

    const rank = rankOf(APP_SCOPE_TO_DB[rung.scope])
    const bestRank = rankOf(APP_SCOPE_TO_DB[winner.rung.scope])
    if (rank > bestRank) {
      winner = { row, rung }
    } else if (rank === bestRank && row.category !== null && winner.row.category === null) {
      // Same scope, and this one names the category. "Pause scheduling for
      // Acme" must beat "Acme is active" for a scheduling automation, or the
      // per-category control could never narrow an account-wide one.
      winner = { row, rung }
    }
  }

  if (!winner || winner.row.state === "active") return null

  return {
    state: winner.row.state as Exclude<AutomationRunState, "active">,
    source: winner.rung,
    category: winner.row.category,
    resumeAt: winner.row.resume_at,
  }
}

/**
 * The sentence rendered wherever an automation explains why it can't run.
 *
 * Deliberately does not format `resumeAt` — this module is pure and has no
 * viewer timezone or locale. The date is on `ScopeSwitch.resumeAt` for the UI
 * to render beside this.
 */
export function scopeSwitchLockReason(sw: ScopeSwitch): string {
  const where = sw.source.scope === "global" ? "platform-wide" : `for ${sw.source.label}`
  return sw.state === "paused"
    ? `Automations are paused ${where}.`
    : `Automations are off ${where}.`
}

/** "Off · Naehas" / "Paused · Global library" — the provenance subtext. */
export function scopeSwitchStateLabel(sw: ScopeSwitch): string {
  return `${sw.state === "paused" ? "Paused" : "Off"} · ${sw.source.label}`
}
