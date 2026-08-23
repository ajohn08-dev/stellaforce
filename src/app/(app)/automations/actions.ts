"use server"

import { revalidatePath } from "next/cache"

import { getCurrentProfile } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { resolveAutomation } from "@/lib/automation-settings"
import type { AutomationRunState } from "@/lib/automation-rules"
import type { AutomationResolveContext, ResolvedAutomation } from "@/lib/automation-settings"

/**
 * Writes to the automation control plane.
 *
 * Shared rather than filed under `jobs/` because the same two writes will come
 * from the Workflow tab and the company Operations section; only the job
 * surface calls them today. Precedent: `src/app/(app)/agents/actions.ts`.
 *
 * Every write is sparse. Pausing a rule on a job stores one row saying so; it
 * never touches the global, company, or workflow binding it inherited from, and
 * it never copies the rule's configuration down.
 */

export type AutomationBindingTarget =
  | { scope: "global" }
  | { scope: "company"; clientId: string }
  | { scope: "workflow"; templateId: string }
  | { scope: "job"; jobId: string }

export type AutomationActionResult = { ok: true } | { ok: false; error: string }

/**
 * The columns that identify one binding row. A discriminated union in, a single
 * shape out — so `automation_bindings_one_scope` is unrepresentable here rather
 * than merely checked by the database.
 */
type BindingKey = {
  company_scope_client_id: string | null
  workflow_template_id: string | null
  job_id: string | null
}

const KEY_COLUMNS = [
  "company_scope_client_id",
  "workflow_template_id",
  "job_id",
] as const satisfies readonly (keyof BindingKey)[]

function bindingKey(target: AutomationBindingTarget): BindingKey {
  const empty: BindingKey = {
    company_scope_client_id: null,
    workflow_template_id: null,
    job_id: null,
  }
  switch (target.scope) {
    case "company":
      return { ...empty, company_scope_client_id: target.clientId }
    case "workflow":
      return { ...empty, workflow_template_id: target.templateId }
    case "job":
      return { ...empty, job_id: target.jobId }
    default:
      return empty
  }
}

// ── Server-side context, never taken from the caller ─────────────────────────

type TargetContext = {
  tenantClientId: string | null
  resolveContext: AutomationResolveContext
  revalidate: string[]
}

/**
 * Resolve the tenant and the cascade context from the target's own id.
 *
 * The tenant matters twice: `automation_bindings.tenant_client_id` is what the
 * `tenant_write` RLS policy checks, so omitting it is a silent 403 for a
 * client-side user; and re-deriving it here rather than accepting it from the
 * client is what stops a caller writing a row into someone else's tenant.
 */
async function targetContext(
  target: AutomationBindingTarget
): Promise<TargetContext | { error: string }> {
  const supabase = await createClient()

  switch (target.scope) {
    case "global":
      return {
        tenantClientId: null,
        resolveContext: {},
        revalidate: ["/automations", "/workflows", "/companies"],
      }

    case "company":
      return {
        tenantClientId: target.clientId,
        resolveContext: { companyId: target.clientId },
        revalidate: ["/automations", `/companies/${target.clientId}`],
      }

    case "workflow": {
      const { data } = await supabase
        .from("workflow_templates")
        .select("client_id")
        .eq("id", target.templateId)
        .maybeSingle()
      if (!data) return { error: "That workflow no longer exists." }
      return {
        // Null for a Stellaforce-global template, which is legitimate: the
        // binding is owned by nobody and only Stellaforce may write it.
        tenantClientId: data.client_id,
        resolveContext: { companyId: data.client_id, flowId: target.templateId },
        revalidate: ["/automations", "/workflows", `/workflows/${target.templateId}`],
      }
    }

    case "job": {
      const { data } = await supabase
        .from("job_orders")
        .select("client_id, workflow_template_id")
        .eq("job_id", target.jobId)
        .maybeSingle()
      if (!data) return { error: "That job no longer exists." }
      return {
        tenantClientId: data.client_id,
        resolveContext: {
          companyId: data.client_id,
          flowId: data.workflow_template_id,
          jobId: target.jobId,
        },
        revalidate: ["/automations", `/jobs/${target.jobId}`],
      }
    }
  }
}

/**
 * Authenticate, resolve the target, and re-check that this change is allowed —
 * against the resolver, not against whatever the UI believed when it rendered.
 * A disabled button is a courtesy; this is the rule.
 */
async function guard(
  definitionId: string,
  target: AutomationBindingTarget
): Promise<
  | { error: string }
  | { context: TargetContext; automation: ResolvedAutomation; actorId: string }
> {
  const profile = await getCurrentProfile()
  if (!profile) return { error: "You need to be signed in to change automations." }

  const context = await targetContext(target)
  if ("error" in context) return context

  const supabase = await createClient()
  const { data: definition } = await supabase
    .from("automation_definitions")
    .select("key")
    .eq("id", definitionId)
    .maybeSingle()
  if (!definition) return { error: "That automation no longer exists." }

  const automation = await resolveAutomation(definition.key, context.resolveContext)
  if (!automation) return { error: "That automation no longer exists." }

  // System-managed safeguards -- calendar final validation, slot locking,
  // secure-link validation -- are not a customer toggle at any scope.
  if (automation.isLocked) {
    return { error: automation.lockedReason ?? "This automation can't be changed." }
  }
  if (!automation.isApplicable) {
    return { error: "That automation has no published version to run." }
  }

  return { context, automation, actorId: profile.id }
}

// ── Writes ───────────────────────────────────────────────────────────────────

