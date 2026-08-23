import { rankOf } from "@/lib/settings-scope"
import {
  AUTOMATION_EVENT_GROUPS,
  DEFAULT_AUTOMATION_MODE,
  type AutomationMode,
} from "@/lib/automation-events"
import {
  AUTOMATION_SCOPE_LABEL,
  type AutomationRunState,
  type AutomationScope,
} from "@/lib/automation-rules"
import type {
  ActivityEventType,
  AutomationBindingRow,
  AutomationDefinitionRow,
  AutomationDefinitionVersionRow,
  SettingsScope,
} from "@/lib/supabase/types"

/**
 * The one authoritative automation resolver — the pure half.
 *
 * An automation is defined once, globally and versioned
 * (`automation_definitions` + `automation_definition_versions`), and applied by
 * sparse per-scope rows (`automation_bindings`) along the cascade
 * `global → company → workflow → job`. Nothing is copied down: a job that pauses
 * one rule stores one row saying so, which is why a later fix to the global
 * library still reaches it.
 *
 * The product here is not just the answer but **where the answer came from** —
 * "Active · Workflow" is the whole reason the job dialog exists. So the resolver
 * returns every applicable layer, marked, rather than the winner alone.
 *
 * Deliberately separate from `resolveWorkflowSettings`, whose `overrideByKey()`
 * discards the losing rows and keys on `trigger_event_type` (two rules on one
 * trigger would silently collapse). Its automations branch has been removed so
 * there is exactly one cascade in the codebase that answers this question.
 *
 * **No Supabase and no `server-only` here, on purpose.** The loading half lives
 * in `automation-settings.ts`; this half takes rows and returns answers, so
 * `npm run automation-check` drives the real inheritance logic rather than a
 * re-implementation of it, and client components can import its types.
 */

// ── Scope vocabulary ─────────────────────────────────────────────────────────
// The DB says `client`; the app has always said `company`. Mapped here and
// nowhere else -- `settings_scope` is the column type on four tables and the key
// type of SCOPE_RANK, so it is not renameable.

export const DB_SCOPE_TO_APP: Record<SettingsScope, AutomationScope> = {
  global: "global",
  client: "company",
  workflow: "workflow",
  job: "job",
}

export const APP_SCOPE_TO_DB: Record<AutomationScope, SettingsScope> = {
  global: "global",
  company: "client",
  workflow: "workflow",
  job: "job",
}

/** A scope, with the words the UI shows for it. */
export type Provenance = {
  scope: AutomationScope
  refId: string | null
  /** "Global library" · the company name · the template name · "This job". */
  label: string
}

/**
 * One rung of the cascade for one automation. Every applicable rung is present,
 * including the ones that lost — the stack is what explains inheritance, and a
 * resolver that returns only the winner cannot be asked "why".
 */
export type AutomationLayer = Provenance & {
  /** Null when this scope stores no binding, i.e. it inherits. */
  bindingId: string | null
  state: AutomationRunState | null
  wins: boolean
}

export type AutomationFacet = { key: string; label: string }

export type ResolvedAutomation = {
  definitionId: string
  key: string
  name: string
  /** 'lifecycle' | 'scheduling' | 'evaluation' — an `AutomationSectionKey`. */
  category: string
  triggerEventType: ActivityEventType

  effectiveState: AutomationRunState
  stateSource: Provenance
  /** Widest → narrowest. */
  sourceChain: AutomationLayer[]

  /** False when the definition is archived or has no published version. */
  isApplicable: boolean

  /** The current actor/scope may not change this rule at all. */
  isLocked: boolean
  lockedReason: string | null

  /**
   * Effective state is active but a dependency it needs is missing. Distinct
   * from `off` (a source layer disabled it, and a job may turn it back on) and
   * from `locked` (a permission). Always false in this pass — see below.
   */
  isBlocked: boolean
  blockReason: string | null

  systemManaged: boolean
  canPauseForJob: boolean
  canActivateForJob: boolean
  canResetToInherited: boolean

  conditionText: string
  actions: AutomationFacet[]
  tasksAndReminders: AutomationFacet[]
  exceptions: AutomationFacet[]
  slaType: string | null
  /**
   * The version's authored approval posture — a property of the *rule*, like
   * its actions, not of any binding. Descriptive until an executor exists.
   *
   * Note this is `automation_definition_versions.default_mode`. There is
   * deliberately no per-scope mode override: a second axis a job could change
   * would need its own inheritance, its own provenance badge and its own reset,
   * for a field nothing reads yet.
   */
  defaultMode: AutomationMode
}

