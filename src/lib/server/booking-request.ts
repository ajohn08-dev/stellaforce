import "server-only"

import { serverEnv } from "@/lib/env"
import { createAdminClient } from "@/lib/supabase/admin"
import { resolveAutomationWithClient } from "@/lib/automation-settings"
import { logActivity, logAutomationSkipped, logSchedulingFailure } from "@/lib/server/activity"
import { mintBookingToken } from "@/lib/server/booking-token"
import { resolveStageSchedulingConfig } from "@/lib/server/scheduling-config"
import type { SchedulingReasonCode } from "@/lib/scheduling-reason-codes"

/**
 * What happens when a candidate lands on a self-scheduling agent stage.
 *
 * Called from `moveCandidate` and from the internal move-stage route, after the
 * stage change has committed. **Never throws** — a booking link that couldn't be
 * created must not roll back the candidate's move, which is a decision a
 * recruiter made and a fact that already happened.
 *
 * The order matters and is deliberate:
 *
 *   1. Is this even a self-scheduling agent stage? If not, do nothing and log
 *      nothing. Most stages aren't, and a skip event on every one of them would
 *      bury the ones that mean something.
 *   2. Does the automation gate allow it? If not, log `automation_skipped_by_policy`
 *      and stop. No request row is created — an orphan request nobody will ever
 *      send is worse than none.
 *   3. Create the request and the token, then hand the link to n8n.
 *
 * n8n re-checks the gate before it actually sends (`/api/scheduling/booking-link`).
 * Two checks is not redundancy: this one avoids creating a row that will never
 * be used, and that one is the contract — policy decisions live in Stellaforce,
 * and n8n asks every time.
 *
 * Runs with the **admin client** throughout: it is called from a Server Action
 * that has a session, but also from a bearer-authed route that does not, and the
 * gate must resolve identically either way.
 */

export const BOOKING_AUTOMATION_KEY = "send_booking_link"

export type BookingRequestOutcome =
  | { kind: "created"; requestId: string; sent: boolean }
  | { kind: "not_applicable"; reason: string }
  | { kind: "skipped_by_policy"; reasonCode: SchedulingReasonCode }
  | { kind: "already_exists"; requestId: string }
  | { kind: "failed"; reasonCode: SchedulingReasonCode }

export async function maybeCreateBookingRequest(input: {
  applicationId: string
  subStageId: string
  candidateId: string
  jobId: string
  clientId: string
  /** Threaded through to the activity events so one stage entry is traceable. */
  correlationId?: string | null
  createdBy?: string | null
}): Promise<BookingRequestOutcome> {
  try {
    return await run(input)
  } catch (err) {
    // A thrown error here would abort a stage move that has already committed.
    console.error("[booking-request] unexpected failure", err)
    return { kind: "failed", reasonCode: "SCHEDULING_CONFIGURATION_INVALID" }
  }
}

