import { NextResponse, type NextRequest } from "next/server"

import { createAdminClient } from "@/lib/supabase/admin"
import { isN8nAuthorized } from "@/lib/server/n8n-auth"
import { runClaimedCall, type ClaimedCall } from "@/lib/server/agent-call-queue"

export const runtime = "nodejs"

/**
 * The durable outbound queue's tick. n8n Schedule trigger, every minute.
 *
 * Follows `/api/cron/sla-check`'s conventions — bearer auth, service-role
 * client, idempotent writes — with **one deliberate divergence**: `sla-check`
 * returns a work list because n8n composes the emails, which n8n owns. Here the
 * app already knows how to reach the voice webhook, so returning a list would
 * mean n8n → app → n8n → provider for one hop's work. This route claims *and*
 * dispatches; n8n's only role is the timer.
 *
 * ⚠️ **Nothing here stamps `activity_events.dispatched_at`.** That column is the
 * shared outbox marker for the dozen event-driven workflows in n8n.md; claiming
 * it from this route would silently starve every one of them.
 *
 * What happens to each claimed row lives in `src/lib/server/agent-call-queue.ts`,
 * shared with the "Start now" path that dials from inside the candidate's own
 * request. This route is the timer and the batch; it is not the only claimant.
 */

const BATCH = 25
const LEASE_SECONDS = 300

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!isN8nAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  }

  const admin = createAdminClient()

  // FOR UPDATE SKIP LOCKED, which PostgREST cannot express. The RPC re-checks
  // the interview and the application inside the claim, so a cancellation that
  // lands between claim and dispatch is caught there rather than here.
  const { data: claimed, error } = await admin.rpc("claim_due_agent_calls", {
    p_limit: BATCH,
    p_lease_seconds: LEASE_SECONDS,
  })

  if (error) {
    console.error("[agent-call-dispatch] claim failed", error)
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  const calls = claimed ?? []
  const tally = { sent: 0, suppressed: 0, failed: 0, retrying: 0 }

  for (const call of calls) {
    const outcome = await runClaimedCall(admin, call as ClaimedCall, "n8n:agent_call_cron")
    tally[outcome]++
  }

  return NextResponse.json({ ok: true, claimed: calls.length, ...tally }, { status: 200 })
}
