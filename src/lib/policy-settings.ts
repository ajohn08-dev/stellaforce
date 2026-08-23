/**
 * Shared machinery for the workflow policies that cascade — scheduling
 * (`src/lib/scheduling-policy.ts`) and communication
 * (`src/lib/communication-policy.ts`). Each policy owns its option lists and
 * defaults; this owns the shape of a setting, the scope order, and the
 * resolution rule they both use, so the two can't drift into disagreeing
 * about what "inherited" means.
 */

export type PolicySettingOption = { value: string; label: string }

export type PolicySettingDef = {
  key: string
  label: string
  description: string
  options: PolicySettingOption[]
  defaultValue: string
}

/** Option values are slugified labels, so a stored value survives a copy edit to its wording. */
export function slug(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
}

/**
 * Builds one setting from plain labels. `defaultOption` is given as a label and
 * slugified through the same function as the options, and asserted to be one of
 * them — a default that doesn't resolve would silently render an empty trigger.
 */
export function defineSetting(
  key: string,
  label: string,
  description: string,
  options: string[],
  defaultOption: string
): PolicySettingDef {
  if (!options.includes(defaultOption)) {
    throw new Error(`Setting "${key}": default "${defaultOption}" is not one of its options.`)
  }
  return {
    key,
    label,
    description,
    options: options.map((o) => ({ value: slug(o), label: o })),
    defaultValue: slug(defaultOption),
  }
}

export function defaultsOf(settings: PolicySettingDef[]): Record<string, string> {
  return Object.fromEntries(settings.map((s) => [s.key, s.defaultValue]))
}

/** Picks a named subset out of a policy's full setting list, in the order given. */
export function subsetOf(
  settings: PolicySettingDef[],
  keys: readonly string[]
): PolicySettingDef[] {
  return keys.map((key) => {
    const def = settings.find((s) => s.key === key)
    if (!def) throw new Error(`Unknown setting "${key}".`)
    return def
  })
}

/**
 * The cascade a policy setting resolves through, widest first — the same shape
 * `src/lib/workflow-settings.ts` and `src/lib/company-inheritance.ts` already
 * use. Nearest scope that has written a value wins; a scope that hasn't
 * written one is invisible to the resolution rather than blank.
 */
export const POLICY_SCOPES = ["system", "company", "workflow", "sub_stage", "job"] as const
export type PolicyScope = (typeof POLICY_SCOPES)[number]

export const POLICY_SCOPE_LABEL: Record<PolicyScope, string> = {
  system: "System defaults",
  company: "Company defaults",
  workflow: "Workflow defaults",
  sub_stage: "Sub-stage defaults",
  job: "Job defaults",
}

/** A partially-stored policy — anything absent falls back to the scope above it. */
export type StoredPolicy = { settings?: Record<string, string> }

/**
 * What each scope has written. `system` is supplied by the resolver from the
 * policy's own defaults and never passed in, so every setting always resolves
 * to something.
 */
export type PolicyLayers<T extends StoredPolicy> = Partial<
  Record<Exclude<PolicyScope, "system">, T | undefined>
>

export type Resolved<T> = { value: T; source: PolicyScope }

export function resolveLayered<T extends StoredPolicy, V>(
  layers: PolicyLayers<T>,
  pick: (policy: T) => V | undefined,
  systemValue: V
): Resolved<V> {
  let resolved: Resolved<V> = { value: systemValue, source: "system" }
  for (const scope of POLICY_SCOPES) {
    if (scope === "system") continue
    const layer = layers[scope]
    const value = layer ? pick(layer) : undefined
    if (value !== undefined) resolved = { value, source: scope }
  }
  return resolved
}

export function resolveSettingValue<T extends StoredPolicy>(
  key: string,
  layers: PolicyLayers<T>,
  systemDefaults: Record<string, string>
): Resolved<string> {
  return resolveLayered(layers, (p) => p.settings?.[key], systemDefaults[key])
}

/**
 * Drops anything that's back to inheriting, so a scope that overrides nothing
 * stores nothing at all rather than a copy of what it inherited.
 */
export function pruneStoredPolicy<T extends StoredPolicy>(policy: T): T | undefined {
  const { settings, ...rest } = policy
  const kept = Object.fromEntries(
    Object.entries(settings ?? {}).filter(([, v]) => v !== undefined)
  )
  const definedRest = Object.fromEntries(
    Object.entries(rest).filter(([, v]) => v !== undefined)
  )
  const next = {
    ...definedRest,
    ...(Object.keys(kept).length > 0 && { settings: kept }),
  } as T
  return Object.keys(next).length > 0 ? next : undefined
}
