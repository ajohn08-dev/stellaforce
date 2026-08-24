/**
 * The scheduling policy a workflow template carries — the option lists and the
 * recommended defaults, defined once here rather than inside the tab that
 * renders them.
 *
 * This is the seed for **every new workflow**: a template that has stored
 * nothing yet resolves to `DEFAULT_SCHEDULING_POLICY` in full, so the
 * Scheduling Policy tab opens with every option already set to its
 * recommended value instead of blank. Once these are persisted, the same
 * defaults belong in the `createWorkflowTemplate` insert — nothing here is
 * written to the DB yet (see CLAUDE.md build order).
 *
 * The setting shape, the scope order and the resolution rule are shared with
 * the communication policy — see `src/lib/policy-settings.ts`.
 */

import {
  defaultsOf,
  defineSetting,
  resolveLayered,
  resolveSettingValue,
  subsetOf,
  type PolicyLayers,
  type PolicySettingDef,
  type PolicySettingOption,
  type Resolved,
} from "@/lib/policy-settings"

export type SchedulingMode =
  | "recruiter_led"
  | "candidate_self_scheduling"
  | "system_auto_schedule"

export const SCHEDULING_MODE_OPTIONS: {
  value: SchedulingMode
  label: string
  description: string
}[] = [
  {
    value: "recruiter_led",
    label: "Recruiter-Led",
    description:
      "A recruiter (or coordinator) manually schedules the interview on behalf of everyone involved.",
  },
  {
    value: "candidate_self_scheduling",
    label: "Candidate Self-Scheduling",
    description:
      "System generates slots (or uses interviewer-provided slots). Candidate chooses slot. Most scalable, preferred globally",
  },
  {
    value: "system_auto_schedule",
    label: "System auto schedule",
    description:
      "System asks interviewer to select 2–5 available windows. Then sends those slots to candidate. Good for busy teams or senior/executive interviews",
  },
]

export type SchedulingSettingOption = PolicySettingOption
export type SchedulingSettingDef = PolicySettingDef

const setting = defineSetting

/** Shared by the reschedule and cancellation cutoffs, which offer the same points in time. */
const CUTOFF_OPTIONS = [
  "No cutoff",
  "1 hour",
  "2 hours",
  "4 hours",
  "12 hours",
  "24 hours",
  "48 hours",
  "Custom",
]

/**
 * ⚠️ **No "Custom" option on any setting the booking engine reads.**
 *
 * These five — horizon, notice, link expiry, granularity, hold — used to offer
 * one. It slugged to `"custom"` with nowhere to store the number it stood for,
 * so every stage that chose it would resolve to `SCHEDULING_CONFIGURATION_INVALID`
 * the first time a candidate opened a booking link. A horizon of "17 days" is
 * not a product requirement; a setting that can't be honoured is a bug.
 * `src/lib/scheduling-runtime.ts` is the exhaustive parser for what remains.
 */
export const BOOKING_SETTINGS: SchedulingSettingDef[] = [
  setting(
    "booking_horizon",
    "Candidate booking horizon",
    "How far ahead candidates can book",
    ["7 days", "10 days", "14 days", "21 days", "30 days"],
    "14 days"
  ),
  setting(
    "minimum_booking_notice",
    "Minimum booking notice",
    "How much notice interviewers need before a candidate can book",
    ["No minimum", "2 hours", "4 hours", "8 hours", "12 hours", "24 hours", "48 hours"],
    "24 hours"
  ),
  setting(
    "link_expiry",
    "Candidate link expiry",
    "How long a self-scheduling link remains active",
    ["24 hours", "3 days", "5 days", "7 days", "14 days", "Until candidate leaves stage"],
    "7 days"
  ),
  setting(
    "slot_granularity",
    "Booking slot granularity",
    "Increment between candidate-visible start times",
    ["5 minutes", "10 minutes", "15 minutes", "20 minutes", "30 minutes"],
    "15 minutes"
  ),
  setting(
    "slot_hold_duration",
    "Slot hold duration",
    "How long a selected slot is temporarily held during confirmation",
    ["No hold", "2 minutes", "3 minutes", "5 minutes", "10 minutes"],
    "5 minutes"
  ),
  setting(
    "timezone_display",
    "Candidate timezone display",
    "Which timezone candidates see while booking",
    [
      "Candidate browser timezone",
      "Candidate-selected timezone",
      "Job timezone",
      "Interviewer timezone",
    ],
    "Candidate browser timezone"
  ),
]

