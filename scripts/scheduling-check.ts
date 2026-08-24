import { agentSlotGrid, canStartNow, filterByCapacity } from "@/lib/agent-availability"
import { findAvailableSlots } from "@/lib/availability"
import {
  SchedulingConfigError,
  schedulingRuntimeFrom,
} from "@/lib/scheduling-runtime"
import {
  SCHEDULING_REASON_CODES,
  SCHEDULING_REASONS,
  candidateMessageFor,
  isBenign,
  isPolicySkip,
} from "@/lib/scheduling-reason-codes"
import { DEFAULT_SCHEDULING_POLICY, SUB_STAGE_SCHEDULING_SETTINGS } from "@/lib/scheduling-policy"

/**
 * The booking engine's arithmetic, driven headless.
 *
 * Everything here is pure — the slug parser, the slot grid, the capacity filter
 * — which is exactly why they were split out of the server modules. This runs
 * the same functions the public booking page renders from, not a
 * re-implementation of them.
 */

let failures = 0
function check(ok: boolean, label: string, detail = "") {
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`)
  if (!ok) failures++
}

const TZ = "America/Los_Angeles"
/** A fixed Monday 08:00 Pacific, so nothing here depends on when it runs. */
const MONDAY_8AM = Date.UTC(2026, 8, 7, 15, 0)

// ── 1. The slug parser ──────────────────────────────────────────────────────
console.log("\nScheduling config (slug → number)")

const dflt = schedulingRuntimeFrom(undefined)
check(dflt.bookingHorizonDays === 14, "default horizon is 14 days", String(dflt.bookingHorizonDays))
check(dflt.minimumNoticeMinutes === 1440, "default notice is 24h", `${dflt.minimumNoticeMinutes}m`)
check(dflt.slotGranularityMinutes === 15, "default granularity is 15m")
check(dflt.holdSeconds === 300, "default hold is 5m", `${dflt.holdSeconds}s`)
check(dflt.linkExpiryHours === 168, "default link expiry is 7 days", `${dflt.linkExpiryHours}h`)
check(dflt.allowStartNow, "Start now allowed by default")
check(dflt.agentConcurrency === 1, "default concurrency is 1")
check(dflt.operatingTimezone === TZ, "default zone is US Pacific", dflt.operatingTimezone)
check(
  dflt.operatingStartHour === 9 && dflt.operatingEndHour === 17,
  "default window is 9–17",
  `${dflt.operatingStartHour}–${dflt.operatingEndHour}`
)
check(dflt.operatingDays.join() === "1,2,3,4,5", "default days are Mon–Fri")

// Every option of every runtime-read setting must parse. This is the check that
// catches a new option being added to the policy without a slug-table entry.
const RUNTIME_KEYS = [
  "booking_horizon",
  "minimum_booking_notice",
  "link_expiry",
  "slot_granularity",
  "slot_hold_duration",
  "allow_start_now",
  "agent_concurrency",
  "operating_hours",
  "operating_days",
  "operating_timezone",
]
let unparsed = 0
for (const def of SUB_STAGE_SCHEDULING_SETTINGS) {
  if (!RUNTIME_KEYS.includes(def.key)) continue
  for (const opt of def.options) {
    try {
      schedulingRuntimeFrom({ settings: { [def.key]: opt.value } })
    } catch {
      console.log(`    ✗ ${def.key} = "${opt.value}" (${opt.label}) does not parse`)
      unparsed++
    }
  }
}
check(unparsed === 0, "every option of every runtime-read setting parses", `${unparsed} bad`)

check(
  !Object.values(DEFAULT_SCHEDULING_POLICY.settings).includes("custom"),
  "no setting defaults to the unparseable 'custom'"
)

let threw = false
try {
  schedulingRuntimeFrom({ settings: { booking_horizon: "custom" } })
} catch (e) {
  threw = e instanceof SchedulingConfigError
}
check(threw, "an unparseable slug throws SchedulingConfigError rather than defaulting")

check(
  schedulingRuntimeFrom({ settings: { link_expiry: "until_candidate_leaves_stage" } })
    .linkExpiryHours === 14 * 24,
  "'until candidate leaves stage' expiry tracks the horizon, not forever"
)

// ── 2. The slot grid ────────────────────────────────────────────────────────
console.log("\nSlot grid")

const base = {
  operatingTimezone: TZ,
  operatingStartHour: 9,
  operatingEndHour: 17,
  operatingDays: [1, 2, 3, 4, 5],
  slotMinutes: 30,
  slotGranularityMinutes: 15,
  minimumNoticeMinutes: 0,
  bookingHorizonDays: 14,
  now: MONDAY_8AM,
}

const grid = agentSlotGrid(base)
check(grid.length > 0, "a grid is produced", `${grid.length} slots`)
check(
  grid.every((s) => s.end - s.start === 30 * 60_000),
  "every slot is the interview length (30m), not the grid step"
)
check(
  grid[1].start - grid[0].start === 15 * 60_000,
  "starts are one granularity apart (15m)",
  `${(grid[1].start - grid[0].start) / 60_000}m`
)
check(
  grid.every((s) => s.start >= MONDAY_8AM),
  "nothing is offered in the past"
)
const horizonEnd = MONDAY_8AM + 14 * 86_400_000
check(grid.every((s) => s.end <= horizonEnd), "nothing is offered past the booking horizon")
check(
  grid.every((s) => {
    const d = new Date(s.start).toLocaleDateString("en-US", { timeZone: TZ, weekday: "short" })
    return !["Sat", "Sun"].includes(d)
  }),
  "no weekend slots when operating days are Mon–Fri"
)
check(
  grid.every((s) => {
    const h = Number(
      new Date(s.start).toLocaleString("en-US", { timeZone: TZ, hour: "2-digit", hour12: false })
    )
    return h >= 9 && h < 17
  }),
  "every slot starts inside the 9–17 operating window"
)

const withNotice = agentSlotGrid({ ...base, minimumNoticeMinutes: 24 * 60 })
check(
  withNotice[0].start >= MONDAY_8AM + 24 * 60 * 60_000,
  "24h minimum notice pushes the first slot out a day"
)

const weekendsToo = agentSlotGrid({ ...base, operatingDays: [0, 1, 2, 3, 4, 5, 6] })
check(weekendsToo.length > grid.length, "all-days offers more than weekdays-only")

const roundClock = agentSlotGrid({ ...base, operatingStartHour: 0, operatingEndHour: 24 })
check(roundClock.length > grid.length, "around-the-clock offers more than 9–17")

// ── 3. Capacity ─────────────────────────────────────────────────────────────
console.log("\nCapacity")

const first = grid[0]
const busyAll = [{ start: first.start, end: first.end }]
check(
  filterByCapacity(grid, busyAll, 1).every((s) => s.start !== first.start),
  "at capacity 1, one booking removes its slot"
)
check(
  filterByCapacity(grid, busyAll, 3).some((s) => s.start === first.start),
  "at capacity 3, one booking leaves the slot bookable"
)
check(
  filterByCapacity(
    grid,
    [busyAll[0], busyAll[0], busyAll[0]],
    3
  ).every((s) => s.start !== first.start),
  "at capacity 3, three bookings remove the slot"
)
check(filterByCapacity(grid, [], 5).length === grid.length, "no occupancy removes nothing")
check(filterByCapacity(grid, [], 0).length === 0, "capacity 0 offers nothing")

// Half-open, matching tstzrange(..., '[)') in the database.
const abutting = [{ start: first.end, end: first.end + 30 * 60_000 }]
check(
  filterByCapacity([first], abutting, 1).length === 1,
  "an abutting booking does not block the slot before it (half-open, as in SQL)"
)

// ── 4. Start now ────────────────────────────────────────────────────────────
console.log("\nStart now")

const startNowArgs = {
  occupancy: [],
  capacity: 1,
  slotMinutes: 30,
  operatingTimezone: TZ,
  operatingStartHour: 9,
  operatingEndHour: 17,
  operatingDays: [1, 2, 3, 4, 5],
}
// Monday 08:00 Pacific is before the window opens.
check(!canStartNow({ ...startNowArgs, now: MONDAY_8AM }), "refused outside operating hours")
const mondayNoon = Date.UTC(2026, 8, 7, 19, 0)
check(canStartNow({ ...startNowArgs, now: mondayNoon }), "allowed inside operating hours")
check(
  !canStartNow({
    ...startNowArgs,
    now: mondayNoon,
    occupancy: [{ start: mondayNoon, end: mondayNoon + 30 * 60_000 }],
  }),
  "refused when the agent's only lane is busy right now"
)
check(
  canStartNow({
    ...startNowArgs,
    now: mondayNoon,
    capacity: 2,
    occupancy: [{ start: mondayNoon, end: mondayNoon + 30 * 60_000 }],
  }),
  "allowed at capacity 2 with one lane busy"
)

// ── 5. DST ──────────────────────────────────────────────────────────────────
console.log("\nDST")

// US spring-forward 2027: Sunday 14 March. Generate across it and assert the
// wall-clock hour is stable even though the UTC offset changes underneath.
const beforeDst = Date.UTC(2027, 2, 11, 17, 0) // Thu 11 Mar, 09:00 PST
const across = agentSlotGrid({
  ...base,
  now: beforeDst,
  bookingHorizonDays: 10,
  slotGranularityMinutes: 30,
})
const hours = new Set(
  across.map((s) =>
    new Date(s.start).toLocaleString("en-US", { timeZone: TZ, hour: "2-digit", hour12: false })
  )
)
check(
  [...hours].every((h) => Number(h) >= 9 && Number(h) < 17),
  "every slot across a DST boundary stays inside 9–17 wall clock",
  `hours seen: ${[...hours].sort().join(",")}`
)
const offsets = new Set(
  across.map((s) =>
    new Date(s.start)
      .toLocaleString("en-US", { timeZone: TZ, timeZoneName: "short" })
      .split(" ")
      .pop()
  )
)
check(offsets.size === 2, "the window really did span the transition", [...offsets].join(" → "))

// ── 6. Backwards compatibility ──────────────────────────────────────────────
console.log("\nBackwards compatibility")

// The existing caller (team-member-calendar-sheet.tsx) passes none of the new
// params. Its behaviour must be byte-identical to before they existed.
const legacy = findAvailableSlots({
  busy: [],
  timeZone: TZ,
  preferredDays: [1, 2, 3, 4, 5],
  slotMinutes: 30,
  count: 5,
  from: MONDAY_8AM,
})
check(legacy.length === 5, "legacy call still returns `count` slots")
check(
  legacy.every((s) => s.end - s.start === 30 * 60_000),
  "legacy slots are still slotMinutes long"
)
check(
  legacy[1].start - legacy[0].start === 30 * 60_000,
  "legacy grid step still defaults to slotMinutes, not a finer grid"
)

// ── 7. Reason codes ─────────────────────────────────────────────────────────
console.log("\nReason codes")

check(
  SCHEDULING_REASON_CODES.every((c) => SCHEDULING_REASONS[c]?.message),
  "every code has a recruiter-facing message"
)
check(
  SCHEDULING_REASON_CODES.filter(isPolicySkip).length === 3,
  "three codes are policy skips, not failures"
)
check(
  ["CANDIDATE_BOOKING_TOKEN_INVALID", "CANDIDATE_BOOKING_TOKEN_EXPIRED", "CANDIDATE_ALREADY_BOOKED"]
    .map((c) => candidateMessageFor(c as never))
    .every((m, _, all) => m === all[0]),
  "the three token outcomes are indistinguishable to the candidate"
)
check(
  candidateMessageFor("SCHEDULING_CONFIGURATION_INVALID") ===
    candidateMessageFor("CANDIDATE_BOOKING_TOKEN_INVALID"),
  "an internal misconfiguration leaks nothing to the candidate"
)
check(isBenign("CANDIDATE_ALREADY_BOOKED"), "a refresh of the confirmation page is benign")

console.log(failures === 0 ? "\nAll checks passed.\n" : `\n${failures} check(s) failed.\n`)
if (failures) process.exit(1)
