import { createClient } from "@supabase/supabase-js"
import { createHash, randomBytes } from "node:crypto"

import type { Database } from "@/lib/supabase/types"

/**
 * The whole scheduling loop against the real database, with **no phone calls**.
 *
 * Walks: stage config → the gate → a scheduling request + token → resolve the
 * token → hold a slot → confirm → the queued call → the dispatch tick → the
 * suppression that stops a real dial. Then the gate proofs: paused at job scope,
 * off at workflow scope, and a job override turning an inherited Off back on.
 *
 * Everything it creates is removed at the end, and it asserts the tables are
 * back where it found them. Run with:
 *
 *     npx tsx --env-file=.env.local scripts/scheduling-e2e.ts
 *
 * It sets no environment of its own: with `SCHEDULING_OUTBOUND_ENABLED` unset
 * (the default) the dispatch step must report `suppressed`, and that assertion
 * is the point of the whole script.
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
const db = createClient<Database>(url, key)

let failures = 0
function check(ok: boolean, label: string, detail = "") {
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`)
  if (!ok) failures++
}
function section(name: string) {
  console.log(`\n${name}`)
}

const PREFIX = "ZZ-e2e"
const created = {
  requestIds: [] as string[],
  interviewIds: [] as string[],
  bindingIds: [] as string[],
  eventIds: [] as string[],
}

async function main() {
  // ── Fixture: a real application on a real sub-stage, reconfigured to be a
  //    self-scheduling agent stage for the duration of the run.
  const { data: app } = await db
    .from("applications")
    .select("application_id, candidate_id, client_id, job_id, current_stage_id, status")
    .eq("status", "active")
    .not("current_stage_id", "is", null)
    .limit(1)
    .single()
  // Must be an ACTIVE agent — an inactive one is correctly refused, which is
  // how this script found the `agent_inactive` case in the first place.
  const { data: agent } = await db
    .from("agents")
    .select("id, name")
    .eq("status", "active")
    .limit(1)
    .single()
  const { data: job } = await db
    .from("job_orders")
    .select("job_id, workflow_template_id")
    .eq("job_id", app!.job_id)
    .single()
  const { data: def } = await db
    .from("automation_definitions")
    .select("id")
    .eq("key", "send_booking_link")
    .single()

  const subStageId = app!.current_stage_id!
  const { data: originalStage } = await db
    .from("job_workflow_sub_stages")
    .select("interviewer_type, agent_id, entry_conditions, scheduling_mode, duration_minutes, config")
    .eq("id", subStageId)
    .single()

  section("Setup")
  await db
    .from("job_workflow_sub_stages")
    .update({
      interviewer_type: "ai",
      agent_id: agent!.id,
      entry_conditions: ["automatic", "manual"],
      scheduling_mode: "candidate_self_scheduling",
      duration_minutes: 30,
      config: {
        scheduling: {
          enabled: true,
          settings: {
            minimum_booking_notice: "no_minimum",
            booking_horizon: "14_days",
            slot_granularity: "30_minutes",
            slot_hold_duration: "5_minutes",
            allow_start_now: "allowed",
            agent_concurrency: "1",
            operating_hours: "around_the_clock",
            operating_days: "all_days",
            operating_timezone: "us_pacific",
          },
        },
      },
    })
    .eq("id", subStageId)
  check(true, "stage configured as a self-scheduling agent interview")

  // ── 1. The gate allows it, and a request + token appear ───────────────────
  section("1. Booking request")
  const { maybeCreateBookingRequest } = await import("@/lib/server/booking-request")

  // The real trigger path. n8n is not running, so the link dispatch fails and
  // the request stays `pending` — which is the honest outcome and is asserted.
  const outcome = await maybeCreateBookingRequest({
    applicationId: app!.application_id,
    subStageId,
    candidateId: app!.candidate_id,
    jobId: app!.job_id,
    clientId: app!.client_id,
    correlationId: `${PREFIX}-1`,
  })
  check(
    outcome.kind === "created",
    "gate allowed it and a request was created",
    outcome.kind === "not_applicable" ? `not_applicable: ${outcome.reason}` : outcome.kind
  )
  if (outcome.kind !== "created") throw new Error("cannot continue")
  created.requestIds.push(outcome.requestId)

  const { data: request } = await db
    .from("interview_scheduling_requests")
    .select("id, token_hash, status, slot_minutes, agent_concurrency_limit, operating_timezone, allow_start_now, minimum_notice_minutes")
    .eq("id", outcome.requestId)
    .single()
  check(!!request?.token_hash, "a token hash was stored")
  check(request!.slot_minutes === 30, "the stage's duration was snapshotted", `${request!.slot_minutes}m`)
  check(request!.minimum_notice_minutes === 0, "the stage's notice was snapshotted")
  check(request!.operating_timezone === "America/Los_Angeles", "the operating zone resolved from its slug")

  // A second trigger for the same (application, stage) must not create a second link.
  const dup = await maybeCreateBookingRequest({
    applicationId: app!.application_id,
    subStageId,
    candidateId: app!.candidate_id,
    jobId: app!.job_id,
    clientId: app!.client_id,
    correlationId: `${PREFIX}-1`,
  })
  check(dup.kind === "already_exists", "a redelivered stage entry does not send a second link", dup.kind)

  // ── 2. Token resolution ───────────────────────────────────────────────────
  // The raw token is never stored, so the script mints its own and swaps the
  // hash in — which is itself proof the column holds a hash, not the secret.
  section("2. Token")
  const rawToken = randomBytes(32).toString("base64url")
  await db
    .from("interview_scheduling_requests")
    .update({ token_hash: createHash("sha256").update(rawToken).digest("hex"), status: "sent" })
    .eq("id", outcome.requestId)

  const { resolveBookingToken } = await import("@/lib/server/booking-token")
  const resolved = await resolveBookingToken(db, rawToken)
  check(resolved?.id === outcome.requestId, "a valid token resolves to its request")
  check((await resolveBookingToken(db, "not-a-token")) === null, "a malformed token resolves to nothing")
  check(
    (await resolveBookingToken(db, randomBytes(32).toString("base64url"))) === null,
    "a well-formed but unknown token resolves to nothing"
  )

  // ── 3. Slots, hold, confirm ───────────────────────────────────────────────
  section("3. Booking")
  const { agentSlotGrid, filterByCapacity } = await import("@/lib/agent-availability")
  const grid = agentSlotGrid({
    operatingTimezone: resolved!.operating_timezone,
    operatingStartHour: resolved!.operating_start_hour,
    operatingEndHour: resolved!.operating_end_hour,
    operatingDays: resolved!.operating_days,
    slotMinutes: resolved!.slot_minutes,
    slotGranularityMinutes: resolved!.slot_granularity_minutes,
    minimumNoticeMinutes: resolved!.minimum_notice_minutes,
    bookingHorizonDays: resolved!.booking_horizon_days,
  })
  check(grid.length > 0, "slots are offered", `${grid.length}`)

  // Pick something a few hours out so "now" can't drift past it mid-run.
  const target = grid.find((s) => s.start > Date.now() + 3 * 3_600_000) ?? grid[0]
  const { data: hold } = await db
    .rpc("hold_interview_slot", {
      p_request_id: outcome.requestId,
      p_starts_at: new Date(target.start).toISOString(),
    })
    .maybeSingle()
  check(!hold?.reason_code && !!hold?.hold_id, "a slot can be held", hold?.reason_code ?? "held")

  // A second candidate cannot hold the same lane at capacity 1.
  const occupancyNow = [{ start: target.start, end: target.end }]
  check(
    filterByCapacity([target], occupancyNow, 1).length === 0,
    "at capacity 1 the held slot stops being offered"
  )

  const { data: confirmed } = await db
    .rpc("confirm_interview_booking", {
      p_request_id: outcome.requestId,
      p_hold_id: hold!.hold_id!,
      p_candidate_timezone: "Europe/Berlin",
      p_start_now: false,
    })
    .maybeSingle()
  check(!confirmed?.reason_code, "the booking confirmed", confirmed?.reason_code ?? "ok")
  created.interviewIds.push(confirmed!.interview_id!)

  const { data: interview } = await db
    .from("interviews")
    .select("id, status, scheduled_at, candidate_timezone, agent_slot_index, started_now")
    .eq("id", confirmed!.interview_id!)
    .single()
  check(interview!.status === "scheduled", "the interview is scheduled")
  check(interview!.candidate_timezone === "Europe/Berlin", "the candidate's chosen timezone was stored")

  const { count: holdsLeft } = await db
    .from("interview_slot_holds")
    .select("id", { count: "exact", head: true })
    .eq("request_id", outcome.requestId)
  check(holdsLeft === 0, "the hold was consumed by the booking")

  const { data: spent } = await db
    .from("interview_scheduling_requests")
    .select("status, token_expires_at, interview_id")
    .eq("id", outcome.requestId)
    .single()
  check(spent!.status === "booked", "the request is marked booked")
  check(
    new Date(spent!.token_expires_at).getTime() <= Date.now(),
    "the link was spent — the token is now expired"
  )
  check((await resolveBookingToken(db, rawToken))?.status === "booked",
    "the spent token still resolves, so the confirmation page survives a refresh")

  const { data: replay } = await db
    .rpc("confirm_interview_booking", {
      p_request_id: outcome.requestId,
      p_candidate_timezone: "Europe/Berlin",
    })
    .maybeSingle()
  check(
    replay?.reason_code === "CANDIDATE_ALREADY_BOOKED" &&
      replay.interview_id === confirmed!.interview_id,
    "confirming twice returns the same interview instead of double-booking"
  )

  // ── 4. The queued call, and the guard that stops it ───────────────────────
  section("4. Dispatch")
  const { data: queued } = await db
    .from("scheduled_agent_calls")
    .select("id, status, run_at, campaign_id, attempts")
    .eq("interview_id", confirmed!.interview_id!)
    .single()
  check(queued!.status === "pending", "a call was queued in the same transaction")
  check(
    new Date(queued!.run_at).getTime() < new Date(interview!.scheduled_at).getTime(),
    "the call is queued slightly ahead of the slot so spin-up lands on time"
  )

  // Make it due, then run the real claim + dispatch path.
  await db.from("scheduled_agent_calls").update({ run_at: new Date().toISOString() }).eq("id", queued!.id)

  const { dispatchAgentCall } = await import("@/lib/server/agent-call")
  const { data: claimed } = await db.rpc("claim_due_agent_calls", { p_limit: 5, p_lease_seconds: 60 })
  const mine = (claimed ?? []).find((c) => c.call_id === queued!.id)
  check(!!mine, "the dispatcher claimed the due call")

  const dispatch = await dispatchAgentCall(db, {
    callId: mine!.call_id,
    interviewId: mine!.interview_id,
    campaignId: mine!.campaign_id,
    attempt: mine!.attempts,
    applicationId: mine!.application_id,
    candidateId: mine!.candidate_id,
    clientId: mine!.client_id,
    jobId: mine!.job_id,
    subStageId: mine!.sub_stage_id,
    agentId: mine!.agent_id,
    scheduledAt: mine!.scheduled_at,
  })
  check(
    !dispatch.ok && dispatch.kind === "suppressed",
    "NO CALL WAS PLACED — the kill switch suppressed it",
    !dispatch.ok && dispatch.kind === "suppressed" ? dispatch.reason : JSON.stringify(dispatch)
  )
  check(
    !dispatch.ok && dispatch.kind === "suppressed" && dispatch.reason === "outbound_disabled",
    "…and the reason is the kill switch, not an incidental failure"
  )

  // Cancelling must take the queued call with it.
  await db.rpc("cancel_interview", { p_interview_id: confirmed!.interview_id!, p_reason: "e2e" })
  const { data: afterCancel } = await db
    .from("scheduled_agent_calls")
    .select("status")
    .eq("id", queued!.id)
    .single()
  check(afterCancel!.status === "canceled", "cancelling the interview cancelled its queued call")

  // ── 5. Gate proofs ────────────────────────────────────────────────────────
  section("5. The gate")
  await clearRequests()

  // Paused at job scope.
  const { data: jobBinding } = await db
    .from("automation_bindings")
    .insert({
      automation_definition_id: def!.id,
      state: "paused",
      tenant_client_id: app!.client_id,
      job_id: app!.job_id,
    })
    .select("id")
    .single()
  created.bindingIds.push(jobBinding!.id)

  const paused = await maybeCreateBookingRequest({
    applicationId: app!.application_id,
    subStageId,
    candidateId: app!.candidate_id,
    jobId: app!.job_id,
    clientId: app!.client_id,
    correlationId: `${PREFIX}-paused`,
  })
  check(
    paused.kind === "skipped_by_policy" && paused.reasonCode === "AUTOMATION_PAUSED_FOR_JOB",
    "paused at job scope → skipped, with the right reason",
    paused.kind === "skipped_by_policy" ? paused.reasonCode : paused.kind
  )
  const { count: noRows } = await db
    .from("interview_scheduling_requests")
    .select("id", { count: "exact", head: true })
    .eq("application_id", app!.application_id)
    .in("status", ["pending", "sent"])
  check(noRows === 0, "…and no request row was created")

  const { data: skipEvent } = await db
    .from("activity_events")
    .select("id, event_type, severity, payload")
    .eq("event_type", "automation_skipped_by_policy")
    .eq("application_id", app!.application_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  check(skipEvent?.severity === "info", "…the skip is logged at info, not as an alert")
  const payload = skipEvent?.payload as Record<string, unknown> | null
  check(payload?.source_scope === "job", "…and the event names where it was decided", String(payload?.source_scope))
  if (skipEvent) created.eventIds.push(skipEvent.id)

  // Off at workflow scope, if this job runs a template.
  await db.from("automation_bindings").delete().eq("id", jobBinding!.id)
  created.bindingIds = []
  if (job!.workflow_template_id) {
    const { data: flowBinding } = await db
      .from("automation_bindings")
      .insert({
        automation_definition_id: def!.id,
        state: "off",
        workflow_template_id: job!.workflow_template_id,
      })
      .select("id")
      .single()
    created.bindingIds.push(flowBinding!.id)

    const off = await maybeCreateBookingRequest({
      applicationId: app!.application_id,
      subStageId,
      candidateId: app!.candidate_id,
      jobId: app!.job_id,
      clientId: app!.client_id,
      correlationId: `${PREFIX}-off`,
    })
    check(
      off.kind === "skipped_by_policy" && off.reasonCode === "AUTOMATION_OFF_BY_POLICY",
      "off at workflow scope → skipped",
      off.kind === "skipped_by_policy" ? off.reasonCode : off.kind
    )

    // …and a job override turns it back on. This is the case the whole
    // three-state model exists for: `off` is a default, not a lock.
    const { data: jobOn } = await db
      .from("automation_bindings")
      .insert({
        automation_definition_id: def!.id,
        state: "active",
        tenant_client_id: app!.client_id,
        job_id: app!.job_id,
      })
      .select("id")
      .single()
    created.bindingIds.push(jobOn!.id)

    const overridden = await maybeCreateBookingRequest({
      applicationId: app!.application_id,
      subStageId,
      candidateId: app!.candidate_id,
      jobId: app!.job_id,
      clientId: app!.client_id,
      correlationId: `${PREFIX}-override`,
    })
    check(
      overridden.kind === "created",
      "a job override turns an inherited Off back on",
      overridden.kind
    )
    if (overridden.kind === "created") created.requestIds.push(overridden.requestId)
  } else {
    console.log("  – this job runs no workflow template; workflow-scope proof skipped")
  }

  // ── 6. Not-applicable stays silent ────────────────────────────────────────
  section("6. Silence where it belongs")
  const before = await countEvents(app!.application_id)
  await db.from("job_workflow_sub_stages").update({ interviewer_type: "human" }).eq("id", subStageId)
  const human = await maybeCreateBookingRequest({
    applicationId: app!.application_id,
    subStageId,
    candidateId: app!.candidate_id,
    jobId: app!.job_id,
    clientId: app!.client_id,
  })
  check(human.kind === "not_applicable", "a human stage is not applicable", human.kind)
  check(
    (await countEvents(app!.application_id)) === before,
    "…and emits NOTHING — a non-interview stage must not fill the feed with skips"
  )

  // ── Cleanup ───────────────────────────────────────────────────────────────
  section("Cleanup")
  await db.from("job_workflow_sub_stages").update(originalStage!).eq("id", subStageId)
  await clearRequests()
  for (const id of created.bindingIds) await db.from("automation_bindings").delete().eq("id", id)
  await db
    .from("activity_events")
    .delete()
    .in("event_type", [
      "automation_skipped_by_policy",
      "booking_link_sent",
      "booking_link_opened",
      "interview_scheduled",
      "agent_call_dispatched",
      "scheduling_failed",
    ])
    .eq("application_id", app!.application_id)

  const [{ count: iv }, { count: rq }, { count: hd }, { count: sc }] = await Promise.all([
    db.from("interviews").select("id", { count: "exact", head: true }),
    db.from("interview_scheduling_requests").select("id", { count: "exact", head: true }),
    db.from("interview_slot_holds").select("id", { count: "exact", head: true }),
    db.from("scheduled_agent_calls").select("id", { count: "exact", head: true }),
  ])
  check(
    iv === 0 && rq === 0 && hd === 0 && sc === 0,
    "every table is back to empty",
    `interviews ${iv}, requests ${rq}, holds ${hd}, calls ${sc}`
  )

  const { count: bindings } = await db
    .from("automation_bindings")
    .select("id", { count: "exact", head: true })
  check(bindings === 14, "the 14 global automation bindings are untouched", String(bindings))
}

async function clearRequests() {
  const { data: rows } = await db
    .from("interview_scheduling_requests")
    .select("id, interview_id")
  for (const r of rows ?? []) {
    if (r.interview_id) {
      await db.from("scheduled_agent_calls").delete().eq("interview_id", r.interview_id)
    }
  }
  await db.from("interview_slot_holds").delete().not("id", "is", null)
  await db.from("interview_scheduling_requests").update({ interview_id: null }).not("id", "is", null)
  await db.from("interviews").delete().not("id", "is", null)
  await db.from("interview_scheduling_requests").delete().not("id", "is", null)
  created.requestIds = []
  created.interviewIds = []
}

async function countEvents(applicationId: string): Promise<number> {
  const { count } = await db
    .from("activity_events")
    .select("id", { count: "exact", head: true })
    .eq("application_id", applicationId)
  return count ?? 0
}

main()
  .then(() => {
    console.log(failures === 0 ? "\nAll end-to-end checks passed.\n" : `\n${failures} failed.\n`)
    process.exit(failures === 0 ? 0 : 1)
  })
  .catch((err) => {
    console.error("\nE2E aborted:", err)
    process.exit(1)
  })
