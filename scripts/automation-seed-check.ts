import { AUTOMATION_EVENT_GROUPS } from "@/lib/automation-events"
import { AUTOMATION_SECTIONS } from "@/lib/automation-sections"
import { resolveFromRows, type AutomationResolveContext } from "@/lib/automation-resolve"
import type {
  AutomationBindingRow,
  AutomationDefinitionRow,
  AutomationDefinitionVersionRow,
} from "@/lib/supabase/types"

/**
 * Two guards in one run, both headless.
 *
 * **Drift** — the app's `AUTOMATION_EVENT_GROUPS` still owns the display order
 * and the grouping headings, while the rules themselves are rows. Those two
 * lists must stay 1:1 in both directions, or a trigger appears on screen with
 * no rule behind it, or a seeded rule never appears at all.
 *
 * **Inheritance** — `resolveFromRows` is pure, so the cascade can be driven
 * without a database. This is the same function the job dialog renders from,
 * not a re-implementation of it, which is the whole reason it was split out of
 * the server-only loader.
 */

let failures = 0
function check(ok: boolean, label: string, detail = "") {
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`)
  if (!ok) failures++
}

// ── 1. The seeded library, as the migration writes it ────────────────────────

/** Mirrors 20260823200301_seed_automation_library.sql. */
const SEEDED: { key: string; category: string; sla: string | null }[] = [
  { key: "candidate_added_to_stage", category: "lifecycle", sla: "needs_scheduling" },
  { key: "candidate_leaves_stage", category: "lifecycle", sla: "needs_decision" },
  { key: "candidate_withdraws", category: "lifecycle", sla: null },
  { key: "candidate_fast_tracked", category: "lifecycle", sla: null },
  { key: "send_booking_link", category: "scheduling", sla: "needs_scheduling" },
  { key: "interview_scheduled", category: "scheduling", sla: null },
  { key: "interview_rescheduled", category: "scheduling", sla: null },
  { key: "interview_completed", category: "scheduling", sla: "needs_feedback" },
  { key: "interview_canceled", category: "scheduling", sla: null },
  { key: "interview_no_show_candidate", category: "scheduling", sla: null },
  { key: "interview_no_show_interviewer", category: "scheduling", sla: null },
  { key: "all_required_evaluations_completed", category: "evaluation", sla: "needs_decision" },
  { key: "evaluation_overdue", category: "evaluation", sla: "needs_feedback" },
  { key: "decision_made", category: "evaluation", sla: "needs_offer_creation" },
]

/** The seven `sla_policies.sla_type` values seeded by wf_settings.sql. */
const SEEDED_SLA_TYPES = new Set([
  "needs_scheduling",
  "needs_feedback",
  "needs_decision",
  "needs_offer_creation",
  "offer_needs_to_be_sent",
  "offer_sent",
  "needs_attention",
])

const CATEGORY_KEYS: Set<string> = new Set(
  AUTOMATION_SECTIONS.filter((s) => s.eventGroup).map((s) => s.key)
)

console.log("\nSeed ↔ app vocabulary")

const appIds = AUTOMATION_EVENT_GROUPS.flatMap((g) => g.events).map((e) => e.id)
const seededKeys = new Set(SEEDED.map((d) => d.key))

for (const id of appIds) {
  check(seededKeys.has(id), `app event "${id}" has a definition`)
}
for (const { key } of SEEDED) {
  check(appIds.includes(key), `definition "${key}" appears in the UI`)
}
check(
  new Set(appIds).size === appIds.length,
  "no duplicate app event ids",
  `${appIds.length} ids`
)
for (const { key, category, sla } of SEEDED) {
  check(CATEGORY_KEYS.has(category), `"${key}" category "${category}" is a real section`)
  if (sla) check(SEEDED_SLA_TYPES.has(sla), `"${key}" sla_type "${sla}" is a seeded policy`)
}

// ── 2. Inheritance, through the real resolver ────────────────────────────────

const COMPANY = "11111111-1111-1111-1111-111111111111"
const FLOW = "22222222-2222-2222-2222-222222222222"
const JOB = "33333333-3333-3333-3333-333333333333"
const OTHER_JOB = "44444444-4444-4444-4444-444444444444"

const definition = {
  id: "def-1",
  key: "interview_scheduled",
  name: "Interview scheduled",
  trigger_event_type: "interview_scheduled",
  category: "scheduling",
  system_managed: false,
  client_id: null,
  archived_at: null,
  created_by: null,
  created_at: "",
  updated_at: "",
} as unknown as AutomationDefinitionRow

const version = {
  id: "ver-1",
  definition_id: "def-1",
  client_id: null,
  version: 1,
  status: "published",
  condition_text: "The stage is a booked interview.",
  actions: [{ key: "send_confirmation", label: "Send the confirmation" }],
  tasks_and_reminders: [],
  exceptions: [],
  sla_type: null,
  default_mode: "auto",
  notes: null,
  published_at: "",
  created_by: null,
  created_at: "",
  updated_at: "",
} as unknown as AutomationDefinitionVersionRow

function binding(
  over: Partial<AutomationBindingRow> & Pick<AutomationBindingRow, "id" | "state" | "scope">
): AutomationBindingRow {
  return {
    automation_definition_id: "def-1",
    tenant_client_id: null,
    company_scope_client_id: null,
    workflow_template_id: null,
    job_id: null,
    set_by: null,
    note: null,
    created_at: "",
    updated_at: "",
    ...over,
  } as AutomationBindingRow
}

const GLOBAL_ACTIVE = binding({ id: "b-global", state: "active", scope: "global" })
const JOB_CTX: AutomationResolveContext = { companyId: COMPANY, flowId: FLOW, jobId: JOB }

function resolve(bindings: AutomationBindingRow[], ctx: AutomationResolveContext = JOB_CTX) {
  return resolveFromRows({
    definitions: [definition],
    versions: [version],
    bindings,
    ctx,
    labels: { companyName: "Acme Robotics", flowName: "Standard Hiring Workflow" },
  })[0]
}

console.log("\nInheritance")

const inherited = resolve([GLOBAL_ACTIVE])
check(
  inherited.effectiveState === "active" && inherited.stateSource.scope === "global",
  "global active is inherited by a job",
  `${inherited.effectiveState} · ${inherited.stateSource.label}`
)

const flowPaused = resolve([
  GLOBAL_ACTIVE,
  binding({ id: "b-flow", state: "paused", scope: "workflow", workflow_template_id: FLOW }),
])
check(
  flowPaused.effectiveState === "paused" && flowPaused.stateSource.label === "Standard Hiring Workflow",
  "a workflow pause reaches the job, named",
  `${flowPaused.effectiveState} · ${flowPaused.stateSource.label}`
)

const companyOff = resolve([
  GLOBAL_ACTIVE,
  binding({
    id: "b-co",
    state: "off",
    scope: "client",
    tenant_client_id: COMPANY,
    company_scope_client_id: COMPANY,
  }),
])
check(
  companyOff.effectiveState === "off" && companyOff.stateSource.label === "Acme Robotics",
  "a company off reaches the job, named",
  `${companyOff.effectiveState} · ${companyOff.stateSource.label}`
)
check(
  companyOff.canActivateForJob && !companyOff.isLocked,
  "an inherited Off can still be turned on for this job"
)

const jobOverride = resolve([
  GLOBAL_ACTIVE,
  binding({
    id: "b-co",
    state: "off",
    scope: "client",
    tenant_client_id: COMPANY,
    company_scope_client_id: COMPANY,
  }),
  binding({ id: "b-job", state: "active", scope: "job", tenant_client_id: COMPANY, job_id: JOB }),
])
check(
  jobOverride.effectiveState === "active" && jobOverride.stateSource.scope === "job",
  "a job override beats every wider scope",
  `${jobOverride.effectiveState} · ${jobOverride.stateSource.label}`
)
check(jobOverride.canResetToInherited, "an overridden job offers Reset")
check(!inherited.canResetToInherited, "an inheriting job offers no Reset")

const otherJob = resolve([
  GLOBAL_ACTIVE,
  binding({
    id: "b-other",
    state: "paused",
    scope: "job",
    tenant_client_id: COMPANY,
    job_id: OTHER_JOB,
  }),
])
check(
  otherJob.effectiveState === "active" && otherJob.stateSource.scope === "global",
  "another job's pause does not leak into this one",
  `${otherJob.effectiveState} · ${otherJob.stateSource.label}`
)

check(
  jobOverride.sourceChain.length === 4 &&
    jobOverride.sourceChain.filter((l) => l.wins).length === 1 &&
    jobOverride.sourceChain[0].scope === "global",
  "the chain keeps every layer, widest first, one winner",
  jobOverride.sourceChain.map((l) => `${l.scope}${l.wins ? "*" : ""}`).join(" → ")
)

const locked = resolveFromRows({
  definitions: [{ ...definition, system_managed: true }],
  versions: [version],
  bindings: [GLOBAL_ACTIVE],
  ctx: JOB_CTX,
})[0]
check(
  locked.isLocked &&
    !locked.canPauseForJob &&
    !locked.canActivateForJob &&
    !locked.canResetToInherited,
  "a system-managed definition refuses every control",
  locked.lockedReason ?? ""
)
check(!locked.isBlocked, "locked is not blocked — they are separate axes")

const noVersion = resolveFromRows({
  definitions: [definition],
  versions: [],
  bindings: [GLOBAL_ACTIVE],
  ctx: JOB_CTX,
})[0]
check(!noVersion.isApplicable, "a definition with no published version is not applicable")

const globalOnly = resolve([GLOBAL_ACTIVE], {})
check(
  globalOnly.sourceChain.length === 1 && !globalOnly.canPauseForJob,
  "with no context the chain is global only, and offers no job controls"
)

console.log(
  failures === 0
    ? "\nAll checks passed.\n"
    : `\n${failures} check(s) failed.\n`
)
if (failures) process.exit(1)
