/**
 * The automation vocabulary the UI speaks: what state a rule is in, and where
 * that was decided.
 *
 * This file used to hold fourteen hand-written rules and a `STATE` fixture map.
 * Both are gone — the rules are rows in `automation_definitions` +
 * `automation_definition_versions`, their per-scope state is
 * `automation_bindings`, and both are read through `resolveAutomations()` in
 * `src/lib/automation-settings.ts`. What survives is the vocabulary, because it
 * is client-safe (no `server-only`) and the types below are what the resolver's
 * output is spelled in.
 */

/**
 * Where a rule's state was decided. Four scopes, each one somewhere a person
 * can go and change it — "why is this off?" is only a useful answer if it names
 * a destination.
 *
 * The DB calls the second rung `client` (`settings_scope`); the app has always
 * called it `company`. The two are mapped in exactly one place,
 * `DB_SCOPE_TO_APP` in `src/lib/automation-settings.ts`.
 */
export type AutomationScope = "global" | "company" | "workflow" | "job"

export const AUTOMATION_SCOPE_LABEL: Record<AutomationScope, string> = {
  global: "Global library",
  company: "Company",
  workflow: "Workflow",
  job: "Job override",
}

/**
 * Three states, not a boolean, and each means something the others don't:
 *
 * - **Active** — it will run here.
 * - **Paused** — it was running and someone suspended it on purpose. The one
 *   that earns its place: an automation switched off for a fortnight while a
 *   hiring manager is away is a different thing from one this company never
 *   runs, and collapsing them loses the only fact anyone needs later — whether
 *   it's coming back.
 * - **Off** — a source layer disabled it. Not a failure and not a lock: a job
 *   may turn an inherited-off rule back on, which is exactly what
 *   `canActivateForJob` is for.
 *
 * `off` rather than `stopped` deliberately. Runtime verbs — pending, running,
 * succeeded, failed, skipped, cancelled — belong to the executor when it lands,
 * and a saved configuration state must not share a word with an execution
 * outcome.
 */
export type AutomationRunState = "active" | "paused" | "off"

export const AUTOMATION_RUN_STATE_LABEL: Record<AutomationRunState, string> = {
  active: "Active",
  paused: "Paused",
  off: "Off",
}
