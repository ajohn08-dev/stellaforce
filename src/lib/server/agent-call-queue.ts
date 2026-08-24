import "server-only"

import { dispatchAgentCall, type AgentCallClient } from "@/lib/server/agent-call"
import { logActivity, logSchedulingFailure } from "@/lib/server/activity"

/**
 * What happens to a claimed call, once.
 *
 * Two things claim rows from `scheduled_agent_calls` — the every-minute tick
 * (`/api/cron/agent-call-dispatch`) and a candidate pressing "Start now"
 * (`confirmBooking`) — and what follows the dispatch is identical for both:
 * the same guards, the same four outcomes, the same state transitions, the same
 * events. This module is that shared half, so the two callers differ only in
 * *which* row they claim and who they say they are.
 *
 * Keeping it in one place is the whole point. The alternative — the inline path
 * writing its own status updates — is how a call ends up `sent` with no
 * `dispatched_at`, or retried by the cron after the inline attempt already rang
 * a phone. Nothing un-rings a phone.
 *
 * ⚠️ **Nothing here stamps `activity_events.dispatched_at`.** That column is the
 * shared outbox marker for the event-driven n8n workflows; claiming it here
 * would silently starve every one of them.
 */

/** One row as returned by either claim function — they share a signature. */
export type ClaimedCall = {
  call_id: string
  interview_id: string
  attempts: number
  campaign_id: string
  application_id: string
  candidate_id: string
  client_id: string
  job_id: string
  sub_stage_id: string
  agent_id: string
  scheduled_at: string
}

export type CallRunOutcome = "sent" | "suppressed" | "failed" | "retrying"

/** 30s, 90s, 4.5m, 13.5m — enough to outlast a provider blip, short enough to matter. */
function backoffSeconds(attempts: number): number {
  return 30 * Math.pow(3, Math.max(0, attempts - 1))
}

const MAX_ATTEMPTS = 5

export async function runClaimedCall(
  admin: AgentCallClient,
  call: ClaimedCall,
  /** e.g. `n8n:agent_call_cron` or `app:booking` — whose action this was. */
  systemSource: string
): Promise<CallRunOutcome> {
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
      system_source: systemSource,
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
    return "sent"
  }

  if (result.kind === "suppressed") {
    // A first-class outcome, not a failure. The kill switch being off is the
    // expected state in every environment but one, and alerting on it would
    // make the alert meaningless.
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
      system_source: systemSource,
      severity: "info",
      payload: {
        interview_id: call.interview_id,
        suppressed: true,
        suppressed_reason: result.reason,
      },
      idempotency_key: `agent_call_suppressed:${call.call_id}`,
    })
    return "suppressed"
  }

  // Failed. Retry with backoff until max_attempts, then give up loudly.
  if (call.attempts >= MAX_ATTEMPTS) {
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
      systemSource,
    })
    return "failed"
  }

  await admin
    .from("scheduled_agent_calls")
    .update({
      status: "pending",
      locked_until: null,
      last_error: result.error,
      run_at: new Date(Date.now() + backoffSeconds(call.attempts) * 1000).toISOString(),
    })
    .eq("id", call.call_id)
  return "retrying"
}

/**
 * Dial a just-booked interview from inside the candidate's own request.
 *
 * Only ever called for "Start now". A scheduled booking waits for the tick,
 * because its whole point is that it happens later.
 *
 * **Never throws, and its result is deliberately ignored by the caller.** A
 * booking that succeeded must not be reported as failed because the dial did
 * not go out — the row stays claimed, its lease expires, and the cron picks it
 * up. That is also the answer to "what if there is no cron yet": the call is
 * simply never retried, which is no worse than today.
 *
 * Returns `null` when there was nothing to claim — a human-interviewer booking
 * queues no call at all, and a row the cron grabbed a moment earlier is already
 * being handled.
 */
export async function dispatchStartNowCall(
  admin: AgentCallClient,
  interviewId: string
): Promise<CallRunOutcome | null> {
  try {
    const { data, error } = await admin.rpc("claim_agent_call_for_interview", {
      p_interview_id: interviewId,
    })
    if (error) {
      console.error("[agent-call-queue] start-now claim failed", error)
      return null
    }
    const call = (data ?? [])[0]
    if (!call) return null

    return await runClaimedCall(admin, call as ClaimedCall, "app:booking")
  } catch (err) {
    // The booking is already committed. Whatever went wrong here, the candidate
    // must still see a confirmed interview.
    console.error("[agent-call-queue] start-now dispatch failed", err)
    return null
  }
}
