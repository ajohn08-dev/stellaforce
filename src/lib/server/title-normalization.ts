import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import {
  decideNormalization,
  type TitleAliasRule,
  type TitleClassification,
} from "@/lib/title-normalization"
import type { Database } from "@/lib/supabase/types"

/**
 * Applying title normalization to a candidate row — the one place any part of
 * the app writes the classification columns.
 *
 * Follows `src/lib/server/activity.ts`: it takes whichever Supabase client its
 * caller already holds rather than creating one, so it inherits the caller's
 * scoping instead of escalating past it. A recruiter's Server Action passes the
 * request-scoped client and stays under RLS; résumé ingestion passes the admin
 * client it is already using for a privileged write with no acting session.
 * Creating a client here would have quietly opted every caller out of the
 * candidate-visibility rule — see `npm run service-role-check`.
 *
 * The rules themselves live in `src/lib/title-normalization.ts`, which has no
 * database access at all. This module is the I/O around them: load the aliases,
 * re-read the candidate, write the outcome.
 */

/** Either the request-scoped session client or the service-role admin client. */
export type TitleNormalizationClient = SupabaseClient<Database>

export type NormalizationOutcome =
  /** A classification was computed and stored (it may be "unclassified"). */
  | { status: "written"; classification: TitleClassification }
  /** The title has not changed since it was last classified — nothing written. */
  | { status: "unchanged" }
  /**
   * The title changed under a recruiter's override. Their values are kept and
   * nothing was written. V1 surfaces this to the caller's logs only; the review
   * queue that will consume it is deliberately out of scope.
   */
  | { status: "review_needed" }
  /** Something went wrong. Never thrown — see `normalizeCandidateTitle`. */
  | { status: "failed"; error: string }

type AliasQueryRow = {
  alias: string
  canonical_role_id: string | null
  implied_seniority: Database["public"]["Enums"]["title_seniority"] | null
  is_ambiguous: boolean
  canonical_role: {
    slug: string
    role_family: Database["public"]["Enums"]["role_family"]
  } | null
}

/**
 * The whole rule set, joined to its roles.
 *
 * Read wholesale rather than filtered, exactly as `findOrCreateLookupRows` does
 * for `skills`/`tools`: this is a curated vocabulary in the tens of rows, and
 * matching it in application code is what keeps the whole-string rule in one
 * readable place instead of spread across a hand-escaped SQL filter.
 */
export async function loadTitleAliasRules(
  supabase: TitleNormalizationClient
): Promise<TitleAliasRule[]> {
  const { data, error } = await supabase
    .from("title_aliases")
    .select(
      "alias, canonical_role_id, implied_seniority, is_ambiguous, canonical_role:canonical_roles(slug, role_family)"
    )

  if (error) throw new Error(`Failed to load title aliases: ${error.message}`)

  return ((data ?? []) as unknown as AliasQueryRow[]).map((row) => ({
    alias: row.alias,
    canonicalRoleId: row.canonical_role_id,
    canonicalRoleSlug: row.canonical_role?.slug ?? null,
    roleFamily: row.canonical_role?.role_family ?? null,
    impliedSeniority: row.implied_seniority,
    isAmbiguous: row.is_ambiguous,
  }))
}

/**
 * Classify (or deliberately decline to reclassify) one candidate's current
 * title, and store the result.
 *
 * **Never throws.** Every caller is a path whose real job is something else —
 * creating a candidate, ingesting a résumé — and none of them may fail because
 * a job title could not be classified. An unmapped title is a normal outcome
 * with a normal representation (all columns null); a broken query is reported
 * as `failed` and logged, and the candidate write it followed still stands.
 *
 * The candidate row is re-read here rather than taken from the caller, so the
 * re-parse policy always runs against what is actually stored.
 */
export async function normalizeCandidateTitle(
  supabase: TitleNormalizationClient,
  candidateId: string,
  options: { aliases?: readonly TitleAliasRule[] } = {}
): Promise<NormalizationOutcome> {
  try {
    const { data: candidate, error: readError } = await supabase
      .from("candidates")
      .select("current_title, title_normalization_source, normalized_from_title")
      .eq("candidate_id", candidateId)
      .maybeSingle()

    if (readError) throw new Error(readError.message)
    if (!candidate) return { status: "failed", error: "Candidate not found." }

    const aliases = options.aliases ?? (await loadTitleAliasRules(supabase))

    const decision = decideNormalization({
      rawTitle: candidate.current_title,
      aliases,
      existing: {
        source: candidate.title_normalization_source,
        normalizedFromTitle: candidate.normalized_from_title,
      },
    })

    if (decision.action === "skip") return { status: "unchanged" }
    if (decision.action === "preserve") return { status: "review_needed" }

    const c = decision.classification
    const { error: writeError } = await supabase
      .from("candidates")
      // Only the classification columns. `current_title`, `headline` and every
      // identity field are untouched by this feature, by construction.
      .update({
        canonical_role_id: c.canonicalRoleId,
        role_family: c.roleFamily,
        seniority: c.seniority,
        title_normalization_source: c.source,
        title_normalization_confidence: c.confidence,
        normalized_from_title: c.normalizedFromTitle,
        title_normalized_at: new Date().toISOString(),
      })
      .eq("candidate_id", candidateId)

    if (writeError) throw new Error(writeError.message)
    return { status: "written", classification: c }
  } catch (err) {
    // Never log the title itself: it is recruiter-entered text about a real
    // person, and this line lands in shared server logs.
    const error = err instanceof Error ? err.message : "Unknown normalization error"
    console.error(`[title-normalization] candidate=${candidateId}:`, error)
    return { status: "failed", error }
  }
}
