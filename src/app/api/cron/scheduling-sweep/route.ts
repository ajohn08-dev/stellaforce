import { NextResponse, type NextRequest } from "next/server"

import { createAdminClient } from "@/lib/supabase/admin"
import { isN8nAuthorized } from "@/lib/server/n8n-auth"
import { logSchedulingFailure } from "@/lib/server/activity"

export const runtime = "nodejs"

/**
 * Housekeeping for scheduling. n8n Schedule trigger, hourly.
 *
 * Two jobs, one of which is the point:
 *
 *  1. **Expire links nobody used.** A candidate who never books is invisible
 *     otherwise — the request just sits there and the recruiter finds out when
 *     they wonder why the pipeline stalled. Each expiry raises one alert, which
 *     is the signal that actually needs a human.
 *  2. **Sweep dead holds.** Mostly a backstop: every booking path deletes
 *     expired holds for its agent under the advisory lock before reading lanes,
 *     so the table self-cleans wherever anyone is booking. This catches agents
 *     nobody has touched, whose stale holds would otherwise keep occupying a
 *     lane at the index level — an `EXCLUDE` predicate cannot call `now()`.
 */

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!isN8nAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  }

  const admin = createAdminClient()
  const now = new Date().toISOString()

  // ── 1. Links that ran out ──────────────────────────────────────────────────
  const { data: expiring } = await admin
    .from("interview_scheduling_requests")
    .select("id, client_id, candidate_id, job_id, application_id, sub_stage_id, token_expires_at")
    .in("status", ["pending", "sent"])
    .lt("token_expires_at", now)
    .limit(200)

  let expired = 0
  for (const req of expiring ?? []) {
    const { error } = await admin
      .from("interview_scheduling_requests")
      .update({
        status: "expired",
        failure_reason_code: "CANDIDATE_BOOKING_TOKEN_EXPIRED",
      })
      .eq("id", req.id)
      // Re-check the state: a candidate booking in the same second as this
      // sweep must win, and their confirm has already moved the row to 'booked'.
      .in("status", ["pending", "sent"])

    if (error) continue
    expired++

    await logSchedulingFailure(admin, {
      reasonCode: "CANDIDATE_BOOKING_TOKEN_EXPIRED",
      scope: {
        client_id: req.client_id,
        candidate_id: req.candidate_id,
        job_id: req.job_id,
        application_id: req.application_id,
        sub_stage_id: req.sub_stage_id,
      },
      schedulingRequestId: req.id,
      detail: { expired_at: req.token_expires_at },
      idempotencyKey: `scheduling_failed:CANDIDATE_BOOKING_TOKEN_EXPIRED:${req.id}`,
      systemSource: "n8n:scheduling_sweep",
    })
  }

  // ── 2. Dead holds ─────────────────────────────────────────────────────────
  // An hour's grace so a hold that expired mid-confirm is still around for the
  // booking transaction to find and report as SLOT_HOLD_EXPIRED, rather than
  // vanishing and looking like it never existed.
  const graceCutoff = new Date(Date.now() - 3_600_000).toISOString()
  const { data: purged } = await admin
    .from("interview_slot_holds")
    .delete()
    .lt("expires_at", graceCutoff)
    .select("id")

  return NextResponse.json(
    { ok: true, expired, holds_purged: purged?.length ?? 0 },
    { status: 200 }
  )
}