async function run(input: {
  applicationId: string
  subStageId: string
  candidateId: string
  jobId: string
  clientId: string
  correlationId?: string | null
  createdBy?: string | null
}): Promise<BookingRequestOutcome> {
  const admin = createAdminClient()
  const scope = {
    client_id: input.clientId,
    candidate_id: input.candidateId,
    job_id: input.jobId,
    application_id: input.applicationId,
    sub_stage_id: input.subStageId,
  }

  // ── 1. Applicability. Silent when it doesn't apply. ───────────────────────
  const stage = await resolveStageSchedulingConfig(admin, input.subStageId)
  if (stage.kind === "not_applicable") {
    return { kind: "not_applicable", reason: stage.reason }
  }
  if (stage.kind === "invalid") {
    // This one IS worth telling someone about: the stage says it self-schedules
    // and then can't. Silence would leave a candidate waiting for a link that
    // was never coming.
    await logSchedulingFailure(admin, {
      reasonCode: "SCHEDULING_CONFIGURATION_INVALID",
      scope,
      automationKey: BOOKING_AUTOMATION_KEY,
      detail: { setting_key: stage.settingKey, setting_value: stage.value },
      correlationId: input.correlationId,
    })
    return { kind: "failed", reasonCode: "SCHEDULING_CONFIGURATION_INVALID" }
  }
  const config = stage.config

  // ── 2. The gate. ──────────────────────────────────────────────────────────
  const { data: job } = await admin
    .from("job_orders")
    .select("workflow_template_id")
    .eq("job_id", input.jobId)
    .maybeSingle()

  const automation = await resolveAutomationWithClient(admin, BOOKING_AUTOMATION_KEY, {
    companyId: input.clientId,
    flowId: job?.workflow_template_id ?? null,
    jobId: input.jobId,
  })

  if (!automation || !automation.isApplicable) {
    return { kind: "not_applicable", reason: "automation_not_published" }
  }

  if (automation.effectiveState !== "active" || automation.isLocked) {
    const reasonCode: SchedulingReasonCode = automation.isLocked
      ? "AUTOMATION_LOCKED"
      : automation.effectiveState === "paused"
        ? "AUTOMATION_PAUSED_FOR_JOB"
        : "AUTOMATION_OFF_BY_POLICY"

    await logAutomationSkipped(admin, {
      automationKey: BOOKING_AUTOMATION_KEY,
      reasonCode,
      effectiveState: automation.effectiveState,
      sourceScope: automation.stateSource.scope,
      sourceLabel: automation.stateSource.label,
      scope,
      correlationId: input.correlationId,
      systemSource: "app:booking",
    })
    return { kind: "skipped_by_policy", reasonCode }
  }

  // ── 3. Create the request. ────────────────────────────────────────────────
  const token = mintBookingToken()
  const expiresAt = new Date(Date.now() + config.linkExpiryHours * 3_600_000).toISOString()

  const { data: created, error } = await admin
    .from("interview_scheduling_requests")
    .insert({
      application_id: input.applicationId,
      sub_stage_id: input.subStageId,
      client_id: input.clientId,
      candidate_id: input.candidateId,
      job_id: input.jobId,
      agent_id: config.agentId,
      status: "pending",
      token_hash: token.tokenHash,
      token_expires_at: expiresAt,
      slot_minutes: config.slotMinutes,
      slot_granularity_minutes: config.slotGranularityMinutes,
      minimum_notice_minutes: config.minimumNoticeMinutes,
      booking_horizon_days: config.bookingHorizonDays,
      hold_seconds: config.holdSeconds,
      allow_start_now: config.allowStartNow,
      agent_concurrency_limit: config.agentConcurrencyLimit,
      operating_timezone: config.operatingTimezone,
      operating_start_hour: config.operatingStartHour,
      operating_end_hour: config.operatingEndHour,
      operating_days: config.operatingDays,
      created_by: input.createdBy ?? null,
    })
    .select("id")
    .single()

  if (error) {
    // 23505 on the partial unique means a live request already exists for this
    // (application, sub_stage) — a redelivered or double-fired stage entry. That
    // is the constraint doing its job, not a failure: the candidate already has
    // a link and must not get a second one.
    if (error.code === "23505") {
      const { data: existing } = await admin
        .from("interview_scheduling_requests")
        .select("id")
        .eq("application_id", input.applicationId)
        .eq("sub_stage_id", input.subStageId)
        .in("status", ["pending", "sent"])
        .maybeSingle()
      return { kind: "already_exists", requestId: existing?.id ?? "" }
    }
    console.error("[booking-request] insert failed", error)
    return { kind: "failed", reasonCode: "SCHEDULING_CONFIGURATION_INVALID" }
  }

  // ── 4. Hand the link to n8n. ──────────────────────────────────────────────
  const sent = await notifyBookingLink({
    requestId: created.id,
    bookingUrl: token.url,
    expiresAt,
    scope,
    stageName: config.stageName,
    jobTitle: config.jobTitle,
  })

  if (sent) {
    await admin
      .from("interview_scheduling_requests")
      .update({ status: "sent", dispatched_to_n8n_at: new Date().toISOString() })
      .eq("id", created.id)

    await logActivity(admin, {
      event_type: "booking_link_sent",
      ...scope,
      actor_type: "system",
      system_source: "app:booking",
      severity: "info",
      payload: {
        scheduling_request_id: created.id,
        expires_at: expiresAt,
        stage_name: config.stageName,
        correlation_id: input.correlationId ?? null,
        // The URL itself is deliberately NOT logged: activity_events is read by
        // every recruiter on the account, and the token in it is a capability.
      },
      idempotency_key: `booking_link_sent:${created.id}`,
    })
  } else {
    await logSchedulingFailure(admin, {
      reasonCode: "AGENT_CALL_START_FAILED",
      scope,
      automationKey: BOOKING_AUTOMATION_KEY,
      schedulingRequestId: created.id,
      detail: { stage: "booking_link_dispatch" },
      correlationId: input.correlationId,
    })
  }

  return { kind: "created", requestId: created.id, sent }
}

/**
 * POST the link to n8n, which owns the email.
 *
 * Never throws, following `sendCalendarConnectInvite`. A `false` leaves the
 * request `pending` — the sweeper will expire it and tell someone, which is a
 * better outcome than a row that claims it sent something it didn't.
 */
async function notifyBookingLink(input: {
  requestId: string
  bookingUrl: string
  expiresAt: string
  scope: {
    client_id: string
    candidate_id: string
    job_id: string
    application_id: string
    sub_stage_id?: string | null
  }
  stageName: string
  jobTitle: string
}): Promise<boolean> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15_000)
  try {
    const res = await fetch(serverEnv.n8nBookingLinkWebhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serverEnv.n8nWebhookSecret}`,
      },
      body: JSON.stringify({
        scheduling_request_id: input.requestId,
        booking_url: input.bookingUrl,
        expires_at: input.expiresAt,
        application_id: input.scope.application_id,
        candidate_id: input.scope.candidate_id,
        job_id: input.scope.job_id,
        client_id: input.scope.client_id,
        sub_stage_id: input.scope.sub_stage_id,
        stage_name: input.stageName,
        job_title: input.jobTitle,
        automation_key: BOOKING_AUTOMATION_KEY,
      }),
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout))
    return res.ok
  } catch (err) {
    console.error("[booking-request] n8n dispatch failed", err)
    return false
  }
}
