import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import {
  ENRICHMENT_VERSION,
  readinessFor,
  reviewReasonsFor,
  sameReasons,
  type ReviewReason,
} from "@/lib/candidate-readiness"
import {
  loadTitleAliasRules,
  normalizeCandidateTitle,
} from "@/lib/server/title-normalization"
import type { TitleAliasRule } from "@/lib/title-normalization"
import { toCountryCode } from "@/lib/country-normalization"
import type { Database, SearchReadiness } from "@/lib/supabase/types"

/**
 * Candidate search enrichment — the one place derived search data is
 * reconciled.
 *
 * Called synchronously by every path that writes search-relevant candidate
 * data, so **a candidate is properly searchable by the time the recruiter sees
 * them**, not whenever a queue gets round to it. The sweep
 * (`/api/cron/search-enrichment-sweep`) exists only to catch what those paths
 * miss: a write that skipped the seam, a transient failure, a rule change.
 *
 * Takes whichever Supabase client its caller holds — the `activity.ts` pattern
 * — so it inherits the caller's scoping instead of escalating past it. A
 * recruiter's Server Action passes the request-scoped client and stays under
 * RLS; résumé ingestion and the sweep pass the admin client they already have.
 * Creating a client here would quietly opt every caller out of the
 * candidate-visibility rule.
 *
 * ## What it must never do
 *
 * No LLM, embeddings provider, or any external call — not here, and certainly
 * not in the triggers that feed it. It never writes a raw candidate field:
 * `current_title`, `current_company`, `headline`, work experience, skills and
 * identity are inputs, never outputs. It never overwrites a recruiter's
 * classification. And it never throws into its caller: a candidate that cannot
 * be enriched must still be created, stored, and findable.
 */

/** Either the request-scoped session client or the service-role admin client. */
export type EnrichmentClient = SupabaseClient<Database>

export type ReconcileReason =
  | "create"
  | "resume_ingest"
  | "override"
  | "work_experience"
  | "skills"
  | "manual_edit"
  | "backfill"
  | "retry"
  | "sweep"

export type ReconcileOptions = {
  reason: ReconcileReason
  /**
   * The override path: a human just decided the classification, so there is
   * nothing to normalize — only readiness to recompute around their decision.
   */
  skipTitleNormalization?: boolean
  /** Preloaded rules, for batch callers that would otherwise re-read them per candidate. */
  aliases?: readonly TitleAliasRule[]
  /** Sweep only. In-process callers are already inside the flow that made the change. */
  claim?: { by: string; leaseSeconds?: number }
  /** Set when reconciling straight after an ingestion run. */
  ingestionJobId?: string | null
}

export type ReconcileResult =
  | {
      status: "reconciled"
      readiness: SearchReadiness
      reviewReasons: ReviewReason[]
      classificationChanged: boolean
      /** A write landed mid-run; the row is still dirty and will be swept again. */
      stillDirty: boolean
      /** The readiness or reason set actually moved. */
      reasonsChanged: boolean
    }
  | { status: "not_found" }
  | { status: "claim_lost" }
  | { status: "failed"; error: string }

const DEFAULT_LEASE_SECONDS = 300

/** Long enough to diagnose, short enough never to carry a stack trace into a column. */
function shortError(err: unknown): string {
  const message = err instanceof Error ? err.message : "Unknown enrichment error"
  return message.slice(0, 300)
}

/**
 * Reconcile one candidate's derived search data.
 *
 * **Never throws.** Every failure path returns a result; the caller's real job
 * — creating a candidate, ingesting a résumé — must not fail because a job
 * title could not be classified or a state row could not be written.
 */
