/**
 * Minimal IANA-timezone helpers built on `Intl` — no dependency needed.
 *
 * (date-fns v4 is in package.json but unused anywhere in src/, and its timezone
 * companion `@date-fns/tz` isn't installed. `Intl` already knows the IANA
 * database including DST transitions, which is all this needs.)
 *
 * Everything in the scheduling UI stores absolute instants and converts only at
 * the render/compute boundary, so switching timezone never refetches anything.
 */

export type TimezoneOption = { value: string; label: string }

/** Picker options. Pacific is the default — most of the team is there. */
export const TIMEZONES: TimezoneOption[] = [
  { value: "America/Los_Angeles", label: "Pacific — Los Angeles" },
  { value: "America/Denver", label: "Mountain — Denver" },
  { value: "America/Chicago", label: "Central — Chicago" },
  { value: "America/New_York", label: "Eastern — New York" },
  { value: "UTC", label: "UTC" },
  { value: "Europe/London", label: "London" },
  { value: "Asia/Kolkata", label: "India — Kolkata" },
]

export const DEFAULT_TIMEZONE = "America/Los_Angeles"

export type ZonedParts = {
  year: number
  month: number // 1-12
  day: number
  hour: number // 0-23
  minute: number
  /** 0 = Sunday … 6 = Saturday, matching Date#getDay. */
  weekday: number
}

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
}

const partsFormatterCache = new Map<string, Intl.DateTimeFormat>()

function partsFormatter(timeZone: string): Intl.DateTimeFormat {
  const cached = partsFormatterCache.get(timeZone)
  if (cached) return cached
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hour12: false,
  })
  partsFormatterCache.set(timeZone, formatter)
  return formatter
}

/** Wall-clock parts of an absolute instant, as seen in `timeZone`. */
export function zonedParts(instant: Date | number | string, timeZone: string): ZonedParts {
  const date = instant instanceof Date ? instant : new Date(instant)
  const parts = partsFormatter(timeZone).formatToParts(date)
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "0"

  // `hour12: false` yields hour 24 for midnight in some engines; normalize.
  const hour = Number(get("hour")) % 24

  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    hour,
    minute: Number(get("minute")),
    weekday: WEEKDAY_INDEX[get("weekday")] ?? 0,
  }
}

/** The zone's UTC offset (ms) at a given instant. */
function offsetMs(instant: Date, timeZone: string): number {
  const p = zonedParts(instant, timeZone)
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, 0, 0)
  // Second-level precision is enough; zone offsets are whole minutes.
  return asUtc - Math.floor(instant.getTime() / 60_000) * 60_000
}

/**
 * The absolute instant (ms) of a zone-local wall-clock time.
 *
 * Two-pass: the offset depends on the instant we're solving for, so guess with
 * the offset at the naive UTC reading, then re-check at the corrected instant.
 * Without the second pass, times on DST-transition days land an hour off.
 */
export function zonedTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string
): number {
  const naive = Date.UTC(year, month - 1, day, hour, minute, 0, 0)
  const firstOffset = offsetMs(new Date(naive), timeZone)
  const firstGuess = naive - firstOffset
  const secondOffset = offsetMs(new Date(firstGuess), timeZone)
  return secondOffset === firstOffset ? firstGuess : naive - secondOffset
}

/** Midnight (00:00) of a zone-local calendar date, as an absolute instant. */
export function zonedMidnightUtc(
  year: number,
  month: number,
  day: number,
  timeZone: string
): number {
  return zonedTimeToUtc(year, month, day, 0, 0, timeZone)
}

export type ZonedDay = { year: number; month: number; day: number; weekday: number }

/** The calendar date an instant falls on in `timeZone`. */
export function zonedDayOf(instant: Date | number, timeZone: string): ZonedDay {
  const p = zonedParts(instant, timeZone)
  return { year: p.year, month: p.month, day: p.day, weekday: p.weekday }
}

/** `count` consecutive zone-local days starting at `start`'s date. */
export function zonedDaySequence(
  start: Date | number,
  count: number,
  timeZone: string
): ZonedDay[] {
  const first = zonedDayOf(start, timeZone)
  const days: ZonedDay[] = []
  for (let i = 0; i < count; i++) {
    // Step via UTC midday to stay clear of DST edges, then read the zone date.
    const midday = Date.UTC(first.year, first.month - 1, first.day + i, 12)
    const p = zonedParts(new Date(midday), "UTC")
    const weekday = new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay()
    days.push({ year: p.year, month: p.month, day: p.day, weekday })
  }
  return days
}

/** e.g. "9:00 AM" — a wall-clock time in the given zone. */
export function formatZonedTime(instant: Date | number | string, timeZone: string): string {
  const date = instant instanceof Date ? instant : new Date(instant)
  return date.toLocaleTimeString("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
  })
}

/** e.g. "Mon 10" — weekday + day-of-month in the given zone. */
export function formatZonedDayLabel(
  instant: Date | number | string,
  timeZone: string
): string {
  const date = instant instanceof Date ? instant : new Date(instant)
  return date.toLocaleDateString("en-US", {
    timeZone,
    weekday: "short",
    day: "numeric",
  })
}

/** Short zone name for the current moment, e.g. "PDT" — for labelling times. */
export function timezoneAbbreviation(timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "short",
  }).formatToParts(new Date())
  return parts.find((p) => p.type === "timeZoneName")?.value ?? timeZone
}
