import "server-only"

import { createClient } from "@/lib/supabase/server"
import { isSupabaseConfigured } from "@/lib/env"
import { resolveFromRows } from "@/lib/automation-resolve"
import type { AutomationResolveContext, ResolvedAutomation } from "@/lib/automation-resolve"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase/types"

/**
 * Either the request-scoped session client or the service-role admin client.
 * Which one you pass decides whether RLS applies to the resolve.
 */
export type AutomationLoadClient = SupabaseClient<Database>

/**
 * Loading half of the automation resolver. Everything about *how* inheritance
 * works lives in `automation-resolve.ts`; this file only decides which rows to
 * fetch and hands them over.
 */

export type {
  AutomationFacet,
  AutomationLayer,
  AutomationResolveContext,
  Provenance,
  ResolvedAutomation,
} from "@/lib/automation-resolve"
export { APP_SCOPE_TO_DB, DB_SCOPE_TO_APP, resolveFromRows, scopeChain } from "@/lib/automation-resolve"

type ScopeLabels = {
  companyName?: string | null
  flowName?: string | null
  jobTitle?: string | null
}

// ── Loading ──────────────────────────────────────────────────────────────────

/**
 * Every automation in the library, resolved for a context, using the signed-in
 * user's session client. For Server Components and Server Actions.
 */
export async function resolveAutomations(
  ctx: AutomationResolveContext
): Promise<ResolvedAutomation[]> {
  if (!isSupabaseConfigured) return []
  return resolveAutomationsWithClient(await createClient(), ctx)
}

/**
 * The same resolve, against a client you supply.
 *
 * ⚠️ **Required for anything without a session** — the cron dispatcher, the n8n
 * gate re-check route, and the public booking page all run with the service-role
 * admin client. Under RLS a sessionless caller reads **zero** definitions, and
 * the resolver's documented behaviour with no winning binding is
 * `effectiveState = 'off'`. That fails closed, which is the right direction, but
 * it would mean the gate answered "off" for every automation from cron while
 * working perfectly in the browser.
 */
export async function resolveAutomationsWithClient(
  supabase: AutomationLoadClient,
  ctx: AutomationResolveContext
): Promise<ResolvedAutomation[]> {
  if (!isSupabaseConfigured) return []

  const [definitionsRes, versionsRes, bindingsRes, labels] = await Promise.all([
    supabase
      .from("automation_definitions")
      .select("*")
      .is("archived_at", null)
      .order("key"),
    supabase
      .from("automation_definition_versions")
      .select("*")
      .eq("status", "published"),
    // Only the rungs this context can inherit from. A binding on another job or
    // another template is not merely filtered later -- it is never fetched.
    supabase
      .from("automation_bindings")
      .select("*")
      .or(scopeFilter(ctx)),
    scopeLabels(supabase, ctx),
  ])

  const definitions = (definitionsRes.data ?? []).filter(
    // A bespoke definition belongs to one customer; the global library is
    // everyone's. RLS enforces this too -- this keeps another tenant's rows out
    // of a Stellaforce user's view, where RLS deliberately does not.
    (d) => d.client_id === null || d.client_id === ctx.companyId
  )

  return resolveFromRows({
    definitions,
    versions: versionsRes.data ?? [],
    bindings: bindingsRes.data ?? [],
    ctx,
    labels,
  })
}

/** One automation by key, same cascade, session client. */
export async function resolveAutomation(
  key: string,
  ctx: AutomationResolveContext
): Promise<ResolvedAutomation | null> {
  const all = await resolveAutomations(ctx)
  return all.find((a) => a.key === key) ?? null
}

/** One automation by key, against a client you supply. See the warning above. */
export async function resolveAutomationWithClient(
  supabase: AutomationLoadClient,
  key: string,
  ctx: AutomationResolveContext
): Promise<ResolvedAutomation | null> {
  const all = await resolveAutomationsWithClient(supabase, ctx)
  return all.find((a) => a.key === key) ?? null
}

/** PostgREST `or=` covering exactly the rungs in this context's chain. */
function scopeFilter(ctx: AutomationResolveContext): string {
  const clauses = ["scope.eq.global"]
  if (ctx.companyId) clauses.push(`company_scope_client_id.eq.${ctx.companyId}`)
  if (ctx.flowId) clauses.push(`workflow_template_id.eq.${ctx.flowId}`)
  if (ctx.jobId) clauses.push(`job_id.eq.${ctx.jobId}`)
  return clauses.join(",")
}

/**
 * The names the provenance badges show. Without these a job row would read
 * "Active · Company" where it should read "Active · Acme Robotics" — the point
 * of naming the source is that you can go and change it there.
 */
async function scopeLabels(
  supabase: AutomationLoadClient,
  ctx: AutomationResolveContext
): Promise<ScopeLabels> {
  if (!isSupabaseConfigured) return {}
  const [company, flow] = await Promise.all([
    ctx.companyId
      ? supabase.from("clients").select("client_name").eq("client_id", ctx.companyId).maybeSingle()
      : Promise.resolve({ data: null }),
    ctx.flowId
      ? supabase.from("workflow_templates").select("name").eq("id", ctx.flowId).maybeSingle()
      : Promise.resolve({ data: null }),
  ])
  return {
    companyName: company.data?.client_name ?? null,
    flowName: flow.data?.name ?? null,
  }
}
