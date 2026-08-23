import { zonedDayOf, zonedTimeToUtc } from "@/lib/timezone"

/**
 * Pure slot-finding over a set of busy intervals — no I/O, no React, so it can
 * be reasoned about directly and later reused by the n8n-side scheduler.
 *
 * Everything is absolute instants (ms); `timeZone` decides only what counts as
 * a working day and which wall-clock hours are bookable.
 */

export type Interval = { start: string; end: string }
export type Slot = { start: number; end: number }

/** Default bookable window, in the chosen timezone's wall clock. */
export const WORKDAY_START_HOUR = 9
export const WORKDAY_END_HOUR = 17
export const DEFAULT_SLOT_MINUTES = 30
/** Mon–Fri, matching Date#getDay numbering. */
export const DEFAULT_PREFERRED_DAYS = [1, 2, 3, 4, 5]
/** How far ahead to look before giving up — bounds the search on sparse weeks. */
export const DEFAULT_SEARCH_DAYS = 14

const MINUTE = 60_000

export type FindSlotsInput = {
  busy: Interval[]
  timeZone: string
  /** Day numbers (0=Sun) the interviewer will take interviews on. */
  preferredDays: number[]
  slotMinutes?: number
  count?: number
  /** Defaults to now; injectable so the logic is testable. */
  from?: number

  // ── Everything below is optional and defaults to the behaviour above, so the
  //    existing caller (team-member-calendar-sheet.tsx) is untouched. They exist
  //    for agent-interview booking, where the window, the grid step and the
  //    horizon all come from the stage rather than from a constant.

  /** Bookable window in `timeZone`'s wall clock. Defaults to 9–17. */
  dayStartHour?: number
  dayEndHour?: number
  /**
   * Distance between candidate-visible start times. Defaults to `slotMinutes`,
   * which is exactly today's behaviour — a 30-minute slot every 30 minutes.
   * Setting it lower offers a 30-minute interview at 9:00, 9:15, 9:30…
   */
  stepMinutes?: number
  /** Days to scan before giving up. Defaults to 14. */
  searchDays?: number
  /** Hard end of the horizon (ms). Slots ending after it are not offered. */
  until?: number
}

/**
 * The next `count` open slots that fit `slotMinutes`, scanning forward from
 * `from`, restricted to `preferredDays` and the 09:00–17:00 window in
 * `timeZone`, skipping anything overlapping `busy`.
 *
 * Slots start on a `slotMinutes` grid from 09:00 so suggestions land on tidy
 * times (9:00, 9:30, …) rather than at the ragged end of a preceding meeting.
 */
export function findAvailableSlots({
  busy,
  timeZone,
  preferredDays,
  slotMinutes = DEFAULT_SLOT_MINUTES,
  count = 5,
  from = Date.now(),
  dayStartHour = WORKDAY_START_HOUR,
  dayEndHour = WORKDAY_END_HOUR,
  stepMinutes,
  searchDays = DEFAULT_SEARCH_DAYS,
  until = Number.POSITIVE_INFINITY,
}: FindSlotsInput): Slot[] {
  if (preferredDays.length === 0) return []
  const step = stepMinutes ?? slotMinutes

  const blocks = busy
    .map((b) => ({ start: new Date(b.start).getTime(), end: new Date(b.end).getTime() }))
    .filter((b) => Number.isFinite(b.start) && Number.isFinite(b.end) && b.end > b.start)
    .sort((a, b) => a.start - b.start)

  const slots: Slot[] = []
  const today = zonedDayOf(from, timeZone)

  for (let dayOffset = 0; dayOffset < searchDays && slots.length < count; dayOffset++) {
    // Walk dates via UTC arithmetic on the zone-local calendar date, so month
    // ends roll over correctly.
    const cursor = new Date(Date.UTC(today.year, today.month - 1, today.day + dayOffset))
    const year = cursor.getUTCFullYear()
    const month = cursor.getUTCMonth() + 1
    const day = cursor.getUTCDate()
    if (!preferredDays.includes(cursor.getUTCDay())) continue

    // `dayEndHour` may be 24, which is not a legal hour. Expressed as midnight
    // on the following calendar day so the window closes where it should.
    const windowStart = zonedTimeToUtc(year, month, day, dayStartHour, 0, timeZone)
    const windowEnd =
      dayEndHour >= 24
        ? zonedTimeToUtc(year, month, day + 1, 0, 0, timeZone)
        : zonedTimeToUtc(year, month, day, dayEndHour, 0, timeZone)

    for (
      let slotStart = windowStart;
      slotStart + slotMinutes * MINUTE <= windowEnd && slots.length < count;
      slotStart += step * MINUTE
    ) {
      const slotEnd = slotStart + slotMinutes * MINUTE
      if (slotStart < from) continue // already in the past
      if (slotEnd > until) break // past the booking horizon
      const clashes = blocks.some((b) => b.start < slotEnd && b.end > slotStart)
      if (!clashes) slots.push({ start: slotStart, end: slotEnd })
    }
  }

  return slots
}
