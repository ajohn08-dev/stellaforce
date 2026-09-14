import { z } from "zod"

import { COUNTRY_NAMES, countryLabel } from "@/lib/country-normalization"
import type { RoleFamily, TitleSeniority } from "@/lib/supabase/types"

/**
 * Advanced Search — the shared contract between the rail (client) and the query
 * (server). Deliberately free of `server-only` and of any Supabase import so the
 * left rail can validate as you type using the *same* rules the server enforces;
 * two copies of "is this a valid year range" is how the inline message and the
 * actual refusal drift apart.
 *
 * Structured search only. No vectors, no full-text. The AI tab does not search
 * either — it parses a sentence into *these* filter values and hands them back,
 * so `sanitizeAiFilters` below lives here too: one module decides what a valid
 * filter value is, whether it came from a URL, a rail control, or a model.
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
   * Case-insensitive contains, against free-text `current_title` — the raw
   * title exactly as written. Deliberately kept alongside the normalized role
   * filters below rather than replaced by them: it is the only filter that
   * reaches an unclassified title or a variant no rule covers, and 10 of 28
   * candidates are unclassified by design.
   */
  title?: string
  /** Case-insensitive contains, against `location_city` only. No metro logic. */
  location?: string
  /** Lower-cased, de-duplicated skill terms. Matched ANY, never ALL. */
  skillTerms: string[]
  minYears?: number
  maxYears?: number
  /**
   * Canonical role **slugs**, not ids. The URL carries `account_executive`
   * rather than a uuid: an id is meaningless in a shared link, breaks across
   * environments that seeded their own rows, and leaks a primary key into a
   * surface that has no need for one. The server resolves slugs to ids against
   * the active taxonomy. Matched ANY (OR) within this group.
   */
  roleSlugs: string[]
  /** `role_family` enum values, already validated. Matched ANY (OR). */
  roleFamilies: RoleFamily[]
  /** `title_seniority` enum values, already validated. Matched ANY (OR). */
  seniorities: TitleSeniority[]
  /**
   * ISO-2 country codes, matched against the **derived** `country_code` rather
   * than the raw `location_country` — which today holds both `IN` and `India`
   * for the same country, so an equality filter on it would answer the same
   * question two different ways. Matched ANY (OR).
   */
  countries: string[]
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
  /**
   * What the AI parse could not apply, carried in the URL so it travels with
   * the search it describes — through a reload, a shared link, and every page
   * of results. Not a filter, so it lives beside them rather than among them.
   */
  unsupportedNotice: string | null
  page: number
  pageSize: number
  /** The raw strings, so the rail can render what was typed or selected. */
  raw: {
    name: string
    title: string
    location: string
    skills: string
    minYears: string
    maxYears: string
    role: string
    family: string
    seniority: string
    country: string
  }
}

/**
 * The two normalized vocabularies, as ordered option lists.
 *
 * Declared here rather than in the rail because the parser and the UI must
 * agree on both membership and wording: this is the single place that decides
 * `c_level` renders as "C-level", and the single place an unknown URL value is
 * measured against. The order is the ladder's own order, not alphabetical — a
 * seniority list sorted A–Z reads as noise.
 */
export const ROLE_FAMILY_OPTIONS: ReadonlyArray<readonly [RoleFamily, string]> = [
  ["sales", "Sales"],
  ["customer_success", "Customer Success"],
  ["marketing", "Marketing"],
  ["product", "Product"],
  ["design", "Design"],
  ["engineering", "Engineering"],
  ["operations", "Operations"],
]

export const SENIORITY_OPTIONS: ReadonlyArray<readonly [TitleSeniority, string]> = [
  ["intern", "Intern"],
  ["entry", "Entry"],
  ["mid", "Mid-level"],
  ["senior", "Senior"],
  ["staff", "Staff"],
  ["principal", "Principal"],
  ["manager", "Manager"],
  ["director", "Director"],
  ["vp", "VP"],
  ["c_level", "C-level"],
]

export function roleFamilyLabel(value: RoleFamily): string {
  return ROLE_FAMILY_OPTIONS.find(([v]) => v === value)?.[1] ?? value
}

export function seniorityLabel(value: TitleSeniority): string {
  return SENIORITY_OPTIONS.find(([v]) => v === value)?.[1] ?? value
}

export { countryLabel }

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
 * A comma-separated multi-select param → a de-duplicated, lower-cased list.
 *
 * Shape only; membership is checked separately. A slug that no longer exists
 * cannot be caught here without the database, so the server drops it when it
 * resolves slugs to ids.
 */
function parseSlugList(raw: string | undefined): string[] {
  if (!raw) return []
  return [
    ...new Set(
      raw
        .split(",")
        .map((v) => v.trim().toLowerCase())
        .filter(Boolean)
    ),
  ]
}

/**
 * The same, restricted to a known vocabulary.
 *
 * An unrecognised value is **dropped silently rather than rejected**: these
 * params come from a shared link or a hand-edited URL, and a stale enum member
 * from an older deploy should narrow a search by one option, not blank the page
 * with a validation error a recruiter cannot act on. Dropping every value of a
 * supplied filter leaves that group empty, which the server reads as "this
 * group filters nothing" — see `searchCandidates`.
 */
