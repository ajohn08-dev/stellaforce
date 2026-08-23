import "server-only"

import { serverEnv } from "@/lib/env"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase/types"

/**
 * Placing a real agent call for a booked interview.
 *
 * Shaped like `src/lib/server/calendar-invite.ts` — fetch to n8n with a bearer
 * token, an AbortController timeout, and a typed result union that never throws.
 * The provider hop itself is n8n's, exactly as it is for the Agents-page test
 * call; this adds the guards that a *scheduled* call needs and a manual one
 * doesn't.
 *
 * ⚠️ **The difference from the test-call button is that nobody clicks this.**
 * A cron dispatching on a timer will keep dialling whatever it is pointed at,
 * and all fourteen QA fixture candidates share one real phone number and one
 * real inbox (CLAUDE.md, "QA test fixtures"). Three independent guards below,
 * each of which alone is enough to stop a call.
 */

export type AgentCallClient = SupabaseClient<Database>

export type AgentCallResult =
  | { ok: true }
  /** Deliberately not dialled. A first-class outcome, never an alert. */
  | { ok: false; kind: "suppressed"; reason: string }
  | { ok: false; kind: "failed"; error: string }

export type AgentCallContext = {
  callId: string
  interviewId: string
  campaignId: string
  attempt: number
  applicationId: string
  candidateId: string
  clientId: string
  jobId: string
  subStageId: string
  agentId: string
  scheduledAt: string
}

/** What n8n needs to place the call. Mirrors the existing CallDispatchPayload. */
type ScheduledCallPayload = {
  to_number: string
  agent_id: string
  agent_name: string
  external_agent_id: string | null
  is_test: false
  interview_id: string
  application_id: string
  candidate_id: string
  candidate_name: string
  job_id: string
  job_title: string
  client_id: string
  sub_stage_id: string
  campaign_id: string
  /** Stable per attempt, so n8n can tell a retry from a new call. */
  idempotency_key: string
  scheduled_at: string
  interview_name: string
  candidate_timezone: string | null
}

/**
 * How many live calls may target one phone number at once.
 *
 * Not a constraint, because it is a property of the *world* (one person, one
 * handset) rather than of the schema. This is the guard that stops "fourteen
 * fixture candidates on one stage" becoming fourteen simultaneous calls to the
 * same phone.
 */
const MAX_CONCURRENT_PER_NUMBER = 3

export async function dispatchAgentCall(
  supabase: AgentCallClient,
  ctx: AgentCallContext
): Promise<AgentCallResult> {
  // ── Guard 1: the global kill switch, which defaults to off ────────────────
  if (!serverEnv.schedulingOutboundEnabled) {
    return { ok: false, kind: "suppressed", reason: "outbound_disabled" }
  }

  const [{ data: candidate }, { data: agent }, { data: job }, { data: stage }, { data: interview }] =
    await Promise.all([
      supabase
        .from("candidates")
        .select("candidate_id, full_name, phone, source")
        .eq("candidate_id", ctx.candidateId)
        .maybeSingle(),
      supabase
        .from("agents")
        .select("id, name, external_agent_id, status")
        .eq("id", ctx.agentId)
        .maybeSingle(),
      supabase.from("job_orders").select("job_id, title").eq("job_id", ctx.jobId).maybeSingle(),
      supabase
        .from("job_workflow_sub_stages")
        .select("id, name")
        .eq("id", ctx.subStageId)
        .maybeSingle(),
      supabase
        .from("interviews")
        .select("id, status, candidate_timezone")
        .eq("id", ctx.interviewId)
        .maybeSingle(),
    ])

  // ── Guard 2: QA fixtures reach a real person ──────────────────────────────
  // `source` is the documented deletion key for those rows, so it is the right
  // discriminator — the names and emails are deliberately unreliable.
  if (candidate?.source === "qa_test_fixture" && !serverEnv.schedulingAllowFixtureCalls) {
    return { ok: false, kind: "suppressed", reason: "qa_fixture_candidate" }
  }

  if (!candidate?.phone) {
    return { ok: false, kind: "failed", error: "The candidate has no phone number." }
  }
  if (!agent || agent.status !== "active") {
    return { ok: false, kind: "failed", error: "The agent is missing or inactive." }
  }
  if (!agent.external_agent_id) {
    // Seeded agents deliberately carry a null external id until each one is
    // created in ElevenLabs. Suppressed, not failed: nothing is broken, the
    // agent simply isn't wired up yet.
    return { ok: false, kind: "suppressed", reason: "agent_not_provisioned" }
  }

  // Last re-read before the irreversible step. The claim already checked this,
  // but a cancellation landing in between is exactly the race worth closing —
  // nothing un-rings a phone.
  if (!interview || interview.status !== "scheduled") {
    return { ok: false, kind: "suppressed", reason: "interview_no_longer_scheduled" }
  }

  // ── Guard 3: one handset, one conversation ────────────────────────────────
  const { count } = await supabase
    .from("scheduled_agent_calls")
    .select("id, candidates!inner(phone)", { count: "exact", head: true })
    .in("status", ["claimed", "sent"])
    .eq("candidates.phone", candidate.phone)
    .neq("id", ctx.callId)
  if ((count ?? 0) >= MAX_CONCURRENT_PER_NUMBER) {
    return { ok: false, kind: "suppressed", reason: "too_many_calls_to_one_number" }
  }

  const payload: ScheduledCallPayload = {
    to_number: candidate.phone,
    agent_id: agent.id,
    agent_name: agent.name,
    external_agent_id: agent.external_agent_id,
    is_test: false,
    interview_id: ctx.interviewId,
    application_id: ctx.applicationId,
    candidate_id: ctx.candidateId,
    candidate_name: candidate.full_name ?? "",
    job_id: ctx.jobId,
    job_title: job?.title ?? "",
    client_id: ctx.clientId,
    sub_stage_id: ctx.subStageId,
    campaign_id: ctx.campaignId,
    // Attempt is in the key so n8n can distinguish a retry from a new call,
    // while `campaign_id` stays stable so the provider can dedupe across both.
    idempotency_key: `${ctx.callId}:attempt_${ctx.attempt}`,
    scheduled_at: ctx.scheduledAt,
    interview_name: stage?.name ?? "Interview",
    candidate_timezone: interview.candidate_timezone,
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15_000)
  try {
    const res = await fetch(serverEnv.n8nVoiceTestCallWebhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serverEnv.n8nWebhookSecret}`,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout))

    if (!res.ok) {
      const body = await res.text()
      return {
        ok: false,
        kind: "failed",
        error: `Calling service returned ${res.status}. ${body.slice(0, 200)}`,
      }
    }
    return { ok: true }
  } catch (err) {
    return {
      ok: false,
      kind: "failed",
      error:
        err instanceof Error
          ? `Could not reach the calling service: ${err.message}`
          : "Could not reach the calling service.",
    }
  }
}
