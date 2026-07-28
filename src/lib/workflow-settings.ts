import "server-only"

import { createClient } from "@/lib/supabase/server"
import { isSupabaseConfigured } from "@/lib/env"
import type {
  AutomationRuleRow,
  CommunicationTemplateRow,
  Json,
  SettingsScope,
  SlaPolicyRow,
  WorkflowSettingRow,
} from "@/lib/supabase/types"

/**
 * Cross-cutting workflow settings resolve through a cascade
 * global → client → workflow → job (most-specific wins). Global rows are
 * seeded defaults; workflows/jobs hold sparse overrides. This helper computes
 * the effective settings for a given (client, template, job) context; it is
 * reused both for display and at job-publish (to snapshot the resolved values
 * as `scope='job'` rows so the published job is self-contained).
 */

export type ResolvedWorkflowSettings = {
  /** category (e.g. 'scheduling' | 'ai_capabilities') → merged config object */
  settings: Record<string, Record<string, Json>>
  /** effective SLA policies keyed by sla_type */
  sla: SlaPolicyRow[]
  /** effective automation rules keyed by trigger_event_type */
  automations: AutomationRuleRow[]
  /** effective communication templates keyed by trigger_event_type + channel */
  communications: CommunicationTemplateRow[]
}

const SCOPE_RANK: Record<SettingsScope, number> = {
  global: 0,
  client: 1,
  workflow: 2,
  job: 3,
}

export type ResolveContext = {
  clientId?: string | null
  templateId?: string | null
  jobId?: string | null
}

/** Build the (scope, scope_id) pairs that apply to a context, least→most specific. */
function applicableScopes(ctx: ResolveContext): { scope: SettingsScope; scopeId: string | null }[] {
  const scopes: { scope: SettingsScope; scopeId: string | null }[] = [
    { scope: "global", scopeId: null },
  ]
  if (ctx.clientId) scopes.push({ scope: "client", scopeId: ctx.clientId })
  if (ctx.templateId) scopes.push({ scope: "workflow", scopeId: ctx.templateId })
  if (ctx.jobId) scopes.push({ scope: "job", scopeId: ctx.jobId })
  return scopes
}

function rankOf(scope: SettingsScope): number {
  return SCOPE_RANK[scope]
}

/** True when `row` is one of the applicable scopes for `ctx`. */
function matchesContext(
  row: { scope: SettingsScope; scope_id: string | null },
  ctx: ResolveContext
): boolean {
  switch (row.scope) {
    case "global":
      return true
    case "client":
      return !!ctx.clientId && row.scope_id === ctx.clientId
    case "workflow":
      return !!ctx.templateId && row.scope_id === ctx.templateId
    case "job":
      return !!ctx.jobId && row.scope_id === ctx.jobId
    default:
      return false
  }
}

/** Collapse rows to one-per-key, most-specific scope winning. */
function overrideByKey<T extends { scope: SettingsScope; scope_id: string | null }>(
  rows: T[],
  ctx: ResolveContext,
  keyOf: (row: T) => string
): T[] {
  const winner = new Map<string, T>()
  for (const row of rows) {
    if (!matchesContext(row, ctx)) continue
    const key = keyOf(row)
    const current = winner.get(key)
    if (!current || rankOf(row.scope) >= rankOf(current.scope)) winner.set(key, row)
  }
  return [...winner.values()]
}

export async function resolveWorkflowSettings(
  ctx: ResolveContext
): Promise<ResolvedWorkflowSettings> {
  const empty: ResolvedWorkflowSettings = {
    settings: {},
    sla: [],
    automations: [],
    communications: [],
  }
  if (!isSupabaseConfigured) return empty

  const supabase = await createClient()
  const scopes = applicableScopes(ctx)
  const scopeVals = scopes.map((s) => s.scope)

  // Fetch all rows for the applicable scopes, then filter/merge in memory.
  const [settingsRes, slaRes, autoRes, commsRes] = await Promise.all([
    supabase.from("workflow_settings").select("*").in("scope", scopeVals),
    supabase.from("sla_policies").select("*").in("scope", scopeVals),
    supabase.from("automation_rules").select("*").in("scope", scopeVals),
    supabase.from("communication_templates").select("*").in("scope", scopeVals),
  ])

  // workflow_settings: shallow-merge each category's config across scopes.
  const settings: Record<string, Record<string, Json>> = {}
  const settingsRows = (settingsRes.data ?? []) as WorkflowSettingRow[]
  settingsRows
    .filter((r) => matchesContext(r, ctx))
    .sort((a, b) => rankOf(a.scope) - rankOf(b.scope))
    .forEach((r) => {
      const prev = settings[r.category] ?? {}
      settings[r.category] = { ...prev, ...((r.config as Record<string, Json>) ?? {}) }
    })

  return {
    settings,
    sla: overrideByKey((slaRes.data ?? []) as SlaPolicyRow[], ctx, (r) => r.sla_type),
    automations: overrideByKey(
      (autoRes.data ?? []) as AutomationRuleRow[],
      ctx,
      (r) => r.trigger_event_type
    ),
    communications: overrideByKey(
      (commsRes.data ?? []) as CommunicationTemplateRow[],
      ctx,
      (r) => `${r.trigger_event_type}:${r.channel}`
    ),
  }
}
