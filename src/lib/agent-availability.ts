import {
  findAvailableSlots,
  type Slot,
} from "@/lib/availability"

/**
 * Which of an agent's slots a candidate may actually book.
 *
 * `findAvailableSlots` takes occupancy as **intervals** — right for a human
 * interviewer, who is either in a meeting or not. An agent with a concurrency
 * limit of N is different: a slot with 2 of 3 lines busy is still bookable, but
 * a union of intervals says it's blocked. So the grid is generated with no busy
 * time at all and filtered here by a **count**.
 *
 * At N = 1 the two are identical, so nothing is lost by splitting them.
 *
 * Pure and I/O-free, deliberately — this is the part worth testing directly, and
 * `npm run scheduling-check` does.
 */

/** One booked interview or one live hold. Only the instants; never who. */
export type Occupancy = { start: number; end: number }

export type AgentGridInput = {
  /** Wall-clock window and days the agent will call inside. */
  operatingTimezone: string
  operatingStartHour: number
  operatingEndHour: number
  operatingDays: number[]
  /** Length of the interview itself. */
  slotMinutes: number
  /** Distance between offered start times — 30-minute slots every 15 minutes. */
  slotGranularityMinutes: number
  minimumNoticeMinutes: number
  bookingHorizonDays: number
  /** Injectable so the logic is testable. */
  now?: number
  /** Cap on how many to return. The page shows a horizon, not a list. */
  limit?: number
}

/**
 * The candidate-visible grid, before capacity is considered.
 *
 * **Generated in the agent's operating timezone, never the candidate's.** If two
 * candidates in different zones each generated their own grid, their slots would
 * land on non-shared boundaries — one holding 09:07 and another 09:15 — and the
 * agent's capacity would fragment into unbookable slivers. The grid is a
 * property of the stage; which wall clock it's *displayed* in is a property of
 * the viewer, and that happens at render.
 */
export function agentSlotGrid(input: AgentGridInput): Slot[] {
  const now = input.now ?? Date.now()
  const notBefore = now + input.minimumNoticeMinutes * 60_000
  const horizonEnd = now + input.bookingHorizonDays * 86_400_000

  return findAvailableSlots({
    busy: [],
    timeZone: input.operatingTimezone,
    preferredDays: input.operatingDays,
    slotMinutes: input.slotMinutes,
    stepMinutes: input.slotGranularityMinutes,
    dayStartHour: input.operatingStartHour,
    dayEndHour: input.operatingEndHour,
    from: notBefore,
    until: horizonEnd,
    // +1 so a horizon that ends mid-day still offers that day's morning.
    searchDays: input.bookingHorizonDays + 1,
    count: input.limit ?? 500,
  })
}

/**
 * Drops slots where every one of the agent's lanes is already spoken for.
 *
 * `occupancy` is interviews ∪ live holds for this agent over the same horizon.
 * Overlap is half-open on both sides, matching the `tstzrange(..., '[)')` the
 * database uses — so a 10:00–10:30 booking does not block a 10:30–11:00 slot.
 */
export function filterByCapacity(
  grid: Slot[],
  occupancy: Occupancy[],
  capacity: number
): Slot[] {
  if (capacity < 1) return []
  if (occupancy.length === 0) return grid

  return grid.filter((slot) => {
    let taken = 0
    for (const o of occupancy) {
      if (o.start < slot.end && o.end > slot.start) {
        taken++
        // Early exit: nothing past the ceiling changes the answer.
        if (taken >= capacity) return false
      }
    }
    return true
  })
}

/**
 * Can a call start this second?
 *
 * "Start now" is a first-class action rather than a slot, so it is checked
 * against the same occupancy the grid uses but at `now` — the operating window
 * still applies (an agent set to office hours should not answer at 3am), which
 * is why this asks whether `now` falls inside any generated slot's day rather
 * than just counting lanes.
 */
export function canStartNow(input: {
  occupancy: Occupancy[]
  capacity: number
  slotMinutes: number
  operatingTimezone: string
  operatingStartHour: number
  operatingEndHour: number
  operatingDays: number[]
  now?: number
}): boolean {
  const now = input.now ?? Date.now()
  const end = now + input.slotMinutes * 60_000

  // Inside the operating window? Reuse the grid generator with zero notice and a
  // one-day horizon: if it offers anything starting within this slot's span,
  // now is a callable moment.
  const windowProbe = findAvailableSlots({
    busy: [],
    timeZone: input.operatingTimezone,
    preferredDays: input.operatingDays,
    slotMinutes: input.slotMinutes,
    stepMinutes: input.slotMinutes,
    dayStartHour: input.operatingStartHour,
    dayEndHour: input.operatingEndHour,
    from: now - input.slotMinutes * 60_000,
    until: end,
    searchDays: 2,
    count: 1,
  })
  if (windowProbe.length === 0) return false

  let taken = 0
  for (const o of input.occupancy) {
    if (o.start < end && o.end > now) taken++
  }
  return taken < input.capacity
}
