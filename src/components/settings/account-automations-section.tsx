import { AccountAutomationRows } from "@/components/settings/account-automation-rows"
import type { AccountSwitchView } from "@/components/settings/account-automation-rows"
import { getCurrentProfile } from "@/lib/auth"
import { isAccountAdmin, isPlatformAdmin } from "@/lib/permissions"
import { createClient } from "@/lib/supabase/server"
import { isSupabaseConfigured } from "@/lib/env"
import type { AutomationRunState } from "@/lib/automation-rules"

/**
 * Whether each account is running automations — a section of Platform settings,
 * not a page of its own.
 *
 * It lives here rather than under Operations beside `/automations` because that
 * page is the rule *library*: what automations exist and what each one does.
 * This is one account-level switch an admin sets and then leaves alone, and
 * giving it its own nav entry put a second item called "Automations" in the
 * sidebar directly above the first. The library links here from its banner
 * instead, which is the only place the two need to meet.
 *
 * The accounts are independent: Stellaforce's own account can be off while a
 * client's runs, and the reverse. Global is the default for accounts that
 * haven't decided — not a ceiling — which is why the default and the accounts
 * render as peers rather than as a hierarchy.
 *
 * Stellaforce is itself a `clients` row (it owns jobs), so it appears in the
 * list like any other account. There is no separate "internal" level.
 */
export async function AccountAutomationsSection() {
  const profile = await getCurrentProfile()
  if (!isSupabaseConfigured || !profile) return null

  const canEditGlobal = isPlatformAdmin(profile)
  const canEditAny = isAccountAdmin(profile)
  const supabase = await createClient()

  const [{ data: clients }, { data: switches }, { data: jobs }] = await Promise.all([
    supabase.from("clients").select("client_id, client_name").order("client_name"),
    supabase
      .from("automation_scope_settings")
      .select("state, category, resume_at, scope, company_scope_client_id")
      // Account-wide rows only. Per-category rows are a narrower control that
      // belongs beside the automations they affect, not in this list.
      .is("category", null),
    supabase.from("job_orders").select("client_id").in("status", ["open", "draft"]),
  ])

  const globalRow = (switches ?? []).find((s) => s.scope === "global") ?? null
  const globalState: AutomationRunState = (globalRow?.state as AutomationRunState) ?? "active"

  const jobCounts = new Map<string, number>()
  for (const j of jobs ?? []) {
    jobCounts.set(j.client_id, (jobCounts.get(j.client_id) ?? 0) + 1)
  }

  // A client admin sees only their own account; Stellaforce staff see all.
  const visible = (clients ?? []).filter(
    (c) => profile.side === "stellaforce" || c.client_id === profile.client_id
  )

  const rows: AccountSwitchView[] = visible.map((c) => {
    const own = (switches ?? []).find((s) => s.company_scope_client_id === c.client_id) ?? null
    const ownState = (own?.state as AutomationRunState | undefined) ?? null
    return {
      clientId: c.client_id,
      name: c.client_name,
      ownState,
      resumeAt: own?.resume_at ?? null,
      effectiveState: ownState ?? globalState,
      inherited: ownState === null,
      jobCount: jobCounts.get(c.client_id) ?? 0,
      editable:
        canEditAny && (profile.side === "stellaforce" || profile.client_id === c.client_id),
    }
  })

  const globalView: AccountSwitchView = {
    clientId: null,
    name: "Default for new accounts",
    ownState: (globalRow?.state as AutomationRunState | undefined) ?? null,
    resumeAt: globalRow?.resume_at ?? null,
    effectiveState: globalState,
    inherited: !globalRow,
    jobCount: 0,
    editable: canEditGlobal,
  }

  // The heading and the one-line purpose come from `SETTINGS_SECTIONS`, so the
  // rail label and the section title can't drift apart.
  return (
    <AccountAutomationRows
      global={profile.side === "stellaforce" ? globalView : null}
      accounts={rows}
      readOnly={!canEditAny}
    />
  )
}
