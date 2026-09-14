"use server"

import { getCurrentProfile } from "@/lib/auth"
import { isStellaforceStaff } from "@/lib/permissions"
import { getActiveCanonicalRoles } from "@/lib/data"
import { hasAnyAiFilter, sanitizeAiFilters } from "@/lib/candidate-search"
import {
  MAX_QUERY_LENGTH,
  parseCandidateSearchQuery,
} from "@/lib/ai/candidate-search-parse"

/**
 * The AI tab's only server entry point.
 *
 * It parses and nothing else: it returns filter *values* for the client to put
 * in the URL, which the page then runs through the same `searchCandidates` the
 * Filters tab uses. There is deliberately no candidate query in this file — one
 * retrieval path, one set of filter semantics, one authorization check to get
 * wrong.
 *
 * **Stellaforce-side only.** Enforced here as well as on the page, because a
 * Server Action is a POST endpoint in its own right: a client-side profile that
 * never renders the page can still invoke this if it holds the action id, and
 * the candidate-domain RLS policies are permissive, so nothing downstream would
 * stop it.
 */

export type AiSearchResult =
  /** Parsed, with at least one usable filter. The client applies `filters`. */
  | {
      status: "filters"
      filters: {
        name: string | null
        title: string | null
        location: string | null
        skills: string[]
        minYears: number | null
        maxYears: number | null
        /** Canonical role **slugs**, already checked against the active taxonomy. */
        roleSlugs: string[]
        roleFamilies: string[]
        seniorities: string[]
        /** ISO-2 codes. */
        countries: string[]
      }
      unsupportedRequirements: string[]
    }
  /** Understood, but not a candidate search we can run. */
  | { status: "unsupported" }
  /** A candidate search whose every filter came back empty. */
  | { status: "no_filters" }
  /**
   * The AI provider isn't usable — key missing, placeholder, revoked, or
   * without access. Distinct from `error` because rephrasing will never help.
   */
  | { status: "not_configured" }
  /** Transient provider failure, timeout, malformed output, or an unauthorized caller. */
  | { status: "error" }

export async function runAiCandidateSearch(
  query: string
): Promise<AiSearchResult> {
  const profile = await getCurrentProfile()
  if (!isStellaforceStaff(profile)) return { status: "error" }

  const trimmed = query.trim()
  if (!trimmed || trimmed.length > MAX_QUERY_LENGTH) return { status: "error" }

  // The role vocabulary is read here, once, and used three times: to build the
  // model's closed output enum, to list the roles in its prompt, and to check
  // what comes back. Reading it in one place is what stops those three drifting.
  const roles = await getActiveCanonicalRoles()

  const outcome = await parseCandidateSearchQuery(
    trimmed,
    roles.map((role) => ({
      slug: role.slug,
      label: role.label,
      roleFamily: role.role_family,
    }))
  )
  if (!outcome.ok) {
    return outcome.reason === "not_configured"
      ? { status: "not_configured" }
      : { status: "error" }
  }

  const p = outcome.parsed
  if (p.intent === "unsupported") return { status: "unsupported" }

  // Never trust the parse. The output schema already closed the role enum, but
  // a slug can be retired between the schema being built and this line, and
  // year bounds are guaranteed to be integers rather than sensible ones. Both
  // checks live in the shared pure module, so the rail, the URL parser and this
  // action cannot disagree about what a valid filter value is.
  const filters = sanitizeAiFilters(
    {
      name: p.name,
      title: p.title,
      location: p.location,
      skills: p.skills,
      minYears: p.minYears,
      maxYears: p.maxYears,
      canonicalRoles: p.canonicalRoles,
      roleFamilies: p.roleFamilies,
      seniorities: p.seniorities,
      countries: p.countries,
    },
    roles.map((role) => role.slug)
  )

  // An intent of candidate_search with nothing to filter on would otherwise run
  // an unfiltered all-candidate search — which looks like a working answer and
  // is not one.
  if (!hasAnyAiFilter(filters)) return { status: "no_filters" }

  return {
    status: "filters",
    filters,
    unsupportedRequirements: p.unsupportedRequirements
      .map((r) => r.trim())
      .filter(Boolean),
  }
}