export type AutomationResolveContext = {
  /** `clients.client_id`. */
  companyId?: string | null
  /** `workflow_templates.id` — the Flow the job runs. */
  flowId?: string | null
  /** `job_orders.job_id`. */
  jobId?: string | null
}

type ScopeLabels = {
  companyName?: string | null
  flowName?: string | null
  jobTitle?: string | null
}

const LOCKED_SYSTEM_MANAGED =
  "System-managed safeguard — this can't be changed here."

/**
 * Curated display order. The DB has no `display_order` column, and the order
 * these read in is a presentation decision that belongs with the labels;
 * `npm run automation-check` asserts the two lists stay 1:1, so this cannot
 * silently drift from what is seeded.
 */
const KEY_ORDER = new Map(
  AUTOMATION_EVENT_GROUPS.flatMap((g) => g.events).map((e, i) => [e.id, i])
)

// ── The cascade ──────────────────────────────────────────────────────────────

/** Every rung that applies to a context, widest → narrowest. */
export function scopeChain(ctx: AutomationResolveContext, labels: ScopeLabels): Provenance[] {
  const chain: Provenance[] = [
    { scope: "global", refId: null, label: AUTOMATION_SCOPE_LABEL.global },
  ]
  if (ctx.companyId) {
    chain.push({
      scope: "company",
      refId: ctx.companyId,
      label: labels.companyName || AUTOMATION_SCOPE_LABEL.company,
    })
  }
  if (ctx.flowId) {
    chain.push({
      scope: "workflow",
      refId: ctx.flowId,
      label: labels.flowName || AUTOMATION_SCOPE_LABEL.workflow,
    })
  }
  if (ctx.jobId) {
    chain.push({
      scope: "job",
      refId: ctx.jobId,
      label: AUTOMATION_SCOPE_LABEL.job,
    })
  }
  // Shares its ordering with resolveWorkflowSettings rather than re-deciding it,
  // so two cascades can't disagree about what "more specific" means.
  return chain.sort((a, b) => rankOf(APP_SCOPE_TO_DB[a.scope]) - rankOf(APP_SCOPE_TO_DB[b.scope]))
}

/** Which rung a stored binding sits on. Reads `scope`, never the tenant column. */
function layerOf(binding: AutomationBindingRow): { scope: AutomationScope; refId: string | null } {
  const scope = DB_SCOPE_TO_APP[binding.scope]
  switch (scope) {
    case "company":
      return { scope, refId: binding.company_scope_client_id }
    case "workflow":
      return { scope, refId: binding.workflow_template_id }
    case "job":
      return { scope, refId: binding.job_id }
    default:
      return { scope: "global", refId: null }
  }
}

/**
 * The pure core. No Supabase, so the dry-run script and any test can drive the
 * real inheritance logic rather than a re-implementation of it.
 */