export async function reconcileCandidateSearchEnrichment(
  supabase: EnrichmentClient,
  candidateId: string,
  options: ReconcileOptions
): Promise<ReconcileResult> {
  try {
    // ── Claim, if this is the sweep ──────────────────────────────────────────
    if (options.claim) {
      const lease = options.claim.leaseSeconds ?? DEFAULT_LEASE_SECONDS
      const cutoff = new Date(Date.now() - lease * 1000).toISOString()
      const { data: claimed } = await supabase
        .from("candidate_search_state")
        .update({ claimed_at: new Date().toISOString(), claimed_by: options.claim.by })
        .eq("candidate_id", candidateId)
        .or(`claimed_at.is.null,claimed_at.lt.${cutoff}`)
        .select("candidate_id")
        .maybeSingle()
      // Someone else holds the lease. Not an error — they will finish it.
      if (!claimed) return { status: "claim_lost" }
    }

    // ── Read the watermark BEFORE anything else ──────────────────────────────
    //
    // This is the stale-job defence. Any write that lands while this function
    // runs pushes `search_dirty_at` past what we record as reconciled, so the
    // row stays dirty and gets swept again. A run that began before newer data
    // can never mark that data clean.
    const { data: existing } = await supabase
      .from("candidate_search_state")
      .select("search_dirty_at, review_reasons, readiness, attempt_count")
      .eq("candidate_id", candidateId)
      .maybeSingle()

    const observedDirtyAt = existing?.search_dirty_at ?? null

    // ── Title classification ─────────────────────────────────────────────────
    //
    // Delegated whole to the existing normalizer, which owns the re-parse and
    // override policy: an unchanged title writes nothing, and a changed title
    // under a recruiter's classification preserves theirs and reports it.
    let classificationChanged = false
    let overrideTitleChanged = false

    if (!options.skipTitleNormalization) {
      const aliases = options.aliases ?? (await loadTitleAliasRules(supabase))
      const outcome = await normalizeCandidateTitle(supabase, candidateId, { aliases })
      if (outcome.status === "failed") throw new Error(outcome.error)
      classificationChanged = outcome.status === "written"
      overrideTitleChanged = outcome.status === "review_needed"
    }

    // ── Load the candidate as it now stands ──────────────────────────────────
    //
    // After normalization, so `canonical_role_id` reflects this run rather than
    // the previous one. Explicit column list, never `select("*")`: this module
    // has no business reading a phone number.
    const { data: candidate, error: candidateError } = await supabase
      .from("candidates")
      .select(
        "candidate_id, current_title, canonical_role_id, location_city, location_country, country_code, years_experience"
      )
      .eq("candidate_id", candidateId)
      .maybeSingle()

    if (candidateError) throw new Error(candidateError.message)
    if (!candidate) return { status: "not_found" }

    const [{ data: experiences }, skills, { data: resume }] = await Promise.all([
      supabase
        .from("candidate_work_experiences")
        .select("title, is_current, display_order, start_date")
        .eq("candidate_id", candidateId),
      supabase
        .from("candidate_skills")
        .select("id", { count: "exact", head: true })
        .eq("candidate_id", candidateId),
      supabase
        .from("resumes")
        .select("parse_status")
        .eq("candidate_id", candidateId)
        .eq("is_current", true)
        .maybeSingle(),
    ])

    // ── Derived country ──────────────────────────────────────────────────────
    //
    // Resolved here rather than at query time so "in India" is one indexed
    // equality instead of a growing list of spellings in a WHERE clause. The
    // raw `location_country` is read and never written.
    const countryCode = toCountryCode(candidate.location_country)

    // ── The rules ────────────────────────────────────────────────────────────
    const reviewReasons = reviewReasonsFor({
      currentTitle: candidate.current_title,
      canonicalRoleId: candidate.canonical_role_id,
      locationCity: candidate.location_city,
      locationCountry: candidate.location_country,
      countryCode,
      yearsExperience: candidate.years_experience,
      skillCount: skills.count ?? 0,
      workExperiences: (experiences ?? []).map((e) => ({
        title: e.title,
        isCurrent: e.is_current ?? false,
        displayOrder: e.display_order,
        startDate: e.start_date,
      })),
      currentResumeParseStatus: resume?.parse_status ?? null,
      overrideTitleChanged,
    })
    const readiness = readinessFor(reviewReasons)

    // ── Record it ────────────────────────────────────────────────────────────
    //
    // Re-read `search_dirty_at` rather than trusting the value from the top: a
    // write may have landed while the rules ran, and that write owns the flag.
    const { data: latest } = await supabase
      .from("candidate_search_state")
      .select("search_dirty_at")
      .eq("candidate_id", candidateId)
      .maybeSingle()

    const stillDirty =
      !!latest?.search_dirty_at &&
      (!observedDirtyAt || latest.search_dirty_at > observedDirtyAt)

    const patch: Database["public"]["Tables"]["candidate_search_state"]["Update"] = {
      readiness,
      review_reasons: reviewReasons,
      reconciled_at: new Date().toISOString(),
      reconciled_watermark: observedDirtyAt,
      attempt_count: 0,
      last_error: null,
      enrichment_version: ENRICHMENT_VERSION,
      claimed_at: null,
      claimed_by: null,
    }
    if (options.ingestionJobId) patch.last_ingestion_job_id = options.ingestionJobId

    const { error: writeError } = await supabase
      .from("candidate_search_state")
      .upsert({ candidate_id: candidateId, ...patch }, { onConflict: "candidate_id" })

    if (writeError) throw new Error(writeError.message)

    // The only candidate column this function writes directly. Skipped when it
    // already matches, so a re-run of an unchanged candidate writes nothing and
    // cannot re-trigger anything.
    if (countryCode !== candidate.country_code) {
      const { error: countryError } = await supabase
        .from("candidates")
        .update({ country_code: countryCode })
        .eq("candidate_id", candidateId)
      if (countryError) throw new Error(countryError.message)
    }

    // Clear the flag — but only if it is still the exact value this run set out
    // to service. A write that landed mid-run has already replaced it, and the
    // `.eq()` then matches nothing, leaving the row dirty for the next sweep.
    // That conditional is the whole trick: an unconditional clear would drop a
    // flag raised for data this run never read.
    //
    // Clearing matters beyond tidiness. The sweep pages through
    // `search_dirty_at is not null`; if reconciled rows kept their flag, that
    // page would fill with candidates who need nothing and the ones who do
    // would never be reached.
    if (observedDirtyAt) {
      await supabase
        .from("candidate_search_state")
        .update({ search_dirty_at: null })
        .eq("candidate_id", candidateId)
        .eq("search_dirty_at", observedDirtyAt)
    }

    return {
      status: "reconciled",
      readiness,
      reviewReasons,
      classificationChanged,
      stillDirty,
      // Whether this run actually changed the recruiter-visible conclusion. The
      // sweep logs on it, so a quiet re-reconciliation of 500 unchanged rows
      // does not read like 500 events.
      reasonsChanged:
        !existing ||
        existing.readiness !== readiness ||
        !sameReasons(existing.review_reasons, reviewReasons),
    }
  } catch (err) {
    const error = shortError(err)
    // Never log the candidate's title, name or any other field — this line
    // lands in shared server logs.
    console.error(
      `[search-enrichment] candidate=${candidateId} reason=${options.reason}:`,
      error
    )

    // Record the failure so the sweep can back off and an operator can see it.
    // Best-effort: if even this write fails, the candidate is still created and
    // still searchable, which is the property that matters.
    try {
      const { data: prior } = await supabase
        .from("candidate_search_state")
        .select("attempt_count")
        .eq("candidate_id", candidateId)
        .maybeSingle()
      await supabase.from("candidate_search_state").upsert(
        {
          candidate_id: candidateId,
          readiness: "failed" as SearchReadiness,
          attempt_count: (prior?.attempt_count ?? 0) + 1,
          last_error: error,
          claimed_at: null,
          claimed_by: null,
        },
        { onConflict: "candidate_id" }
      )
    } catch {
      /* the candidate stands regardless */
    }

    return { status: "failed", error }
  }
}
