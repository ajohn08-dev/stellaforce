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

/** Bookable window, in the chosen timezone's wall clock. */
export const WORKDAY_START_HOUR = 9
export const WORKDAY_END_HOUR = 17
export const DEFAULT_SLOT_MINUTES = 30
/** Mon–Fri, matching Date#getDay numbering. */
export const DEFAULT_PREFERRED_DAYS = [1, 2, 3, 4, 5]
/** How far ahead to look before giving up — bounds the search on sparse weeks. */
const MAX_SEARCH_DAYS = 14

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
}: FindSlotsInput): Slot[] {
  if (preferredDays.length === 0) return []

  const blocks = busy
    .map((b) => ({ start: new Date(b.start).getTime(), end: new Date(b.end).getTime() }))
    .filter((b) => Number.isFinite(b.start) && Number.isFinite(b.end) && b.end > b.start)
    .sort((a, b) => a.start - b.start)

  const slots: Slot[] = []
  const today = zonedDayOf(from, timeZone)

  for (let dayOffset = 0; dayOffset < MAX_SEARCH_DAYS && slots.length < count; dayOffset++) {
    // Walk dates via UTC arithmetic on the zone-local calendar date, so month
    // ends roll over correctly.
    const cursor = new Date(Date.UTC(today.year, today.month - 1, today.day + dayOffset))
    const year = cursor.getUTCFullYear()
    const month = cursor.getUTCMonth() + 1
    const day = cursor.getUTCDate()
    if (!preferredDays.includes(cursor.getUTCDay())) continue

    const windowStart = zonedTimeToUtc(year, month, day, WORKDAY_START_HOUR, 0, timeZone)
    const windowEnd = zonedTimeToUtc(year, month, day, WORKDAY_END_HOUR, 0, timeZone)

    for (
      let slotStart = windowStart;
      slotStart + slotMinutes * MINUTE <= windowEnd && slots.length < count;
      slotStart += slotMinutes * MINUTE
    ) {
      const slotEnd = slotStart + slotMinutes * MINUTE
      if (slotStart < from) continue // already in the past
      const clashes = blocks.some((b) => b.start < slotEnd && b.end > slotStart)
      if (!clashes) slots.push({ start: slotStart, end: slotEnd })
    }
  }

  return slots
}
