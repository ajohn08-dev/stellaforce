"use server"

import { getCurrentProfile } from "@/lib/auth"
import { isStellaforceStaff } from "@/lib/permissions"
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

  const outcome = await parseCandidateSearchQuery(trimmed)
  if (!outcome.ok) {
    return outcome.reason === "not_configured"
      ? { status: "not_configured" }
      : { status: "error" }
  }

  const p = outcome.parsed
  if (p.intent === "unsupported") return { status: "unsupported" }

  // Years are validated here rather than trusted: the schema guarantees an
  // integer, not a *sensible* one. A negative or inverted range would otherwise
  // reach the URL and be rejected by the rail's own validation, leaving the
  // recruiter looking at an error they didn't type.
  const minYears = p.minYears !== null && p.minYears >= 0 ? p.minYears : null
  const maxYears = p.maxYears !== null && p.maxYears >= 0 ? p.maxYears : null
  const rangeOk = minYears === null || maxYears === null || minYears <= maxYears

  const filters = {
    name: p.name?.trim() || null,
    title: p.title?.trim() || null,
    location: p.location?.trim() || null,
    skills: p.skills.map((s) => s.trim()).filter(Boolean),
    minYears: rangeOk ? minYears : null,
    maxYears: rangeOk ? maxYears : null,
  }

  const hasAnyFilter =
    !!filters.name ||
    !!filters.title ||
    !!filters.location ||
    filters.skills.length > 0 ||
    filters.minYears !== null ||
    filters.maxYears !== null

  // An intent of candidate_search with nothing to filter on would otherwise run
  // an unfiltered all-candidate search — which looks like a working answer and
  // is not one.
  if (!hasAnyFilter) return { status: "no_filters" }

  return {
    status: "filters",
    filters,
    unsupportedRequirements: p.unsupportedRequirements
      .map((r) => r.trim())
      .filter(Boolean),
  }
}
