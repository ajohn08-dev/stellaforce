import { z } from "zod"

/**
 * Advanced Search — the shared contract between the rail (client) and the query
 * (server). Deliberately free of `server-only` and of any Supabase import so the
 * left rail can validate as you type using the *same* rules the server enforces;
 * two copies of "is this a valid year range" is how the inline message and the
 * actual refusal drift apart.
 *
 * V1 is structured search only. No natural language, no vectors, no full-text.
 */

/** Matches the page size the candidates table already paginates at. */
export const CANDIDATE_SEARCH_PAGE_SIZE = 25

/**
 * Exactly what the results table renders — not a candidate row.
 *
 * `candidates` is selected by an explicit column list built from this type, so
 * phone, resume paths, source metadata, confidence breakdowns and the
 * placeholder embedding vector never leave the server. Widening this type is
 * the only way to widen that select, which is the point.
 */
export type CandidateSearchResult = {
  candidateId: string
  fullName: string
  currentTitle: string | null
  currentCompany: string | null
  linkedinUrl: string | null
  email: string | null
  avatarUrl: string | null
  yearsExperience: number | null
  locationCity: string | null
  locationState: string | null
}

export type CandidateSearchPage = {
  results: CandidateSearchResult[]
  totalCount: number
  page: number
  pageSize: number
  totalPages: number
}

export type CandidateSearchFilters = {
  /** Case-insensitive contains, against the generated `full_name`. */
  name?: string
  /**
   * Case-insensitive contains, against free-text `current_title`.
   * This is a "title contains" search, not a normalized role filter — there is
   * no canonical title column in the schema and pretending otherwise would make
   * the result set look authoritative when it is a substring match.
   */
  title?: string
  /** Case-insensitive contains, against `location_city` only. No metro logic. */
  location?: string
  /** Lower-cased, de-duplicated skill terms. Matched ANY, never ALL. */
  skillTerms: string[]
  minYears?: number
  maxYears?: number
}

/** Inline messages for the rail, keyed by the field that should show them. */
export type CandidateSearchIssues = {
  minYears?: string
  maxYears?: string
}

export type ParsedCandidateSearch = {
  filters: CandidateSearchFilters
  issues: CandidateSearchIssues
  /** True when the input is invalid — the server must not run a search. */
  hasBlockingIssue: boolean
  page: number
  pageSize: number
  /** The raw strings, so the rail can render what was typed. */
  raw: {
    name: string
    title: string
    location: string
    skills: string
    minYears: string
    maxYears: string
  }
}

const textFilter = z
  .preprocess(
    (v) => (typeof v === "string" && v.trim() ? v.trim() : undefined),
    z.string().max(200).optional()
  )

const pageNumber = z.preprocess(
  (v) => {
    const n = typeof v === "string" ? Number(v) : NaN
    return Number.isInteger(n) && n >= 1 ? n : 1
  },
  z.number().int().min(1)
)

/**
 * Split on commas, trim, drop blanks, lower-case and de-duplicate.
 *
 * De-duplication is not cosmetic: each term becomes one `ilike` branch in the
 * skills lookup, so "Salesforce, salesforce" would otherwise build a wider OR
 * for no additional matches.
 */
export function parseSkillTerms(raw: string | undefined): string[] {
  if (!raw) return []
  const terms = raw
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean)
  return [...new Set(terms)]
}

/**
 * Years are validated by hand rather than by a zod coercion, because the three
 * failures the UI has to distinguish — not a whole number, negative, min above
 * max — need three different sentences, and `z.coerce.number().int().min(0)`
 * collapses the first two into one.
 */
function parseYears(raw: string): { value?: number; error?: string } {
  const trimmed = raw.trim()
  if (!trimmed) return {}
  if (/^-\d+$/.test(trimmed)) return { error: "Must be 0 or more" }
  if (!/^\d+$/.test(trimmed)) return { error: "Whole numbers only" }
  const value = Number(trimmed)
  if (!Number.isSafeInteger(value)) return { error: "Whole numbers only" }
  return { value }
}

function str(v: string | string[] | undefined): string {
  return typeof v === "string" ? v : ""
}

/**
 * The single parse used by both the page and the rail. Given raw query params,
 * returns the filters to run, the messages to show, and whether the search may
 * run at all.
 */
export function parseCandidateSearchParams(
  sp: Record<string, string | string[] | undefined>
): ParsedCandidateSearch {
  const raw = {
    name: str(sp.name),
    title: str(sp.title),
    location: str(sp.location),
    skills: str(sp.skills),
    minYears: str(sp.minYears),
    maxYears: str(sp.maxYears),
  }

  const min = parseYears(raw.minYears)
  const max = parseYears(raw.maxYears)

  const issues: CandidateSearchIssues = {}
  if (min.error) issues.minYears = min.error
  if (max.error) issues.maxYears = max.error

  // Only worth checking once both sides parsed; otherwise the range message
  // would pile on top of a message that already explains the problem.
  if (
    !min.error &&
    !max.error &&
    min.value !== undefined &&
    max.value !== undefined &&
    min.value > max.value
  ) {
    issues.maxYears = "Max must be greater than or equal to Min"
  }

  return {
    filters: {
      name: textFilter.parse(raw.name),
      title: textFilter.parse(raw.title),
      location: textFilter.parse(raw.location),
      skillTerms: parseSkillTerms(raw.skills),
      minYears: min.value,
      maxYears: max.value,
    },
    issues,
    hasBlockingIssue: Object.keys(issues).length > 0,
    page: pageNumber.parse(sp.page),
    pageSize: CANDIDATE_SEARCH_PAGE_SIZE,
    raw,
  }
}

/** An empty page, for "not configured", "unauthorized", and "invalid input". */
export function emptyCandidateSearchPage(
  page = 1,
  pageSize = CANDIDATE_SEARCH_PAGE_SIZE
): CandidateSearchPage {
  return { results: [], totalCount: 0, page, pageSize, totalPages: 0 }
}