function parseEnumList<T extends string>(
  raw: string | undefined,
  options: ReadonlyArray<readonly [T, string]>
): T[] {
  const allowed = new Set<string>(options.map(([value]) => value))
  return parseSlugList(raw).filter((v): v is T => allowed.has(v))
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
    role: str(sp.role),
    family: str(sp.family),
    seniority: str(sp.seniority),
    country: str(sp.country),
  }

  // Free text from the parser, rendered verbatim and never parsed back apart —
  // splitting it would mangle a requirement that legitimately contains a comma.
  const unsupportedNotice = str(sp.unsupported).trim().slice(0, 400) || null

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
      roleSlugs: parseSlugList(raw.role),
      roleFamilies: parseEnumList(raw.family, ROLE_FAMILY_OPTIONS),
      seniorities: parseEnumList(raw.seniority, SENIORITY_OPTIONS),
      // Upper-cased rather than lower: ISO-2 is a code, and the column stores it
      // that way. Unknown codes are dropped, so a hand-edited URL narrows by
      // what it got right instead of failing.
      countries: parseSlugList(raw.country)
        .map((v) => v.toUpperCase())
        .filter((v) => v in COUNTRY_NAMES),
    },
    issues,
    hasBlockingIssue: Object.keys(issues).length > 0,
    unsupportedNotice,
    page: pageNumber.parse(sp.page),
    pageSize: CANDIDATE_SEARCH_PAGE_SIZE,
    raw,
  }
}

// ── The AI tab's output, validated ───────────────────────────────────────────

/** What the model is allowed to have produced, before any checking. */
export type RawAiFilters = {
  name: string | null
  title: string | null
  location: string | null
  skills: string[]
  minYears: number | null
  maxYears: number | null
  canonicalRoles: string[]
  roleFamilies: string[]
  seniorities: string[]
  countries: string[]
}

/** The same values, known-good and ready to become URL params. */
export type AiFilters = {
  name: string | null
  title: string | null
  location: string | null
  skills: string[]
  minYears: number | null
  maxYears: number | null
  roleSlugs: string[]
  roleFamilies: RoleFamily[]
  seniorities: TitleSeniority[]
  countries: string[]
}

/**
 * Check a model's parse against the vocabularies the database actually has.
 *
 * Pure, and separate from the Server Action, so `npm run ai-search-check` can
 * drive the real rules without an API key or a database. The model is already
 * constrained by a closed-enum output schema; this is the layer that does not
 * depend on the model honouring it — a slug for a role that was retired an hour
 * ago is well-formed output and still must not reach a query.
 *
 * Everything unrecognised is **dropped, never rejected**: a query that mentions
 * one role we don't know should still run the parts we do. The rail's
 * interpretation summary shows what survived, so a silent drop is still visible
 * to the recruiter.
 */
export function sanitizeAiFilters(
  raw: RawAiFilters,
  activeRoleSlugs: readonly string[]
): AiFilters {
  const active = new Set(activeRoleSlugs.map((s) => s.toLowerCase()))
  const families = new Set<string>(ROLE_FAMILY_OPTIONS.map(([v]) => v))
  const levels = new Set<string>(SENIORITY_OPTIONS.map(([v]) => v))

  const dedupe = (values: string[], allowed: Set<string>) => [
    ...new Set(
      values
        .map((v) => v.trim().toLowerCase())
        .filter((v) => v && allowed.has(v))
    ),
  ]

  // Years are validated rather than trusted: the schema guarantees an integer,
  // not a sensible one. A negative or inverted range would otherwise reach the
  // URL and be refused by the rail's own validation, leaving the recruiter
  // looking at an error they did not type.
  const minYears = raw.minYears !== null && raw.minYears >= 0 ? raw.minYears : null
  const maxYears = raw.maxYears !== null && raw.maxYears >= 0 ? raw.maxYears : null
  const rangeOk = minYears === null || maxYears === null || minYears <= maxYears

  return {
    name: raw.name?.trim() || null,
    title: raw.title?.trim() || null,
    location: raw.location?.trim() || null,
    skills: raw.skills.map((s) => s.trim()).filter(Boolean),
    minYears: rangeOk ? minYears : null,
    maxYears: rangeOk ? maxYears : null,
    roleSlugs: dedupe(raw.canonicalRoles, active),
    roleFamilies: dedupe(raw.roleFamilies, families) as RoleFamily[],
    seniorities: dedupe(raw.seniorities, levels) as TitleSeniority[],
    countries: [
      ...new Set(
        raw.countries
          .map((v) => v.trim().toUpperCase())
          .filter((v) => v in COUNTRY_NAMES)
      ),
    ],
  }
}

/** True when a parse produced nothing to search on. */
export function hasAnyAiFilter(filters: AiFilters): boolean {
  return (
    !!filters.name ||
    !!filters.title ||
    !!filters.location ||
    filters.skills.length > 0 ||
    filters.minYears !== null ||
    filters.maxYears !== null ||
    filters.roleSlugs.length > 0 ||
    filters.roleFamilies.length > 0 ||
    filters.seniorities.length > 0 ||
    filters.countries.length > 0
  )
}

/** An empty page, for "not configured", "unauthorized", and "invalid input". */
export function emptyCandidateSearchPage(
  page = 1,
  pageSize = CANDIDATE_SEARCH_PAGE_SIZE
): CandidateSearchPage {
  return { results: [], totalCount: 0, page, pageSize, totalPages: 0 }
}
