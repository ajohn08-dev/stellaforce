import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import {
  SCHEDULING_REASONS,
  isPolicySkip,
  type SchedulingReasonCode,
} from "@/lib/scheduling-reason-codes"
import type {
  ActivityEventType,
  ActorType,
  Database,
  EventSeverity,
  Json,
} from "@/lib/supabase/types"

/**
 * Appending to the activity log — the one place any part of the app writes an
 * `activity_events` row.
 *
 * This lived as a module-private helper inside `src/app/(app)/jobs/actions.ts`,
 * which it had to: a `"use server"` file may only export async functions, and
 * every export becomes a callable RPC endpoint. Moving it here is what lets the
 * cron, the internal API routes and the public booking page use the same writer
 * as the Server Actions.
 *
 * Three differences from the version it replaces: the client type is widened
 * (the cron and the public route hold an admin client, not a session one),
 * `system_source` is settable, and `reverses_event_id` is settable so a
 * resolution can point at the alert it clears.
 */

/**
 * Either the request-scoped session client (`@/lib/supabase/server`) or the
 * service-role admin client (`@/lib/supabase/admin`). Structurally identical;
 * which one you hold decides whether RLS applies, not what this writes.
 */
export type ActivityClient = SupabaseClient<Database>

export type ActivityInput = {
  event_type: ActivityEventType
  client_id?: string | null
  candidate_id?: string | null
  job_id?: string | null
  application_id?: string | null
  sub_stage_id?: string | null
  actor_type?: ActorType
  actor_profile_id?: string | null
  /** e.g. `'n8n:agent_call_cron'`, `'app:booking'`. Convention: `<system>:<workflow>`. */
  system_source?: string | null
  severity?: EventSeverity
  payload?: Json
  /**
   * The event this one undoes or resolves. An existing self-FK whose documented
   * meaning is "reverses"; a resolution is close enough to reuse it rather than
   * add a second self-reference — but a timeline UI should not render the two
   * identically.
   */
  reverses_event_id?: string | null
  idempotency_key?: string | null
}

// `dispatched_at` is deliberately absent from ActivityInput and always will be.
// It belongs to the outbox dispatcher, and n8n.md's register depends on it
// meaning "some workflow consumed this" — nothing in the app may claim it.

/**
 * Append an activity event. With an `idempotency_key`, a redelivery is a no-op.
 *
 * Returns the row id when it can, so a caller that needs to point a later
 * resolution at this alert has something to point at. Null on a deduped
 * redelivery, which is correct: nothing new was written.
 */
export async function logActivity(
  supabase: ActivityClient,
  e: ActivityInput
): Promise<string | null> {
  const row = {
    event_type: e.event_type,
    client_id: e.client_id ?? null,
    candidate_id: e.candidate_id ?? null,
    job_id: e.job_id ?? null,
    application_id: e.application_id ?? null,
    sub_stage_id: e.sub_stage_id ?? null,
    actor_type: e.actor_type ?? "user",
    actor_profile_id: e.actor_profile_id ?? null,
    system_source: e.system_source ?? null,
    severity: e.severity ?? "info",
    payload: e.payload ?? {},
    reverses_event_id: e.reverses_event_id ?? null,
    idempotency_key: e.idempotency_key ?? null,
  }

  if (row.idempotency_key) {
    const { data } = await supabase
      .from("activity_events")
      .upsert(row, { onConflict: "idempotency_key", ignoreDuplicates: true })
      .select("id")
      .maybeSingle()
    return data?.id ?? null
  }

  const { data } = await supabase.from("activity_events").insert(row).select("id").maybeSingle()
  return data?.id ?? null
}

/** The ids every scheduling event is scoped to. */
export type SchedulingScope = {
  client_id: string
  candidate_id: string
  job_id: string
  application_id: string
  sub_stage_id?: string | null
}

/**
 * Record that an automation deliberately did nothing.
 *
 * Logged at `info`, never `alert`: a paused automation is the system obeying an
 * instruction, and putting it in the recruiter's Actions list would train people
 * to ignore that list. The activity feed still shows it, which is the point —
 * "why didn't this candidate get a link?" has an answer.
 */