/**
 * Set an automation's state at one scope.
 *
 * Covers all three job gestures the dialog offers — pause an active rule,
 * resume a paused one, and turn on a rule that a wider scope left `off`. That
 * last one is why an inherited `off` is not a lock: the source layer decided
 * the default, and a job is allowed to disagree with it.
 */
export async function setAutomationState(input: {
  definitionId: string
  target: AutomationBindingTarget
  state: AutomationRunState
  note?: string | null
}): Promise<AutomationActionResult> {
  const checked = await guard(input.definitionId, input.target)
  if ("error" in checked) return { ok: false, error: checked.error }
  const { context, automation, actorId } = checked

  const supabase = await createClient()
  const key = bindingKey(input.target)

  const previous = {
    state: automation.effectiveState,
    source: automation.stateSource.scope,
  }

  // Read-then-write rather than .upsert(): PostgREST's onConflict needs a named
  // constraint, and these are partial unique indexes it can't target.
  let query = supabase
    .from("automation_bindings")
    .select("id")
    .eq("automation_definition_id", input.definitionId)
  for (const column of KEY_COLUMNS) {
    const value = key[column]
    query = value === null ? query.is(column, null) : query.eq(column, value)
  }
  const { data: existing } = await query.maybeSingle()

  const result = existing
    ? await supabase
        .from("automation_bindings")
        .update({
          state: input.state,
          set_by: actorId,
          note: input.note ?? null,
        })
        .eq("id", existing.id)
        .select("id")
        .single()
    : await supabase
        .from("automation_bindings")
        .insert({
          automation_definition_id: input.definitionId,
          state: input.state,
          tenant_client_id: context.tenantClientId,
          set_by: actorId,
          note: input.note ?? null,
          ...key,
        })
        .select("id")
        .single()

  if (result.error) {
    // 23505: two people changed the same rule at once. The partial unique did
    // its job and the other write landed, so there is nothing to retry.
    if (result.error.code === "23505") return { ok: true }
    return { ok: false, error: result.error.message }
  }

  await writeAuditRow({
    bindingId: result.data.id,
    clientId: context.tenantClientId,
    actorProfileId: actorId,
    action: "state_changed",
    diff: {
      definition_key: automation.key,
      target_scope: input.target.scope,
      target_ref_id: refIdOf(input.target),
      from: previous,
      to: { state: input.state, source: input.target.scope },
      note: input.note ?? null,
    },
  })

  context.revalidate.forEach((path) => revalidatePath(path))
  return { ok: true }
}

/**
 * Drop this scope's override and go back to inheriting.
 *
 * A DELETE, not a row of nulls: `state` is NOT NULL precisely so a binding that
 * overrides nothing cannot exist, which is the same rule `pruneStoredPolicy`
 * follows in `src/lib/policy-settings.ts`. Storing "inherit" explicitly would
 * be a copy of a value that is free to change underneath it.
 */
export async function resetAutomationToInherited(input: {
  definitionId: string
  target: AutomationBindingTarget
}): Promise<AutomationActionResult> {
  if (input.target.scope === "global") {
    return { ok: false, error: "The global library has nothing to inherit from." }
  }

  const checked = await guard(input.definitionId, input.target)
  if ("error" in checked) return { ok: false, error: checked.error }
  const { context, automation, actorId } = checked

  const supabase = await createClient()
  const key = bindingKey(input.target)

  let query = supabase
    .from("automation_bindings")
    .delete()
    .eq("automation_definition_id", input.definitionId)
  for (const column of KEY_COLUMNS) {
    const value = key[column]
    query = value === null ? query.is(column, null) : query.eq(column, value)
  }
  // Captured before the delete -- entity_id would otherwise point at nothing.
  const { data: deleted, error } = await query.select("id").maybeSingle()

  if (error) return { ok: false, error: error.message }
  // Nothing stored here: already inherited. Not an error, and re-resolving to
  // report "no change" would just be noise.
  if (!deleted) return { ok: true }

  await writeAuditRow({
    bindingId: deleted.id,
    clientId: context.tenantClientId,
    actorProfileId: actorId,
    action: "reset_to_inherited",
    diff: {
      definition_key: automation.key,
      target_scope: input.target.scope,
      target_ref_id: refIdOf(input.target),
      from: { state: automation.effectiveState, source: input.target.scope },
      to: null,
    },
  })

  context.revalidate.forEach((path) => revalidatePath(path))
  return { ok: true }
}

// ── Audit ────────────────────────────────────────────────────────────────────

function refIdOf(target: AutomationBindingTarget): string | null {
  switch (target.scope) {
    case "company":
      return target.clientId
    case "workflow":
      return target.templateId
    case "job":
      return target.jobId
    default:
      return null
  }
}

/**
 * `audit_log`, not `activity_events`.
 *
 * The audit table's own purpose is config governance — who changed a template
 * or a setting — and this is exactly that. An activity event would put "someone
 * paused an automation" into the candidate-and-job timeline, which is a record
 * of what happened to people, not of what an admin configured.
 */
async function writeAuditRow(input: {
  bindingId: string
  clientId: string | null
  actorProfileId: string | null
  action: "state_changed" | "reset_to_inherited"
  diff: Record<string, unknown>
}) {
  const supabase = await createClient()
  await supabase.from("audit_log").insert({
    actor_profile_id: input.actorProfileId,
    client_id: input.clientId,
    entity_type: "automation_binding",
    entity_id: input.bindingId,
    action: input.action,
    diff: input.diff as never,
  })
}