export function resolveFromRows(input: {
  definitions: AutomationDefinitionRow[]
  versions: AutomationDefinitionVersionRow[]
  bindings: AutomationBindingRow[]
  ctx: AutomationResolveContext
  labels?: ScopeLabels
}): ResolvedAutomation[] {
  const { definitions, versions, bindings, ctx } = input
  const chain = scopeChain(ctx, input.labels ?? {})
  const onJob = Boolean(ctx.jobId)

  const publishedByDefinition = new Map<string, AutomationDefinitionVersionRow>()
  for (const v of versions) {
    if (v.status === "published") publishedByDefinition.set(v.definition_id, v)
  }

  const bindingsByDefinition = new Map<string, AutomationBindingRow[]>()
  for (const b of bindings) {
    const list = bindingsByDefinition.get(b.automation_definition_id)
    if (list) list.push(b)
    else bindingsByDefinition.set(b.automation_definition_id, [b])
  }

  const resolved = definitions.map((definition) => {
    const version = publishedByDefinition.get(definition.id) ?? null
    const forDefinition = bindingsByDefinition.get(definition.id) ?? []

    // One layer per applicable rung, carrying its binding if it has one. A rung
    // only counts when its refId matches the context, so a binding on a
    // *different* job or template can never leak into this answer.
    const layers: AutomationLayer[] = chain.map((rung) => {
      const binding =
        forDefinition.find((b) => {
          const at = layerOf(b)
          return at.scope === rung.scope && at.refId === rung.refId
        }) ?? null
      return {
        ...rung,
        bindingId: binding?.id ?? null,
        state: (binding?.state as AutomationRunState | undefined) ?? null,
        wins: false,
      }
    })

    // Narrowest wins. Walk backwards for the first rung that actually stored
    // something; everything wider is inherited past.
    let winner: AutomationLayer | null = null
    for (let i = layers.length - 1; i >= 0; i--) {
      if (layers[i].state !== null) {
        winner = layers[i]
        layers[i].wins = true
        break
      }
    }

    // No binding anywhere is not a real state, but it must resolve to something
    // rather than throw. Every seeded definition has a global binding, so this
    // is the shape of a definition added without one.
    const effectiveState: AutomationRunState = winner?.state ?? "off"
    const stateSource: Provenance = winner ?? layers[0]

    const isApplicable = definition.archived_at === null && version !== null
    const systemManaged = definition.system_managed
    const isLocked = systemManaged
    const jobLayer = layers.find((l) => l.scope === "job") ?? null
    const changeable = onJob && isApplicable && !isLocked

    return {
      definitionId: definition.id,
      key: definition.key,
      name: definition.name,
      category: definition.category,
      triggerEventType: definition.trigger_event_type,

      effectiveState,
      stateSource,
      sourceChain: layers,

      isApplicable,
      isLocked,
      lockedReason: isLocked ? LOCKED_SYSTEM_MANAGED : null,

      // Always false in this pass. A dependency check needs something real to
      // read -- a missing google_calendar_connections row for a scheduling
      // rule, or an sla_type resolving to no enabled sla_policies row -- and
      // both belong with the executor that would act on them. Inventing runtime
      // health here would put an amber warning on screen that means nothing.
      isBlocked: false,
      blockReason: null,

      systemManaged,
      canPauseForJob: changeable && effectiveState === "active",
      canActivateForJob: changeable && effectiveState !== "active",
      canResetToInherited: changeable && jobLayer?.bindingId != null,

      conditionText: version?.condition_text ?? "",
      actions: facetsOf(version?.actions),
      tasksAndReminders: facetsOf(version?.tasks_and_reminders),
      exceptions: facetsOf(version?.exceptions),
      slaType: version?.sla_type ?? null,
      defaultMode: (version?.default_mode as AutomationMode | undefined) ?? DEFAULT_AUTOMATION_MODE,
    } satisfies ResolvedAutomation
  })

  return resolved.sort(
    (a, b) => (KEY_ORDER.get(a.key) ?? Number.MAX_SAFE_INTEGER) - (KEY_ORDER.get(b.key) ?? Number.MAX_SAFE_INTEGER)
  )
}

/** `[{key,label}]` out of a jsonb column, tolerating anything malformed. */
function facetsOf(value: unknown): AutomationFacet[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return []
    const { key, label } = entry as { key?: unknown; label?: unknown }
    if (typeof key !== "string" || typeof label !== "string") return []
    return [{ key, label }]
  })
}
