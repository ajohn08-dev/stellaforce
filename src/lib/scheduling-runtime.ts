import {
  schedulingPolicyWithDefaults,
  type StoredSchedulingPolicy,
} from "@/lib/scheduling-policy"

/**
 * Turns a stored scheduling policy into the numbers the booking engine runs on.
 *
 * The policy is authored as English and stored slugified — `"14 days"` becomes
 * `"14_days"` via `slug()` in `src/lib/policy-settings.ts`. That is the right
 * shape for a settings screen and a useless one for arithmetic, so this is the
 * single place the two meet. Pure and DB-free, so `npm run scheduling-check`
 * exercises it directly.
 *
 * An unrecognised slug **throws** rather than falling back to a default. A
 * booking horizon nobody can parse is a misconfiguration, and quietly using 14
 * days instead would produce a wrong grid that looks right — the caller turns
 * this into a `SCHEDULING_CONFIGURATION_INVALID` exception the recruiter can see
 * and fix.
 */

export class SchedulingConfigError extends Error {
  constructor(
    readonly settingKey: string,
    readonly value: string
  ) {
    super(`Scheduling setting "${settingKey}" has an unusable value: "${value}"`)
    this.name = "SchedulingConfigError"
  }
}

function parse<T>(key: string, value: string, table: Record<string, T>): T {
  const hit = table[value]
  if (hit === undefined) throw new SchedulingConfigError(key, value)
  return hit
}

// ── Slug tables ─────────────────────────────────────────────────────────────
// Exhaustive against the option lists in scheduling-policy.ts. "custom" is
// deliberately absent from all of them: it was an option with nowhere to store
// the number, so it has been removed from the five defs the runtime reads.

const DAYS: Record<string, number> = {
  "7_days": 7,
  "10_days": 10,
  "14_days": 14,
  "21_days": 21,
  "30_days": 30,
}

const NOTICE_MINUTES: Record<string, number> = {
  no_minimum: 0,
  "2_hours": 120,
  "4_hours": 240,
  "8_hours": 480,
  "12_hours": 720,
  "24_hours": 1440,
  "48_hours": 2880,
}

const LINK_EXPIRY_HOURS: Record<string, number> = {
  "24_hours": 24,
  "3_days": 72,
  "5_days": 120,
  "7_days": 168,
  "14_days": 336,
  // "Until candidate leaves stage" has no clock. The link is bounded by the
  // stage instead — expressed here as the horizon's worth of hours, since a link
  // that outlives every bookable slot is a link to an empty page.
  until_candidate_leaves_stage: 0,
}

const GRANULARITY_MINUTES: Record<string, number> = {
  "5_minutes": 5,
  "10_minutes": 10,
  "15_minutes": 15,
  "20_minutes": 20,
  "30_minutes": 30,
}

const HOLD_SECONDS: Record<string, number> = {
  // The DB floor is 30s (`hold_seconds between 30 and 3600`). "No hold" means as
  // little as the schema allows, not zero: a confirm still has to survive the
  // round trip that follows the click.
  no_hold: 30,
  "2_minutes": 120,
  "3_minutes": 180,
  "5_minutes": 300,
  "10_minutes": 600,
}

// Keys are `slug()`-ed labels from AGENT_INTERVIEW_SETTINGS, not free text.
const OPERATING_HOURS: Record<string, [number, number]> = {
  "9am_to_5pm": [9, 17],
  "8am_to_6pm": [8, 18],
  "10am_to_4pm": [10, 16],
  // ⚠️ Around-the-clock is the one window that can place a slot on a wall-clock
  // time that doesn't exist — 02:30 on a spring-forward night — which
  // `zonedTimeToUtc` resolves to *something* rather than refusing. Fine for an
  // agent, which dials rather than attends; do not offer it to human
  // interviewers without handling the gap.
  around_the_clock: [0, 24],
}

/**
 * Region labels, not IANA identifiers, because `slug()` would mangle a zone
 * string. This is the only place the real identifier is needed.
 */
const OPERATING_TIMEZONES: Record<string, string> = {
  us_pacific: "America/Los_Angeles",
  us_eastern: "America/New_York",
  uk: "Europe/London",
  central_europe: "Europe/Berlin",
  india: "Asia/Kolkata",
  singapore: "Asia/Singapore",
  sydney: "Australia/Sydney",
}

const OPERATING_DAYS: Record<string, number[]> = {
  // Day numbers match Date#getDay — 0 = Sunday.
  weekdays: [1, 2, 3, 4, 5],
  all_days: [0, 1, 2, 3, 4, 5, 6],
}

const ALLOW_START_NOW: Record<string, boolean> = {
  allowed: true,
  not_allowed: false,
}

/** The numbers a scheduling request is snapshotted with. */
export type SchedulingRuntime = {
  bookingHorizonDays: number
  minimumNoticeMinutes: number
  linkExpiryHours: number
  slotGranularityMinutes: number
  holdSeconds: number
  allowStartNow: boolean
  agentConcurrency: number
  operatingTimezone: string
  operatingStartHour: number
  operatingEndHour: number
  operatingDays: number[]
}

/** Fallback when a stage stores nothing — must exist in every slug table above. */
export const DEFAULT_OPERATING_TIMEZONE = "America/Los_Angeles"

/**
 * @throws {SchedulingConfigError} on any unparseable value.
 */
export function schedulingRuntimeFrom(stored?: StoredSchedulingPolicy): SchedulingRuntime {
  const p = schedulingPolicyWithDefaults(stored)
  const s = p.settings

  const bookingHorizonDays = parse("booking_horizon", s.booking_horizon, DAYS)
  const linkExpiryRaw = parse("link_expiry", s.link_expiry, LINK_EXPIRY_HOURS)

  const agentConcurrencyRaw = s.agent_concurrency ?? "1"
  const agentConcurrency = Number(agentConcurrencyRaw)
  if (!Number.isInteger(agentConcurrency) || agentConcurrency < 1 || agentConcurrency > 50) {
    throw new SchedulingConfigError("agent_concurrency", agentConcurrencyRaw)
  }

  const [operatingStartHour, operatingEndHour] = parse(
    "operating_hours",
    s.operating_hours ?? "9am_to_5pm",
    OPERATING_HOURS
  )

  const timezone = parse(
    "operating_timezone",
    s.operating_timezone ?? "us_pacific",
    OPERATING_TIMEZONES
  )

  return {
    bookingHorizonDays,
    minimumNoticeMinutes: parse("minimum_booking_notice", s.minimum_booking_notice, NOTICE_MINUTES),
    // "Until candidate leaves stage" maps to the horizon: the link should not
    // outlive the last slot it can offer.
    linkExpiryHours: linkExpiryRaw === 0 ? bookingHorizonDays * 24 : linkExpiryRaw,
    slotGranularityMinutes: parse("slot_granularity", s.slot_granularity, GRANULARITY_MINUTES),
    holdSeconds: parse("slot_hold_duration", s.slot_hold_duration ?? "5_minutes", HOLD_SECONDS),
    allowStartNow: parse("allow_start_now", s.allow_start_now ?? "allowed", ALLOW_START_NOW),
    agentConcurrency,
    operatingTimezone: timezone,
    operatingStartHour,
    operatingEndHour,
    operatingDays: parse("operating_days", s.operating_days ?? "weekdays", OPERATING_DAYS),
  }
}
