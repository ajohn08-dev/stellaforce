import { companyLogoSrc } from "@/lib/company-logos"

/**
 * Not yet a DB column — candidates don't have structured work history in
 * the schema today. This type + the mock data that uses it are UI-only
 * until we decide to add candidates.work_history.
 */
export type WorkHistoryEntry = {
  company: string
  title: string
  location?: string
  start_date: string // "YYYY-MM"
  end_date?: string | null // null/omitted = current role
  description?: string
}

export type TenureStats = {
  averageMonths: number
  currentMonths: number | null
  totalMonths: number
}

function monthsBetween(start: string, end: string): number {
  const [sy, sm] = start.split("-").map(Number)
  const [ey, em] = end.split("-").map(Number)
  return (ey - sy) * 12 + (em - sm)
}

function todayYearMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
}

export function calculateTenureStats(entries: WorkHistoryEntry[]): TenureStats {
  if (entries.length === 0) {
    return { averageMonths: 0, currentMonths: null, totalMonths: 0 }
  }

  const today = todayYearMonth()
  const durations = entries.map((e) => monthsBetween(e.start_date, e.end_date ?? today))
  const averageMonths = Math.round(
    durations.reduce((sum, d) => sum + d, 0) / durations.length
  )

  const current = entries.find((e) => !e.end_date)
  const currentMonths = current ? monthsBetween(current.start_date, today) : null

  const earliestStart = entries
    .map((e) => e.start_date)
    .sort()[0]
  const latestEnd = entries
    .map((e) => e.end_date ?? today)
    .sort()
    .at(-1)!
  const totalMonths = monthsBetween(earliestStart, latestEnd)

  return { averageMonths, currentMonths, totalMonths }
}

export function formatDuration(months: number): string {
  const years = Math.floor(months / 12)
  const rem = months % 12
  const parts: string[] = []
  if (years > 0) parts.push(`${years} yr${years === 1 ? "" : "s"}`)
  parts.push(`${rem} mo${rem === 1 ? "" : "s"}`)
  return parts.join(" ")
}

export function formatMonth(ym: string): string {
  const [y, m] = ym.split("-").map(Number)
  return new Date(y, m - 1).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  })
}

export function formatDateRange(entry: WorkHistoryEntry): string {
  return `${formatMonth(entry.start_date)} - ${entry.end_date ? formatMonth(entry.end_date) : "Present"}`
}

/** Picks a notable (recognizable-logo) employer from the work history for the highlight callout, if any. */
export function notableEmployer(
  entries: WorkHistoryEntry[]
): WorkHistoryEntry | null {
  return entries.find((e) => companyLogoSrc(e.company) !== null) ?? null
}
