import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"

import { createAdminClient } from "@/lib/supabase/admin"
import { isN8nAuthorized } from "@/lib/server/n8n-auth"
import { resolveAutomationWithClient } from "@/lib/automation-settings"
import { logAutomationSkipped } from "@/lib/server/activity"
import { BOOKING_AUTOMATION_KEY } from "@/lib/server/booking-request"
import type { SchedulingReasonCode } from "@/lib/scheduling-reason-codes"

export const runtime = "nodejs"

/**
 * The automation gate, for n8n.
 *
 * n8n calls this immediately before it emails a booking link and gets one
 * answer: send, or don't. **Policy lives in Stellaforce and n8n asks every
 * time** — the inheritance cascade must never be reimplemented in a workflow
 * node, because then there would be two answers to "is this on for this job?"
 * and no way to tell which one a recruiter changed.
 *
 * The app already checked the same gate before creating the request
 * (`maybeCreateBookingRequest`). That is not redundant: the first check avoids
 * writing a row that will never be used, and this one is the contract. A
 * recruiter pausing the automation in the seconds between the two is exactly the
 * race this closes, and the skip event is idempotent, so both checks firing
 * writes one row.
 *
 * Deliberately returns **no configuration, no token and no candidate PII** —
 * only the decision, the effective state, and where it was decided.
 */

const BodySchema = z.object({
  scheduling_request_id: z.string().uuid(),
  correlation_id: z.string().optional().nullable(),
})

type GateResponse = {
  allowed: boolean
  reason: SchedulingReasonCode | "active"
  automation: {
    key: string
    effective_state: string
    state_source: { scope: string; label: string }
    is_locked: boolean
    is_blocked: boolean
  }
  context: {
    scheduling_request_id: string
    client_id: string
    job_id: string
    application_id: string
    candidate_id: string
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!isN8nAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 })
  }

  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Validation failed", issues: parsed.error.issues },
      { status: 422 }
    )
  }

  const admin = createAdminClient()

  // Every id comes from the request row, never from the caller. n8n supplies one
  // opaque identifier and the tenant is derived from it, so a workflow node with
  // a stale or wrong id cannot address another customer's job.
  const { data: request } = await admin
    .from("interview_scheduling_requests")
    .select("id, client_id, job_id, application_id, candidate_id, sub_stage_id, status")
    .eq("id", parsed.data.scheduling_request_id)
    .maybeSingle()

  if (!request) {
    return NextResponse.json({ ok: false, error: "Unknown scheduling request" }, { status: 404 })
  }

  const scope = {
    client_id: request.client_id,
    candidate_id: request.candidate_id,
    job_id: request.job_id,
    application_id: request.application_id,
    sub_stage_id: request.sub_stage_id,
  }

  const { data: job } = await admin
    .from("job_orders")
    .select("workflow_template_id")
    .eq("job_id", request.job_id)
    .maybeSingle()

  // The admin client is required here: with no session, RLS would hide every
  // definition and the resolver would report `off` for everything.
  const automation = await resolveAutomationWithClient(admin, BOOKING_AUTOMATION_KEY, {
    companyId: request.client_id,
    flowId: job?.workflow_template_id ?? null,
    jobId: request.job_id,
  })

  if (!automation) {
    return NextResponse.json({ ok: false, error: "Automation not found" }, { status: 404 })
  }

  const allowed =
    automation.effectiveState === "active" && !automation.isLocked && automation.isApplicable

  const reason: GateResponse["reason"] = allowed
    ? "active"
    : automation.isLocked
      ? "AUTOMATION_LOCKED"
      : automation.effectiveState === "paused"
        ? "AUTOMATION_PAUSED_FOR_JOB"
        : "AUTOMATION_OFF_BY_POLICY"

  if (!allowed) {
    // n8n exits successfully after this — a skip is not an error. The event is
    // written here rather than by n8n so the timeline is the app's, and so a
    // workflow that forgets to report still leaves a record.
    await logAutomationSkipped(admin, {
      automationKey: BOOKING_AUTOMATION_KEY,
      reasonCode: reason as SchedulingReasonCode,
      effectiveState: automation.effectiveState,
      sourceScope: automation.stateSource.scope,
      sourceLabel: automation.stateSource.label,
      scope,
      correlationId: parsed.data.correlation_id ?? null,
      systemSource: "n8n:booking_link_send",
    })

    // The link must not go out. Marking the request failed is what the sweeper
    // and the recruiter's Interviews panel read.
    await admin
      .from("interview_scheduling_requests")
      .update({ status: "canceled", failure_reason_code: reason })
      .eq("id", request.id)
      .in("status", ["pending", "sent"])
  }

  const response: GateResponse = {
    allowed,
    reason,
    automation: {
      key: automation.key,
      effective_state: automation.effectiveState,
      state_source: {
        scope: automation.stateSource.scope,
        label: automation.stateSource.label,
      },
      is_locked: automation.isLocked,
      is_blocked: automation.isBlocked,
    },
    context: {
      scheduling_request_id: request.id,
      client_id: request.client_id,
      job_id: request.job_id,
      application_id: request.application_id,
      candidate_id: request.candidate_id,
    },
  }

  return NextResponse.json({ ok: true, ...response }, { status: 200 })
}
