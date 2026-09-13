import { resolveFromRows, scopeChain, type AutomationResolveContext } from "@/lib/automation-resolve"
import { resolveScopeSwitch, type ScopeSwitchRow } from "@/lib/automation-scope-state"
import type {
  AutomationBindingRow,
  AutomationDefinitionRow,
  AutomationDefinitionVersionRow,
} from "@/lib/supabase/types"

/**
 * The account-wide automation switch, driven headless through the real
 * resolvers rather than a re-implementation of them.
 *
 * The case that matters most is the one this design was rewritten for: two
 * accounts deciding independently. An earlier draft unioned the levels
 * fail-closed, which made "Stellaforce off, Naehas on" unexpressable — so that
 * pair, in both directions, is the first thing asserted here.
 */

let failures = 0
function check(ok: boolean, label: string, detail = "") {
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`)
  if (!ok) failures++
}

const STELLAFORCE = "c1e0f4a2-6d3b-4f8e-9a17-2b5c8d0e7f31"
const NAEHAS = "bd5771e3-9208-4382-9c02-eec6b6dd31d7"
const FLOW = "22222222-2222-2222-2222-222222222222"
const JOB = "33333333-3333-3333-3333-333333333333"

const NOW = new Date("2026-09-12T12:00:00.000Z")

// ── Fixtures ─────────────────────────────────────────────────────────────────

const definition = {
  id: "def-1",
  key: "send_booking_link",
  name: "Send the booking link",
  trigger_event_type: "candidate_added_to_stage",
  category: "scheduling",
  system_managed: false,
  has_executor: true,
  client_id: null,
  archived_at: null,
  created_by: null,
  created_at: "",
  updated_at: "",
} as unknown as AutomationDefinitionRow

/** A different category, so category-scoped rows can be told apart. */
const evaluationDefinition = {
  ...definition,
  id: "def-2",
  key: "evaluation_overdue",
  name: "Evaluation overdue",
  category: "evaluation",
} as unknown as AutomationDefinitionRow

const version = {
  id: "ver-1",
  definition_id: "def-1",
  status: "published",
  condition_text: "A candidate reaches a self-scheduling agent stage.",
  actions: [],
  tasks_and_reminders: [],
  exceptions: [],
  sla_type: null,
  default_mode: "auto",
  created_at: "",
  updated_at: "",
} as unknown as AutomationDefinitionVersionRow

const evaluationVersion = {
  ...version,
  id: "ver-2",
  definition_id: "def-2",
} as unknown as AutomationDefinitionVersionRow

const GLOBAL_ACTIVE = {
  id: "b-global",
  automation_definition_id: "def-1",
  state: "active",
  scope: "global",
  tenant_client_id: null,
  company_scope_client_id: null,
  workflow_template_id: null,
  job_id: null,
  set_by: null,
  note: null,
  created_at: "",
  updated_at: "",
} as AutomationBindingRow

const GLOBAL_ACTIVE_EVAL = { ...GLOBAL_ACTIVE, id: "b-global-2", automation_definition_id: "def-2" }

function sw(
  over: Partial<ScopeSwitchRow> & Pick<ScopeSwitchRow, "id" | "state" | "scope">
): ScopeSwitchRow {
  return {
    category: null,
    resume_at: null,
    company_scope_client_id: null,
    workflow_template_id: null,
    job_id: null,
    ...over,
  } as ScopeSwitchRow
}

/** An account-wide `off` for one client. */
const offFor = (clientId: string, id = `sw-${clientId}`) =>
  sw({ id, state: "off", scope: "client", company_scope_client_id: clientId })

const activeFor = (clientId: string, id = `sw-on-${clientId}`) =>
  sw({ id, state: "active", scope: "client", company_scope_client_id: clientId })

function resolve(
  scopeSwitches: ScopeSwitchRow[],
  ctx: AutomationResolveContext,
  companyName = "Acme"
) {
  return resolveFromRows({
    definitions: [definition, evaluationDefinition],
    versions: [version, evaluationVersion],
    bindings: [GLOBAL_ACTIVE, GLOBAL_ACTIVE_EVAL],
    scopeSwitches,
    ctx,
    labels: { companyName, flowName: "Standard Hiring Workflow" },
    now: NOW,
  })
}

/** The scheduling automation — the one with a real executor. */
const booking = (rs: ReturnType<typeof resolve>) => rs.find((r) => r.key === "send_booking_link")!
const evaluation = (rs: ReturnType<typeof resolve>) => rs.find((r) => r.key === "evaluation_overdue")!

// ── 1. Independent accounts — the case this design exists for ────────────────

console.log("\nIndependent accounts")

{
  const switches = [offFor(STELLAFORCE), activeFor(NAEHAS)]

  const onStellaforce = booking(resolve(switches, { companyId: STELLAFORCE }, "Stellaforce"))
  const onNaehas = booking(resolve(switches, { companyId: NAEHAS }, "Naehas"))

  check(
    onStellaforce.effectiveState === "off" && onStellaforce.stateSource.label === "Stellaforce",
    "Stellaforce off",
    `${onStellaforce.effectiveState} · ${onStellaforce.stateSource.label}`
  )
  check(
    onNaehas.effectiveState === "active",
    "…while Naehas keeps running",
    `${onNaehas.effectiveState} · ${onNaehas.stateSource.label}`
  )
}

{
  // The same pair inverted. A union would have failed this one in both runs.
  const switches = [activeFor(STELLAFORCE), offFor(NAEHAS)]

  const onStellaforce = booking(resolve(switches, { companyId: STELLAFORCE }, "Stellaforce"))
  const onNaehas = booking(resolve(switches, { companyId: NAEHAS }, "Naehas"))

  check(onStellaforce.effectiveState === "active", "inverted: Stellaforce runs")
  check(
    onNaehas.effectiveState === "off" && onNaehas.stateSource.label === "Naehas",
    "inverted: Naehas off",
    `${onNaehas.effectiveState} · ${onNaehas.stateSource.label}`
  )
}

{
  // Global is a DEFAULT, not a ceiling: an account may opt back in under it.
  const switches = [sw({ id: "sw-g", state: "off", scope: "global" }), activeFor(NAEHAS)]

  const inheriting = booking(resolve(switches, { companyId: STELLAFORCE }, "Stellaforce"))
  const optedIn = booking(resolve(switches, { companyId: NAEHAS }, "Naehas"))

  check(
    inheriting.effectiveState === "off" && inheriting.stateSource.scope === "global",
    "an account with no row inherits the global default",
    `${inheriting.effectiveState} · ${inheriting.stateSource.label}`
  )
  check(
    optedIn.effectiveState === "active",
    "…and an explicit account `active` beats a global `off`",
    `${optedIn.effectiveState} · ${optedIn.stateSource.label}`
  )
}

{
  const leak = booking(resolve([offFor(NAEHAS)], { companyId: STELLAFORCE }, "Stellaforce"))
  check(
    leak.effectiveState === "active" && leak.scopeSwitch === null,
    "another account's switch never leaks in",
    `${leak.effectiveState} · ${leak.stateSource.label}`
  )
}

check(
  booking(resolve([], { companyId: NAEHAS })).effectiveState === "active",
  "the resolver's own fallback is still `active` — an empty table means running"
)

{
  // What `20260913090100_seed_automations_off_by_default` actually ships: one
  // global `off` row. The fallback above stays `active` on purpose — the
  // default is *data*, so it can be changed by clicking On rather than by
  // shipping a migration, and this asserts the shipped data says what the
  // product claims it says.
  const SEEDED_DEFAULT = sw({ id: "seed", state: "off", scope: "global" })

  const untouched = booking(resolve([SEEDED_DEFAULT], { companyId: NAEHAS }, "Naehas"))
  check(
    untouched.effectiveState === "off" && untouched.isLocked,
    "as seeded, an account that has decided nothing is off",
    `${untouched.effectiveState} · ${untouched.stateSource.label}`
  )
  check(
    booking(resolve([SEEDED_DEFAULT, activeFor(NAEHAS)], { companyId: NAEHAS }, "Naehas"))
      .effectiveState === "active",
    "…and turning one account on is all it takes to opt it back in"
  )
}

// ── 2. The ceiling locks every control ───────────────────────────────────────

console.log("\nThe switch is a ceiling")

{
  const ctx = { companyId: NAEHAS, flowId: FLOW, jobId: JOB }
  const capped = booking(resolve([offFor(NAEHAS)], ctx, "Naehas"))

  check(capped.effectiveState === "off", "an account off forces every automation off")
  check(capped.isLocked, "…and locks it", capped.lockedReason ?? "")
  check(
    !capped.canActivateForJob && !capped.canPauseForJob && !capped.canResetToInherited,
    "…so no job control can undo it"
  )
  check(capped.scopeSwitch?.source.label === "Naehas", "…naming the account that decided")
  check(
    capped.lockedReason === "Automations are off for Naehas.",
    "…in a sentence, not a field name",
    capped.lockedReason ?? ""
  )

  // The whole reason the chain is not overwritten.
  check(
    capped.sourceChain.length === 4 &&
      capped.sourceChain.some((l) => l.wins && l.scope === "global"),
    "the per-definition chain survives, so 'would be Active · Global library' is still answerable",
    capped.sourceChain.map((l) => `${l.scope}${l.wins ? "*" : ""}`).join(" → ")
  )
}

{
  const uncapped = booking(resolve([], { companyId: NAEHAS, flowId: FLOW, jobId: JOB }))
  check(
    !uncapped.isLocked && uncapped.canPauseForJob && uncapped.scopeSwitch === null,
    "with no switch the job controls work exactly as before"
  )
}

// ── 3. Paused, and its expiry ────────────────────────────────────────────────

console.log("\nPause and expiry")

{
  const future = sw({
    id: "sw-p",
    state: "paused",
    scope: "client",
    company_scope_client_id: NAEHAS,
    resume_at: "2026-09-20T00:00:00.000Z",
  })
  const paused = booking(resolve([future], { companyId: NAEHAS }, "Naehas"))
  check(
    paused.effectiveState === "paused" && paused.isLocked,
    "a live pause caps the account",
    paused.lockedReason ?? ""
  )
  check(paused.scopeSwitch?.resumeAt === "2026-09-20T00:00:00.000Z", "…and carries its end date")
}

{
  const expired = sw({
    id: "sw-p",
    state: "paused",
    scope: "client",
    company_scope_client_id: NAEHAS,
    resume_at: "2026-09-01T00:00:00.000Z", // before NOW
  })
  const resumed = booking(resolve([expired], { companyId: NAEHAS }, "Naehas"))
  check(
    resumed.effectiveState === "active" && resumed.scopeSwitch === null,
    "an expired pause stops applying with no sweeper run",
    `${resumed.effectiveState} · ${resumed.stateSource.label}`
  )
}

{
  // An `off` row can carry no resume_at (the DB refuses it), so expiry must
  // never be read as "this off row is stale".
  const indefinite = booking(resolve([offFor(NAEHAS)], { companyId: NAEHAS }, "Naehas"))
  check(
    indefinite.effectiveState === "off" && indefinite.scopeSwitch?.resumeAt === null,
    "an indefinite off never expires"
  )
}

// ── 4. Category precedence ───────────────────────────────────────────────────

console.log("\nCategories")

{
  const switches = [
    activeFor(NAEHAS),
    sw({
      id: "sw-cat",
      state: "paused",
      scope: "client",
      company_scope_client_id: NAEHAS,
      category: "scheduling",
    }),
  ]
  const rs = resolve(switches, { companyId: NAEHAS }, "Naehas")

  check(
    booking(rs).effectiveState === "paused",
    "at equal scope a category row beats the catch-all",
    `${booking(rs).effectiveState}`
  )
  check(
    evaluation(rs).effectiveState === "active",
    "…and leaves the other categories running",
    `${evaluation(rs).effectiveState}`
  )
}

{
  // A narrower scope beats category specificity: the job says everything runs.
  const switches = [
    sw({ id: "sw-cat", state: "off", scope: "client", company_scope_client_id: NAEHAS, category: "scheduling" }),
    sw({ id: "sw-job", state: "active", scope: "job", job_id: JOB }),
  ]
  const rs = resolve(switches, { companyId: NAEHAS, jobId: JOB }, "Naehas")
  check(
    booking(rs).effectiveState === "active",
    "a narrower scope beats a wider category-specific row",
    `${booking(rs).effectiveState} · ${booking(rs).stateSource.label}`
  )
}

// ── 5. resolveScopeSwitch directly, for the shapes the gate asks about ───────

console.log("\nThe gate's question")

{
  const chain = scopeChain({ companyId: NAEHAS }, { companyName: "Naehas" })

  check(
    resolveScopeSwitch([offFor(NAEHAS)], chain, "scheduling", NOW)?.state === "off",
    "an account-wide off answers for any category"
  )
  check(
    resolveScopeSwitch(
      [sw({ id: "s", state: "off", scope: "client", company_scope_client_id: NAEHAS, category: "scheduling" })],
      chain,
      "evaluation",
      NOW
    ) === null,
    "a scheduling-only row does not answer for evaluation"
  )
  check(
    resolveScopeSwitch([activeFor(NAEHAS)], chain, "scheduling", NOW) === null,
    "an explicit active resolves to 'nothing capped', not to a switch"
  )
}

console.log(failures === 0 ? "\nAll checks passed.\n" : `\n${failures} check(s) failed.\n`)
if (failures) process.exit(1)
