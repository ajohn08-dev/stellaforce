import { NextResponse, type NextRequest } from "next/server"

import { createAdminClient } from "@/lib/supabase/admin"
import { isN8nAuthorized } from "@/lib/server/n8n-auth"
import { ENRICHMENT_VERSION } from "@/lib/candidate-readiness"
import { reconcileCandidateSearchEnrichment } from "@/lib/server/candidate-search-enrichment"
import { loadTitleAliasRules } from "@/lib/server/title-normalization"

export const runtime = "nodejs"

/**
 * Search-enrichment sweep. n8n Schedule trigger; every few minutes is plenty.
 *
 * **This is the safety net, not the main path.** Every code path that writes
 * search-relevant candidate data reconciles in-process and synchronously, so a
 * candidate is properly searchable by the time the recruiter sees them. This
 * catches the rest:
 *
 *  1. **Writes that skipped the seam** — a psql fix, a future edit form, a
 *     backfill. The row-level triggers flag those; nothing else would notice.
 *  2. **Rule changes.** Bumping `ENRICHMENT_VERSION` re-reconciles every
 *     candidate without a migration, which is how a new alias or a new review
 *     reason reaches people who were already stored.
 *  3. **Transient failures**, with backoff.
 *
 * n8n schedules it and nothing more. Readiness is computed and stored by the
 * app — n8n is a timer here, never the source of truth.
 *
 * Ordering is deliberate: dirty rows first (a recruiter is waiting on those),
 * then version-stale ones, then retries. Bounded per tick so one sweep can
 * never hold a connection open across thousands of candidates.
 */

const BATCH_LIMIT = 100
const MAX_ATTEMPTS = 5
/** Backoff floor, doubling per attempt: 2, 4, 8, 16, 32 minutes. */
const BACKOFF_BASE_MINUTES = 2

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!isN8nAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  }

  const admin = createAdminClient()
  const workerId = `sweep:${crypto.randomUUID().slice(0, 8)}`

  // ── Pick the work ──────────────────────────────────────────────────────────
  //
  // Three selections rather than one `.or()`: the conditions compare different
  // columns to different things, and a single PostgREST filter string
  // expressing all three would be unreadable and easy to get subtly wrong.

  const { data: dirty } = await admin
    .from("candidate_search_state")
    .select("candidate_id, search_dirty_at, reconciled_watermark")
    .not("search_dirty_at", "is", null)
    .order("search_dirty_at", { ascending: true })
    .limit(BATCH_LIMIT)

  // `search_dirty_at > reconciled_watermark` is the stale-data test, filtered
  // here rather than in SQL because PostgREST cannot compare two columns.
  const dirtyIds = (dirty ?? [])
    .filter(
      (row) =>
        !row.reconciled_watermark ||
        (row.search_dirty_at ?? "") > row.reconciled_watermark
    )
    .map((row) => row.candidate_id)

  const remaining = BATCH_LIMIT - dirtyIds.length

  const { data: stale } =
    remaining > 0
      ? await admin
          .from("candidate_search_state")
          .select("candidate_id")
          .lt("enrichment_version", ENRICHMENT_VERSION)
          .limit(remaining)
      : { data: [] }

  const retryCutoff = new Date(
    Date.now() - BACKOFF_BASE_MINUTES * 60_000
  ).toISOString()
  const { data: failed } =
    remaining - (stale?.length ?? 0) > 0
      ? await admin
          .from("candidate_search_state")
          .select("candidate_id, attempt_count, updated_at")
          .eq("readiness", "failed")
          .lt("attempt_count", MAX_ATTEMPTS)
          .lt("updated_at", retryCutoff)
          .limit(remaining - (stale?.length ?? 0))
      : { data: [] }

  // Exponential backoff, applied here rather than stored as a due-at column:
  // attempt count and last-touched are already recorded, and a second
  // scheduling column would be a value that can disagree with them.
  const retryIds = (failed ?? [])
    .filter((row) => {
      const waitMs = BACKOFF_BASE_MINUTES * 60_000 * 2 ** Math.max(0, row.attempt_count - 1)
      return Date.now() - new Date(row.updated_at).getTime() >= waitMs
    })
    .map((row) => row.candidate_id)

  const candidateIds = [
    ...new Set([...dirtyIds, ...(stale ?? []).map((r) => r.candidate_id), ...retryIds]),
  ]

  if (candidateIds.length === 0) {
    return NextResponse.json({ ok: true, claimed: 0, reconciled: 0, changed: 0 })
  }

  // One alias read for the whole batch rather than one per candidate.
  let aliases
  try {
    aliases = await loadTitleAliasRules(admin)
  } catch (err) {
    const error = err instanceof Error ? err.message : "alias load failed"
    console.error("[search-enrichment-sweep]", error)
    return NextResponse.json({ ok: false, error }, { status: 500 })
  }

  // ── Do the work ────────────────────────────────────────────────────────────
  //
  // Sequential on purpose. This is a background sweep with nobody waiting on
  // it, and a burst of parallel writes would contend with the recruiter traffic
  // that *does* have someone waiting.
  let reconciled = 0
  let changed = 0
  let stillDirty = 0
  let claimLost = 0
  let failures = 0

  for (const candidateId of candidateIds) {
    const result = await reconcileCandidateSearchEnrichment(admin, candidateId, {
      reason: "sweep",
      aliases,
      claim: { by: workerId },
    })

    switch (result.status) {
      case "reconciled":
        reconciled++
        if (result.reasonsChanged) changed++
        if (result.stillDirty) stillDirty++
        break
      case "claim_lost":
        claimLost++
        break
      case "failed":
        failures++
        break
      case "not_found":
        // The candidate was deleted mid-sweep. The state row went with it via
        // ON DELETE CASCADE, so there is nothing to clean up and nothing wrong.
        break
    }
  }

  return NextResponse.json({
    ok: true,
    claimed: candidateIds.length,
    reconciled,
    // Only these two are worth an operator's attention: `changed` says the
    // sweep found something, `failures` says something is broken.
    changed,
    stillDirty,
    claimLost,
    failures,
  })
}