/**
 * What an **agent** interview needs that a human one doesn't.
 *
 * A human interviewer brings their own calendar, working hours and timezone; an
 * agent has none of those, so the stage has to say when it may call, how many
 * calls it can hold at once, and whether a candidate may start immediately.
 *
 * Kept as a separate group rather than folded into BOOKING_SETTINGS so the
 * Scheduling Policy tab can show them only where they apply.
 */
export const AGENT_INTERVIEW_SETTINGS: SchedulingSettingDef[] = [
  setting(
    "allow_start_now",
    "Allow “Start now”",
    "Whether a candidate can begin the agent interview immediately instead of booking a time",
    ["Allowed", "Not allowed"],
    "Allowed"
  ),
  setting(
    "agent_concurrency",
    "Concurrent agent interviews",
    "How many candidates this stage may have on the agent at the same time. Capped by the agent's own limit.",
    ["1", "2", "3", "5", "10"],
    "1"
  ),
  setting(
    "operating_hours",
    "Agent operating hours",
    "The wall-clock window the agent will call inside",
    ["9am to 5pm", "8am to 6pm", "10am to 4pm", "Around the clock"],
    "9am to 5pm"
  ),
  setting(
    "operating_days",
    "Agent operating days",
    "Which days the agent will call on",
    ["Weekdays", "All days"],
    "Weekdays"
  ),
  // Labels, not IANA strings: `slug()` lowercases and strips punctuation, so
  // "America/Los_Angeles" would be stored as "america_los_angeles" anyway. The
  // slug -> zone mapping lives in scheduling-runtime.ts, which is the only place
  // that needs the real identifier.
  setting(
    "operating_timezone",
    "Agent operating timezone",
    "The timezone the operating hours are expressed in. Candidates always see their own.",
    [
      "US Pacific",
      "US Eastern",
      "UK",
      "Central Europe",
      "India",
      "Singapore",
      "Sydney",
    ],
    "US Pacific"
  ),
]

export const RESCHEDULE_SETTINGS: SchedulingSettingDef[] = [
  setting(
    "self_reschedule",
    "Candidate can self-reschedule",
    "Whether candidates may move their own confirmed interview",
    [
      "Not allowed",
      "Allowed once",
      "Allowed twice",
      "Allowed unlimited times",
      "Recruiter approval required",
    ],
    "Allowed once"
  ),
  setting(
    "self_reschedule_cutoff",
    "Self-reschedule cutoff",
    "Latest point before interview when candidate can self-reschedule",
    CUTOFF_OPTIONS,
    "24 hours"
  ),
  setting(
    "self_cancel",
    "Candidate can self-cancel",
    "Whether candidates can cancel through their booking link",
    ["Not allowed", "Allowed", "Allowed with reason required", "Request recruiter assistance"],
    "Allowed with reason required"
  ),
  setting(
    "cancellation_cutoff",
    "Candidate cancellation cutoff",
    "Latest point before interview when candidate can cancel online",
    CUTOFF_OPTIONS,
    "24 hours"
  ),
]

export const AVAILABILITY_SETTINGS: SchedulingSettingDef[] = [
  setting(
    "no_slot_fallback",
    "No-slot fallback",
    "What happens when Stellaforce finds no valid availability",
    [
      "Create recruiter task",
      "Extend search window automatically",
      "Try approved backup interviewer",
      "Offer candidate alternative-time request",
      "Combine rules",
    ],
    "Combine rules"
  ),
  setting(
    "conflict_detection",
    "Conflict detection",
    "Which calendars and events can prevent a booking",
    [
      "Primary work calendar only",
      "All selected connected calendars",
      "All calendars except ignored calendars",
    ],
    "All selected connected calendars"
  ),
  setting(
    "conflict_status_behavior",
    "Conflict status behavior",
    "How calendar event statuses affect availability",
    ["Busy only", "Busy + tentative", "Busy + tentative + out of office", "All non-free statuses"],
    "Busy + tentative + out of office"
  ),
]

export const CALENDAR_SETTINGS: SchedulingSettingDef[] = [
  setting(
    "calendar_event_creation",
    "Calendar-event creation",
    "Whether Stellaforce creates the event after confirmation",
    ["Create automatically", "Create after recruiter approval", "Do not create calendar event"],
    "Create automatically"
  ),
  setting(
    "calendar_write_failure",
    "Calendar write failure policy",
    "What happens if the interview is booked but event creation fails",
    [
      "Retry automatically",
      "Retry then alert recruiter",
      "Cancel booking automatically",
      "Require recruiter confirmation",
    ],
    "Retry then alert recruiter"
  ),
]

