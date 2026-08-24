import { NextResponse, type NextRequest } from "next/server"

import { createAdminClient } from "@/lib/supabase/admin"
import { isN8nAuthorized } from "@/lib/server/n8n-auth"
import { dispatchAgentCall } from "@/lib/server/agent-call"
import { logActivity, logSchedulingFailure } from "@/lib/server/activity"

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
 */

const BATCH = 25
const LEASE_SECONDS = 300

/** 30s, 90s, 4.5m, 13.5m — enough to outlast a provider blip, short enough to matter. */
function backoffSeconds(attempts: number): number {
  return 30 * Math.pow(3, Math.max(0, attempts - 1))
}

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
  let sent = 0
  let suppressed = 0
  let failed = 0
  let retrying = 0

  for (const call of calls) {
    const scope = {
      client_id: call.client_id,
      candidate_id: call.candidate_id,
      job_id: call.job_id,
      application_id: call.application_id,
      sub_stage_id: call.sub_stage_id,
    }

    const result = await dispatchAgentCall(admin, {
      callId: call.call_id,
      interviewId: call.interview_id,
      campaignId: call.campaign_id,
      attempt: call.attempts,
      applicationId: call.application_id,
      candidateId: call.candidate_id,
      clientId: call.client_id,
      jobId: call.job_id,
      subStageId: call.sub_stage_id,
      agentId: call.agent_id,
      scheduledAt: call.scheduled_at,
    })

    if (result.ok) {
      sent++
      await admin
        .from("scheduled_agent_calls")
        .update({
          status: "sent",
          dispatched_at: new Date().toISOString(),
          locked_until: null,
          last_error: null,
        })
        .eq("id", call.call_id)

      await admin
        .from("interviews")
        .update({ status: "in_progress" })
        .eq("id", call.interview_id)
        .eq("status", "scheduled")

      await logActivity(admin, {
        event_type: "agent_call_dispatched",
        ...scope,
        actor_type: "system",
        system_source: "n8n:agent_call_cron",
        severity: "info",
        payload: {
          interview_id: call.interview_id,
          campaign_id: call.campaign_id,
          attempt: call.attempts,
        },
        // The attempt is in the key deliberately: a retry is a real second
        // dispatch and deserves its own line in the timeline.
        idempotency_key: `agent_call_dispatched:${call.call_id}:${call.attempts}`,
      })
      continue
    }

    if (result.kind === "suppressed") {
      // A first-class outcome, not a failure. The kill switch being off is the
      // expected state in every environment but one, and alerting on it would
      // make the alert meaningless.
      suppressed++
      await admin
        .from("scheduled_agent_calls")
        .update({
          status: "suppressed",
          suppressed_reason: result.reason,
          locked_until: null,
        })
        .eq("id", call.call_id)

      await logActivity(admin, {
        event_type: "agent_call_dispatched",
        ...scope,
        actor_type: "system",
        system_source: "n8n:agent_call_cron",
        severity: "info",
        payload: {
          interview_id: call.interview_id,
          suppressed: true,
          suppressed_reason: result.reason,
        },
        idempotency_key: `agent_call_suppressed:${call.call_id}`,
      })
      continue
    }

    // Failed. Retry with backoff until max_attempts, then give up loudly.
    const exhausted = call.attempts >= 5
    if (exhausted) {
      failed++
      await admin
        .from("scheduled_agent_calls")
        .update({ status: "failed", last_error: result.error, locked_until: null })
        .eq("id", call.call_id)

      await logSchedulingFailure(admin, {
        reasonCode: "SCHEDULED_AGENT_CALL_TRIGGER_FAILED",
        scope,
        interviewId: call.interview_id,
        agentId: call.agent_id,
        detail: { attempts: call.attempts, last_error: result.error },
        idempotencyKey: `scheduling_failed:SCHEDULED_AGENT_CALL_TRIGGER_FAILED:${call.call_id}`,
        systemSource: "n8n:agent_call_cron",
      })
    } else {
      retrying++
      await admin
        .from("scheduled_agent_calls")
        .update({
          status: "pending",
          locked_until: null,
          last_error: result.error,
          run_at: new Date(Date.now() + backoffSeconds(call.attempts) * 1000).toISOString(),
        })
        .eq("id", call.call_id)
    }
  }

  return NextResponse.json(
    { ok: true, claimed: calls.length, sent, suppressed, failed, retrying },
    { status: 200 }
  )
}
