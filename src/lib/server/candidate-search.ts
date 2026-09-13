import "server-only"

import { getCurrentProfile } from "@/lib/auth"
import { isSupabaseConfigured } from "@/lib/env"
import { isStellaforceStaff } from "@/lib/permissions"
import { createClient } from "@/lib/supabase/server"
import {
  CANDIDATE_SEARCH_PAGE_SIZE,
  emptyCandidateSearchPage,
  type CandidateSearchFilters,
  type CandidateSearchPage,
  type CandidateSearchResult,
} from "@/lib/candidate-search"

/**
 * Advanced Search — the query. Structured filters only.
 *
 * ⚠️ This module authorizes for itself. The page also guards, and that
 * duplication is deliberate: the candidate-domain RLS policies are permissive
 * (`USING (true)` for every authenticated user), so RLS will not catch a
 * caller that skipped the page guard. Until those policies are tightened, the
 * only thing keeping a client-side profile out of the global candidate brain on
 * this path is an explicit check — so it lives next to the query, not only at
 * the route.
 *
 * Reads go through the request-scoped client (`@/lib/supabase/server`), never
 * the service-role admin client. See `npm run service-role-check`.
 */

/**
 * The explicit column list, derived from `CandidateSearchResult`. Never `*`:
 * `candidates` carries phone, resume_path, source_metadata,
 * data_confidence_breakdown and the placeholder `embedding_vector`, none of
 * which the table renders and none of which should reach a browser.
 */
const SELECT_COLUMNS = [
  "candidate_id",
  "full_name",
  "current_title",
  "current_company",
  "linkedin_url",
  "email",
  "avatar_url",
  "years_experience",
  "location_city",
  "location_state",
].join(", ")

type CandidateSearchRow = {
  candidate_id: string
  full_name: string | null
  current_title: string | null
  current_company: string | null
  linkedin_url: string | null
  email: string | null
  avatar_url: string | null
  years_experience: number | null
  location_city: string | null
  location_state: string | null
}

/**
 * `%` and `_` are LIKE wildcards. A recruiter typing "100%" means the
 * characters, not "anything", so escape them (and the escape character itself)
 * before they reach the pattern.
 */
function likeContains(term: string): string {
  const escaped = term.replace(/\\/g, "\\\\").replace(/[%_]/g, (c) => `\\${c}`)
  return `%${escaped}%`
}

/**
 * PostgREST's `or=` grammar is comma-separated and paren-delimited, so a value
 * containing `,` `(` `)` `"` or `\` would be parsed as syntax. Double-quoting
 * the value handles most of it; stripping the quote and backslash characters
 * handles the rest. None of them appear in real skill names, so this narrows
 * nothing a recruiter would actually search for.
 */
function orSafeSkillPattern(term: string): string {
  const cleaned = term.replace(/["\\]/g, "")
  return `name.ilike."${likeContains(cleaned)}"`
}

/**
 * Resolve skill terms to the candidates who have ANY of them.
 *
 * Two steps rather than one embedded `!inner` join, because an embedded join
 * returns one row per matching skill — a candidate with both Salesforce and
 * Outreach would appear twice, and `count: 'exact'` would count them twice,
 * which quietly corrupts every page number. De-duplicating ids here keeps
 * `candidates` the only row source, so the count stays a candidate count.
 *
 * Returns `null` when no skill filter was supplied (meaning "do not filter"),
 * and `[]` when a filter was supplied but nothing matched (meaning "no results"
 * — which is not the same thing).
 */
async function candidateIdsForSkills(
  supabase: Awaited<ReturnType<typeof createClient>>,
  terms: string[]
): Promise<string[] | null> {
  if (terms.length === 0) return null

  const { data: skillRows, error: skillError } = await supabase
    .from("skills")
    .select("id")
    .or(terms.map(orSafeSkillPattern).join(","))

  if (skillError) {
    console.error("candidate search — skills lookup failed:", skillError.message)
    return []
  }

  const skillIds = (skillRows ?? []).map((s) => s.id)
  // A term that matches no skill in the vocabulary is not an error; it simply
  // contributes no matches. With ANY semantics and every term unmatched, the
  // whole filter matches nobody.
  if (skillIds.length === 0) return []

  const { data: linkRows, error: linkError } = await supabase
    .from("candidate_skills")
    .select("candidate_id")
    .in("skill_id", skillIds)

  if (linkError) {
    console.error("candidate search — candidate_skills lookup failed:", linkError.message)
    return []
  }

  return [...new Set((linkRows ?? []).map((r) => r.candidate_id))]
}

function toResult(row: CandidateSearchRow): CandidateSearchResult {
  return {
    candidateId: row.candidate_id,
    // `full_name` is generated from two NOT NULL columns, so it is never null
    // in practice; the fallback keeps the type honest rather than asserting.
    fullName: row.full_name ?? "",
    currentTitle: row.current_title,
    currentCompany: row.current_company,
    linkedinUrl: row.linkedin_url,
    email: row.email,
    avatarUrl: row.avatar_url,
    yearsExperience: row.years_experience,
    locationCity: row.location_city,
    locationState: row.location_state,
  }
}

export async function searchCandidates(
  filters: CandidateSearchFilters,
  { page, pageSize = CANDIDATE_SEARCH_PAGE_SIZE }: { page: number; pageSize?: number }
): Promise<CandidateSearchPage> {
  // Authorization first, before any query is built. Stellaforce-side only for
  // V1 — see the module header for why RLS is not load-bearing here.
  const profile = await getCurrentProfile()
  if (!isStellaforceStaff(profile)) return emptyCandidateSearchPage(page, pageSize)

  if (!isSupabaseConfigured) return emptyCandidateSearchPage(page, pageSize)
  const supabase = await createClient()

  const skillCandidateIds = await candidateIdsForSkills(supabase, filters.skillTerms)
  // A supplied skill filter that matched nobody: short-circuit rather than send
  // `.in("candidate_id", [])`, which is a query with no useful meaning.
  if (skillCandidateIds !== null && skillCandidateIds.length === 0) {
    return emptyCandidateSearchPage(page, pageSize)
  }

  let query = supabase
    .from("candidates")
    .select(SELECT_COLUMNS, { count: "exact" })

  // Every group below is ANDed. A null title/company/city is never a reason to
  // exclude someone — only a *supplied* filter that fails to match is.
  if (filters.name) query = query.ilike("full_name", likeContains(filters.name))
  if (filters.title) query = query.ilike("current_title", likeContains(filters.title))
  if (filters.location) query = query.ilike("location_city", likeContains(filters.location))
  if (filters.minYears !== undefined) query = query.gte("years_experience", filters.minYears)
  if (filters.maxYears !== undefined) query = query.lte("years_experience", filters.maxYears)
  if (skillCandidateIds !== null) query = query.in("candidate_id", skillCandidateIds)

  const from = (page - 1) * pageSize
  const { data, error, count } = await query
    .order("full_name", { ascending: true })
    .range(from, from + pageSize - 1)

  if (error) {
    // Never log the filter values — they are recruiter-entered and can contain
    // a candidate's name.
    console.error("candidate search failed:", error.message)
    return emptyCandidateSearchPage(page, pageSize)
  }

  const totalCount = count ?? 0
  return {
    results: ((data ?? []) as unknown as CandidateSearchRow[]).map(toResult),
    totalCount,
    page,
    pageSize,
    totalPages: Math.ceil(totalCount / pageSize),
  }
}
