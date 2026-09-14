import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import { scopeStateFor } from "@/lib/server/automation-scope-state"
import { scopeSwitchLockReason, type ScopeSwitch } from "@/lib/automation-scope-state"
import type { SchedulingReasonCode } from "@/lib/scheduling-reason-codes"
import type { Database } from "@/lib/supabase/types"

/**
 * The one question every hop that leaves the building has to ask first.
 *
 * The automation library does not cover everything that reaches a person: a
 * calendar-connect invite, an SLA breach email, the Agents-page test call and
 * the interview room all sit outside it. So "turn automations off for this
 * account" cannot be enforced by the automation resolver alone — this gate is
 * the other half, and it reads the same `automation_scope_settings` rows
 * through the same pure resolver, so the two can never disagree.
 *
 * ## The override, and why there is exactly one
 *
 * Turning an account off means *nothing happens without a person deciding this
 * specific thing, now*. That is not the same as freezing the platform: a
 * recruiter looking at one candidate, on one stage, may still choose to send
 * the thing the automation would have sent. So:
 *
 * - **Ambient controls pass no override and are blocked.** The test-call
 *   button, "resend calendar invite", the publish-time invite loop — none of
 *   them names a suppressed action, and a button that quietly still works is
 *   how an account that was switched off keeps emailing people.
 * - **Per-item actions may pass one.** The "Send it now" button beside a
 *   suppressed action in the job pulse identifies one candidate and one
 *   automation and was confirmed by a human. It writes an `audit_log` row.
 *
 * If you find yourself wanting to pass an override from a new call site, the
 * question to answer first is "did a person confirm *this* send, against a
 * named candidate, seconds ago?" — if not, it is ambient.
 */

export type OutboundGateClient = SupabaseClient<Database>

/**
 * Which kind of thing is trying to leave. Not a permission axis today — every
 * channel is stopped by an account-wide switch — but it is what a per-channel
 * control would key on, and it is what the audit row records, so the question
 * "what did we stop" is answerable without parsing call sites.
 */
export type OutboundChannel =
  | "voice_call"
  | "candidate_email"
  | "team_email"
  | "calendar"
  | "sla_email"

export type OutboundOverride = {
  actorProfileId: string
  /** Why a person chose to send this anyway. Written to the audit row. */
  reason: string
}

export type OutboundDecision =
  | { allowed: true; override: OutboundOverride | null }
  | {
      allowed: false
      /** Maps onto the existing scheduling vocabulary rather than a new one. */
      reasonCode: Extract<
        SchedulingReasonCode,
        "ACCOUNT_AUTOMATIONS_OFF" | "ACCOUNT_AUTOMATIONS_PAUSED"
      >
      switch: ScopeSwitch
      /** A sentence, already written — call sites must not compose their own. */
      message: string
    }

export type OutboundGateInput = {
  channel: OutboundChannel
  /** `clients.client_id` of the account this send belongs to. */
  clientId: string | null
  /**
   * Narrows to one automation category when the send *is* an automation. Omit
   * for the hops that belong to no category (a calendar invite, a test call) —
   * only an account-wide row may stop those, never a category-specific one.
   */
  category?: string
  /** What the send is about, for the audit row when an override is used. */
  scope?: {
    application_id?: string | null
    candidate_id?: string | null
    job_id?: string | null
    sub_stage_id?: string | null
  }
  override?: OutboundOverride | null
}

/**
 * May this send happen?
 *
 * Never throws and never writes on the allow path, so it is safe to call
 * first thing in any dispatcher. When an override is used it writes one
 * `audit_log` row before returning — the send itself is the caller's job, and
 * recording the decision is not conditional on the send succeeding.
 */
export async function checkOutbound(
  supabase: OutboundGateClient,
  input: OutboundGateInput
): Promise<OutboundDecision> {
  const sw = await scopeStateFor(input.clientId, input.category)

  if (!sw) return { allowed: true, override: null }

  if (input.override) {
    await writeOverrideAudit(supabase, input, sw)
    return { allowed: true, override: input.override }
  }

  return {
    allowed: false,
    reasonCode: sw.state === "paused" ? "ACCOUNT_AUTOMATIONS_PAUSED" : "ACCOUNT_AUTOMATIONS_OFF",
    switch: sw,
    message: scopeSwitchLockReason(sw),
  }
}

/**
 * A human sent something the account's switch would have stopped.
 *
 * `audit_log`, not `activity_events` — this row answers "who overrode the
 * configuration", which is an admin question. The *candidate-facing* half of
 * the same act is logged separately by the caller as an activity event on the
 * application, because that one did happen to a person and belongs on their
 * timeline. The asymmetry is deliberate; see the automation_bindings precedent.
 */
async function writeOverrideAudit(
  supabase: OutboundGateClient,
  input: OutboundGateInput,
  sw: ScopeSwitch
): Promise<void> {
  const override = input.override
  if (!override) return

  // Never let an audit failure stop a send a person explicitly asked for — but
  // never let it pass silently either.
  const { error } = await supabase.from("audit_log").insert({
    entity_type: "outbound_override",
    entity_id: input.scope?.application_id ?? null,
    action: "sent_despite_switch",
    actor_profile_id: override.actorProfileId,
    client_id: input.clientId,
    diff: ({
      channel: input.channel,
      reason: override.reason,
      switch_state: sw.state,
      switch_scope: sw.source.scope,
      switch_source: sw.source.label,
      switch_category: sw.category,
      application_id: input.scope?.application_id ?? null,
      candidate_id: input.scope?.candidate_id ?? null,
      job_id: input.scope?.job_id ?? null,
      sub_stage_id: input.scope?.sub_stage_id ?? null,
    }) as never,
  })
  if (error) {
    console.error("[outbound-gate] override audit failed", {
      channel: input.channel,
      error: error.message,
    })
  }
}