export async function logAutomationSkipped(
  supabase: ActivityClient,
  input: {
    automationKey: string
    reasonCode: SchedulingReasonCode
    effectiveState: string
    sourceScope: string
    sourceLabel: string
    scope: SchedulingScope
    correlationId?: string | null
    systemSource?: string
  }
): Promise<string | null> {
  return logActivity(supabase, {
    event_type: "automation_skipped_by_policy",
    ...input.scope,
    actor_type: "system",
    system_source: input.systemSource ?? "app:automation_gate",
    severity: "info",
    payload: {
      automation_key: input.automationKey,
      reason_code: input.reasonCode,
      effective_state: input.effectiveState,
      source_scope: input.sourceScope,
      source_label: input.sourceLabel,
      correlation_id: input.correlationId ?? null,
      message: SCHEDULING_REASONS[input.reasonCode].message,
    },
    // One skip per application per stage per automation. A stage entry that
    // fires three lifecycle events must not produce three identical skips.
    idempotency_key: `automation_skipped_by_policy:${input.automationKey}:${input.scope.application_id}:${input.scope.sub_stage_id ?? "none"}`,
  })
}

/**
 * Record that scheduling could not do what it was asked to.
 *
 * `alert` severity, so it reaches the recruiter through `buildPulseActions`
 * without a task table. Returns the event id so the eventual resolution can
 * reference it — see `logSchedulingResolved`.
 *
 * Refuses policy skips: those have their own event and their own severity, and
 * routing them here would make a working system look broken.
 */
export async function logSchedulingFailure(
  supabase: ActivityClient,
  input: {
    reasonCode: SchedulingReasonCode
    scope: SchedulingScope
    automationKey?: string
    schedulingRequestId?: string | null
    interviewId?: string | null
    agentId?: string | null
    detail?: Record<string, Json>
    correlationId?: string | null
    /** Distinguishes a fresh failure from a retry of the same one. */
    idempotencyKey?: string
    systemSource?: string
  }
): Promise<string | null> {
  if (isPolicySkip(input.reasonCode)) {
    throw new Error(
      `${input.reasonCode} is a policy skip — use logAutomationSkipped, not logSchedulingFailure.`
    )
  }
  const meta = SCHEDULING_REASONS[input.reasonCode]

  return logActivity(supabase, {
    event_type: "scheduling_failed",
    ...input.scope,
    actor_type: "system",
    system_source: input.systemSource ?? "app:scheduling",
    severity: "alert",
    payload: {
      automation_key: input.automationKey ?? "send_booking_link",
      reason_code: input.reasonCode,
      message: meta.message,
      recommended_action: meta.recommendedAction,
      retryable: meta.retryable,
      scheduling_request_id: input.schedulingRequestId ?? null,
      interview_id: input.interviewId ?? null,
      agent_id: input.agentId ?? null,
      correlation_id: input.correlationId ?? null,
      ...(input.detail ?? {}),
    },
    idempotency_key:
      input.idempotencyKey ??
      `scheduling_failed:${input.reasonCode}:${input.schedulingRequestId ?? input.scope.application_id}`,
  })
}

/**
 * Clear a failure that has actually been resolved.
 *
 * Points at the original alert through `reverses_event_id`, so "is this still a
 * problem?" is a lookup rather than a guess. Deliberately explicit: a later
 * unrelated event happening on the same application does **not** mean the
 * scheduling problem went away, and inferring that is how a stale alert
 * silently disappears.
 */
export async function logSchedulingResolved(
  supabase: ActivityClient,
  input: {
    originalEventId: string
    reasonCode: SchedulingReasonCode
    scope: SchedulingScope
    detail?: Record<string, Json>
    systemSource?: string
  }
): Promise<string | null> {
  return logActivity(supabase, {
    event_type: "scheduling_failure_resolved",
    ...input.scope,
    actor_type: "system",
    system_source: input.systemSource ?? "app:scheduling",
    severity: "info",
    reverses_event_id: input.originalEventId,
    payload: {
      reason_code: input.reasonCode,
      resolves_event_id: input.originalEventId,
      ...(input.detail ?? {}),
    },
    idempotency_key: `scheduling_failure_resolved:${input.originalEventId}`,
  })
}