export const ALL_SCHEDULING_SETTINGS: SchedulingSettingDef[] = [
  ...BOOKING_SETTINGS,
  ...AGENT_INTERVIEW_SETTINGS,
  ...RESCHEDULE_SETTINGS,
  ...AVAILABILITY_SETTINGS,
  ...CALENDAR_SETTINGS,
]

export type SchedulingPolicy = {
  enabled: boolean
  mode: SchedulingMode
  /** Keyed by `SchedulingSettingDef.key`. */
  settings: Record<string, string>
}

/** What a workflow that has never been edited starts with — every option at its recommended value. */
export const DEFAULT_SCHEDULING_POLICY: SchedulingPolicy = {
  enabled: true,
  mode: "candidate_self_scheduling",
  settings: defaultsOf(ALL_SCHEDULING_SETTINGS),
}

/** A partially-stored policy — anything absent falls back to the default. */
export type StoredSchedulingPolicy = {
  enabled?: boolean
  mode?: SchedulingMode
  settings?: Record<string, string>
}

/** Layers of the shared cascade (`POLICY_SCOPES`), carrying scheduling policies. */
export type SchedulingLayers = PolicyLayers<StoredSchedulingPolicy>

export function resolveSchedulingEnabled(layers: SchedulingLayers): Resolved<boolean> {
  return resolveLayered(layers, (p) => p.enabled, DEFAULT_SCHEDULING_POLICY.enabled)
}

export function resolveSchedulingMode(layers: SchedulingLayers): Resolved<SchedulingMode> {
  return resolveLayered(layers, (p) => p.mode, DEFAULT_SCHEDULING_POLICY.mode)
}

export function resolveSchedulingSetting(
  key: string,
  layers: SchedulingLayers
): Resolved<string> {
  return resolveSettingValue(key, layers, DEFAULT_SCHEDULING_POLICY.settings)
}

/**
 * The settings a single sub-stage may override. Deliberately a subset: the
 * rest describe how the *account* books (timezone display, slot hold, which
 * calendars count as busy, what happens when a calendar write fails) and are
 * the same whoever is being interviewed — letting two stages of one pipeline
 * disagree about them would only produce inconsistency, never a better
 * outcome. What is here varies genuinely by stage: a 30-minute recruiter
 * screen and a four-person onsite panel want different notice, different
 * horizons, and different rules about a candidate moving the slot themselves.
 */
export const SUB_STAGE_SCHEDULING_KEYS = [
  "booking_horizon",
  "minimum_booking_notice",
  "link_expiry",
  "slot_granularity",
  // The booking engine reads this per stage, and a 5-minute hold on a stage
  // whose slots are 15 minutes apart behaves differently from one on a stage
  // where they're 5 — so it belongs to the stage after all.
  "slot_hold_duration",
  // Agent-interview settings are inherently per stage: only some stages are run
  // by an agent, and two that are may want different hours and concurrency.
  "allow_start_now",
  "agent_concurrency",
  "operating_hours",
  "operating_days",
  "operating_timezone",
  "self_reschedule",
  "self_reschedule_cutoff",
  "self_cancel",
  "cancellation_cutoff",
  "no_slot_fallback",
] as const

/** The same defs the workflow tab renders, narrowed and ordered for a sub-stage. */
export const SUB_STAGE_SCHEDULING_SETTINGS: SchedulingSettingDef[] = subsetOf(
  ALL_SCHEDULING_SETTINGS,
  SUB_STAGE_SCHEDULING_KEYS
)

/**
 * Fills a stored policy out to a complete one. A new workflow stores nothing and
 * therefore gets `DEFAULT_SCHEDULING_POLICY` whole; a workflow that has only
 * ever had one option changed keeps the defaults for the rest, so adding a new
 * setting later doesn't leave existing workflows with a blank field.
 */
export function schedulingPolicyWithDefaults(
  stored?: StoredSchedulingPolicy
): SchedulingPolicy {
  return {
    enabled: stored?.enabled ?? DEFAULT_SCHEDULING_POLICY.enabled,
    mode: stored?.mode ?? DEFAULT_SCHEDULING_POLICY.mode,
    settings: { ...DEFAULT_SCHEDULING_POLICY.settings, ...stored?.settings },
  }
}
