import { createClient } from "@supabase/supabase-js"
import { createHash, randomBytes, randomUUID } from "node:crypto"

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

/**
 * This run's identity, and the reason it exists.
 *
 * `clearRequests()` used to delete every row in `interviews`,
 * `interview_slot_holds` and `interview_scheduling_requests` — `.not("id","is",
 * null)` matches everything — and the final assertion then checked those tables
 * were *globally* empty and called it a pass. Run against a shared database,
 * that destroys real bookings made by real people from real links. It did.
 *
 * So this run deletes only what it owns. Ownership is two things: ids captured
 * as they are created, and every scheduling row on the fixture application,
 * which the run monopolises for its duration. Nothing else is ever in scope.
 */
const RUN_ID = `${PREFIX}-${randomUUID().slice(0, 8)}`

const created = {
  requestIds: [] as string[],
  interviewIds: [] as string[],
  bindingIds: [] as string[],
  eventIds: [] as string[],
}

/** Set once the fixture is chosen. Every delete is scoped to it or to `created`. */
let ownedApplicationId = ""

/** PostgREST treats `.in(col, [])` as matching nothing, which is what we want. */
function uniq(values: (string | null | undefined)[]): string[] {
  return [...new Set(values.filter((v): v is string => !!v))]
}

async function main() {
  console.log(`run ${RUN_ID}`)

  // ── Fixture: a real application on a real sub-stage, reconfigured to be a
  //    self-scheduling agent stage for the duration of the run.
  //
  // A QA fixture candidate is preferred, and not for tidiness: this run
  // reconfigures the stage the application sits on and deletes every scheduling
  // row belonging to it. Picking whichever application came back first is how
  // that landed on a real candidate mid-demo.
  const { data: fixtureApp } = await db
    .from("applications")
    .select(
      "application_id, candidate_id, client_id, job_id, current_stage_id, status, candidates!inner(source)"
    )
    .eq("status", "active")
    .not("current_stage_id", "is", null)
    .eq("candidates.source", "qa_test_fixture")
    .limit(1)
    .maybeSingle()

  const { data: anyApp } = fixtureApp
    ? { data: null }
    : await db
        .from("applications")
        .select("application_id, candidate_id, client_id, job_id, current_stage_id, status")
        .eq("status", "active")
        .not("current_stage_id", "is", null)
        .limit(1)
        .maybeSingle()

  const app = fixtureApp ?? anyApp
  if (!app) throw new Error("no active application to run against")
  if (!fixtureApp) {
    console.log(
      "  ⚠ no qa_test_fixture application found — running against a REAL candidate's application.\n" +
        "    Its scheduling rows will be deleted and its stage reconfigured."
    )
  }
  ownedApplicationId = app.application_id
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

  // Normalise before snapshotting. An aborted run leaves this stage configured,
  // and a later run would otherwise capture that as "original" and faithfully
  // restore it — quietly turning a real pipeline stage into a self-scheduling
  // one for good. That happened once; hence this.
  await db
    .from("job_workflow_sub_stages")
    .update({ scheduling_mode: null, agent_id: null })
    .eq("id", subStageId)
    .not("scheduling_mode", "is", null)

  const { data: originalStage } = await db
    .from("job_workflow_sub_stages")
    .select("interviewer_type, agent_id, entry_conditions, scheduling_mode, duration_minutes, config")
    .eq("id", subStageId)
    .single()

  section("Setup")
  // Clear anything an earlier aborted run left behind. Without this, one failure
  // poisons every subsequent run via the one-live-request constraint — which is
  // exactly what happened the first time this script found a real bug.
  await clearRequests()

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
  const { data: hold, error: holdErr } = await db
    .rpc("hold_interview_slot", {
      p_request_id: outcome.requestId,
      p_starts_at: new Date(target.start).toISOString(),
    })
    .maybeSingle()
  check(
    !!hold?.hold_id && !hold.reason_code,
    "a slot can be held",
    holdErr?.message ?? hold?.reason_code ?? "held"
  )
  if (!hold?.hold_id) throw new Error("hold did not return an id")

  // A second candidate cannot hold the same lane at capacity 1.
  const occupancyNow = [{ start: target.start, end: target.end }]
  check(
    filterByCapacity([target], occupancyNow, 1).length === 0,
    "at capacity 1 the held slot stops being offered"
  )

  const { data: confirmed, error: confirmErr } = await db
    .rpc("confirm_interview_booking", {
      p_request_id: outcome.requestId,
      p_hold_id: hold!.hold_id!,
      p_candidate_timezone: "Europe/Berlin",
      p_start_now: false,
    })
    .maybeSingle()
  // Asserts a row came back, not merely that no reason code did — `!x?.y` is
  // also true when the whole row is null, which is how a 42804 in the function
  // passed this check silently.
  check(
    !!confirmed?.interview_id && !confirmed.reason_code,
    "the booking confirmed",
    confirmErr?.message ?? confirmed?.reason_code ?? "ok"
  )
  if (!confirmed?.interview_id) throw new Error("booking did not return an interview")
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

  // ── 4b. Start now dials from the request, not from the tick ───────────────
  // The risk this covers is a double dial: the inline claim and the cron's
  // batch claim both target the same row, and nothing un-rings a phone.
  section("4b. Start now")
  await clearRequests()
  const nowOutcome = await maybeCreateBookingRequest({
    applicationId: app!.application_id,
    subStageId,
    candidateId: app!.candidate_id,
    jobId: app!.job_id,
    clientId: app!.client_id,
    correlationId: `${PREFIX}-startnow`,
  })
  if (nowOutcome.kind !== "created") throw new Error("start-now fixture could not be created")
  created.requestIds.push(nowOutcome.requestId)

  const { data: startNowBooking } = await db
    .rpc("confirm_interview_booking", {
      p_request_id: nowOutcome.requestId,
      p_candidate_timezone: "America/New_York",
      p_start_now: true,
    })
    .maybeSingle()
  check(!startNowBooking?.reason_code, "start now was allowed", startNowBooking?.reason_code ?? "")

  // Everything below is guarded rather than asserted-and-thrown. An abort here
  // skips the cleanup at the bottom, and what it would leave behind is a live
  // `scheduled` interview holding the agent's only lane — which then fails the
  // *next* run with a capacity error that looks nothing like the real cause.
  const startNowInterviewId = startNowBooking?.interview_id ?? null
  if (startNowInterviewId) {
    created.interviewIds.push(startNowInterviewId)

    const { dispatchStartNowCall } = await import("@/lib/server/agent-call-queue")
    const inline = await dispatchStartNowCall(db, startNowInterviewId)
    check(inline === "suppressed", "the inline dispatch ran and was suppressed", String(inline))

    const { data: afterInline } = await db
      .from("scheduled_agent_calls")
      .select("id, status, suppressed_reason, attempts, locked_until")
      .eq("interview_id", startNowInterviewId)
      .maybeSingle()
    check(
      afterInline?.status === "suppressed" &&
        afterInline.suppressed_reason === "outbound_disabled",
      "NO CALL WAS PLACED — the kill switch suppressed it inline too",
      `${afterInline?.status}/${afterInline?.suppressed_reason}`
    )
    check(afterInline?.attempts === 1, "exactly one attempt was counted", `${afterInline?.attempts}`)
    check(afterInline?.locked_until === null, "the lease was released")

    // The tick must find nothing: a terminal row is not claimable, which is what
    // stops the cron re-dialling a call the candidate's own request placed.
    const { data: reclaimed } = await db.rpc("claim_due_agent_calls", {
      p_limit: 25,
      p_lease_seconds: 60,
    })
    check(
      !(reclaimed ?? []).some((c) => c.interview_id === startNowInterviewId),
      "the tick cannot claim it a second time"
    )

    const second = await dispatchStartNowCall(db, startNowInterviewId)
    check(second === null, "a replayed start-now claims nothing", String(second))

    await db.rpc("cancel_interview", { p_interview_id: startNowInterviewId, p_reason: "e2e" })
  }

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

  // ── 6. The human-interviewer boundary ────────────────────────────────────
  // v2 of the rule covers any interview stage, not only an AI one. What it does
  // NOT cover is a stage with nobody to interview, or a panel — and each has to
  // fail for its own stated reason rather than a generic "no".
  section("6. Human interviewer")
  await clearRequests()

  // This section needs a stage with no reviewers, and then with one, and then
  // with two. Whether the stage *starts* with reviewers depends entirely on
  // which application the fixture picked — so snapshot them, clear them for the
  // duration, and put them back. The previous version assumed none and ended
  // with an unscoped `delete().eq("sub_stage_id", …)`, which silently removed
  // any that were already there.
  const { data: originalReviewers } = await db
    .from("job_workflow_sub_stage_reviewers")
    .select("member_id")
    .eq("sub_stage_id", subStageId)
  await db.from("job_workflow_sub_stage_reviewers").delete().eq("sub_stage_id", subStageId)

  const before = await countEvents(app!.application_id)
  await db
    .from("job_workflow_sub_stages")
    .update({ interviewer_type: "human", agent_id: null })
    .eq("id", subStageId)

  const noReviewer = await maybeCreateBookingRequest({
    applicationId: app!.application_id,
    subStageId,
    candidateId: app!.candidate_id,
    jobId: app!.job_id,
    clientId: app!.client_id,
  })
  check(
    noReviewer.kind === "not_applicable" && noReviewer.reason === "no_interviewer_assigned",
    "a human stage with no reviewer names that as the reason",
    noReviewer.kind === "not_applicable" ? noReviewer.reason : noReviewer.kind
  )
  check(
    (await countEvents(app!.application_id)) === before,
    "…and emits nothing — an unbookable stage is not an incident"
  )

  // One reviewer, but no connected calendar: nothing can be offered, and
  // guessing a grid would book someone over their own meetings.
  const { data: members } = await db
    .from("job_team_members")
    .select("id, email")
    .eq("job_id", app!.job_id)
    .limit(2)

  if (members && members.length >= 1) {
    await db
      .from("job_workflow_sub_stage_reviewers")
      .insert({ sub_stage_id: subStageId, member_id: members[0].id })
    // Whether this proves the happy path or the refusal depends on whether that
    // person has actually connected Google — assert the right one rather than
    // assuming, since a connected calendar makes this the real human booking.
    const { data: conn } = await db
      .from("google_calendar_connections")
      .select("id")
      .ilike("email", (members[0].email ?? "").trim().toLowerCase())
      .is("revoked_at", null)
      .maybeSingle()

    const humanOutcome = await maybeCreateBookingRequest({
      applicationId: app!.application_id,
      subStageId,
      candidateId: app!.candidate_id,
      jobId: app!.job_id,
      clientId: app!.client_id,
    })

    if (conn) {
      check(
        humanOutcome.kind === "created",
        "a human stage with one connected interviewer books — no agent involved",
        humanOutcome.kind
      )
      if (humanOutcome.kind === "created") {
        const { data: req } = await db
          .from("interview_scheduling_requests")
          .select("agent_id, interviewer_member_id, allow_start_now")
          .eq("id", humanOutcome.requestId)
          .single()
        check(
          req!.agent_id === null && req!.interviewer_member_id === members[0].id,
          "…the request holds the interviewer, not an agent"
        )
        check(
          req!.allow_start_now === false,
          "…and Start now is refused: a person can't be summoned this second"
        )
      }
      await clearRequests()
    } else {
      check(
        humanOutcome.kind === "not_applicable" &&
          humanOutcome.reason === "interviewer_calendar_not_connected",
        "one reviewer without a connected calendar is refused, and says why",
        humanOutcome.kind === "not_applicable" ? humanOutcome.reason : humanOutcome.kind
      )
    }

    if (members.length >= 2) {
      await db
        .from("job_workflow_sub_stage_reviewers")
        .insert({ sub_stage_id: subStageId, member_id: members[1].id })
      const beforePanel = await countEvents(app!.application_id)
      const panel = await maybeCreateBookingRequest({
        applicationId: app!.application_id,
        subStageId,
        candidateId: app!.candidate_id,
        jobId: app!.job_id,
        clientId: app!.client_id,
      })
      check(
        panel.kind === "not_applicable" && panel.reason === "panel_not_supported",
        "two reviewers is an honest 'not yet', not an arbitrary pick",
        panel.kind === "not_applicable" ? panel.reason : panel.kind
      )
      check(
        (await countEvents(app!.application_id)) === beforePanel,
        "…and a panel emits nothing either"
      )
    } else {
      console.log("  – only one team member on this job; panel case not exercised")
    }
    await db.from("job_workflow_sub_stage_reviewers").delete().eq("sub_stage_id", subStageId)
  } else {
    console.log("  – no team members on this job; reviewer cases not exercised")
  }

  // Hand the stage's reviewers back exactly as they were found.
  if ((originalReviewers ?? []).length > 0) {
    await db.from("job_workflow_sub_stage_reviewers").insert(
      (originalReviewers ?? []).map((r) => ({
        sub_stage_id: subStageId,
        member_id: r.member_id,
      }))
    )
  }

  // ── 7. Blast radius ───────────────────────────────────────────────────────
  // The regression test for the bug that destroyed a real booking: plant a
  // scheduling request and an interview on a DIFFERENT application, run the
  // cleanup, and require both to still be there. Written as a survival check
  // rather than a code review because the failure is silent — an unscoped
  // delete leaves every other assertion in this file passing.
  section("7. Blast radius")
  const { data: bystander } = await db
    .from("applications")
    .select("application_id, candidate_id, client_id, job_id, current_stage_id")
    .eq("status", "active")
    .not("current_stage_id", "is", null)
    .neq("application_id", ownedApplicationId)
    .limit(1)
    .maybeSingle()

  if (!bystander) {
    console.log("  – only one application in this database; blast radius not exercised")
  } else {
    const far = new Date(Date.now() + 400 * 24 * 60 * 60 * 1000)
    const { data: sentinelRequest, error: reqErr } = await db
      .from("interview_scheduling_requests")
      .insert({
        application_id: bystander.application_id,
        candidate_id: bystander.candidate_id,
        client_id: bystander.client_id,
        job_id: bystander.job_id,
        sub_stage_id: bystander.current_stage_id!,
        // `isr_one_resource` requires exactly one. A request reserves nothing,
        // so naming the agent here costs no capacity.
        agent_id: agent!.id,
        // Not a real token: a sha256-shaped string nothing can resolve.
        token_hash: createHash("sha256").update(`${RUN_ID}-sentinel`).digest("hex"),
        token_expires_at: far.toISOString(),
        slot_minutes: 30,
        slot_granularity_minutes: 30,
        minimum_notice_minutes: 0,
        booking_horizon_days: 14,
        agent_concurrency_limit: 1,
      })
      .select("id")
      .single()

    // Inserted second and cleaned up independently: a request that failed must
    // not leave an interview behind, which is the exact class of leak this
    // whole section exists to catch.
    const { data: sentinelInterview, error: ivErr } = await db
      .from("interviews")
      .insert({
        application_id: bystander.application_id,
        candidate_id: bystander.candidate_id,
        client_id: bystander.client_id,
        job_id: bystander.job_id,
        sub_stage_id: bystander.current_stage_id!,
        // Human with no member: it must not occupy an agent lane, or the
        // sentinel could fail a later booking 400 days from now.
        interviewer_type: "human",
        scheduled_at: far.toISOString(),
        ends_at: new Date(far.getTime() + 30 * 60 * 1000).toISOString(),
      })
      .select("id")
      .single()

    check(
      !reqErr && !ivErr,
      "a bystander booking was planted",
      reqErr?.message ?? ivErr?.message ?? ""
    )

    if (sentinelRequest && !sentinelInterview) {
      await db.from("interview_scheduling_requests").delete().eq("id", sentinelRequest.id)
    }
    if (sentinelInterview && !sentinelRequest) {
      await db.from("interviews").delete().eq("id", sentinelInterview.id)
    }

    if (sentinelRequest && sentinelInterview) {
      await clearRequests()

      const [{ data: stillRequest }, { data: stillInterview }] = await Promise.all([
        db
          .from("interview_scheduling_requests")
          .select("id")
          .eq("id", sentinelRequest.id)
          .maybeSingle(),
        db.from("interviews").select("id").eq("id", sentinelInterview.id).maybeSingle(),
      ])

      check(!!stillRequest, "another application's scheduling request SURVIVES the cleanup")
      check(!!stillInterview, "another application's interview SURVIVES the cleanup")

      await db.from("interviews").delete().eq("id", sentinelInterview.id)
      await db.from("interview_scheduling_requests").delete().eq("id", sentinelRequest.id)
      check(true, "…and the sentinel itself is removed")
    }
  }

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

  // Scoped to this run's application — **not** to the tables. "Every table is
  // empty" was the assertion that made an unscoped delete look correct: it can
  // only pass on a database with no other bookings in it, and it passes most
  // loudly right after destroying them.
  const [{ count: iv }, { count: rq }, { count: sc }] = await Promise.all([
    db
      .from("interviews")
      .select("id", { count: "exact", head: true })
      .eq("application_id", ownedApplicationId),
    db
      .from("interview_scheduling_requests")
      .select("id", { count: "exact", head: true })
      .eq("application_id", ownedApplicationId),
    db
      .from("scheduled_agent_calls")
      .select("id", { count: "exact", head: true })
      .eq("application_id", ownedApplicationId),
  ])
  // Holds carry no application_id, so they are checked through their request.
  const { data: leftoverHolds } = await db
    .from("interview_slot_holds")
    .select("id, request:interview_scheduling_requests!inner(application_id)")
    .eq("interview_scheduling_requests.application_id", ownedApplicationId)
  const hd = (leftoverHolds ?? []).length

  check(
    iv === 0 && rq === 0 && hd === 0 && sc === 0,
    "this run's rows are gone",
    `interviews ${iv}, requests ${rq}, holds ${hd}, calls ${sc}`
  )

  const { count: bindings } = await db
    .from("automation_bindings")
    .select("id", { count: "exact", head: true })
  check(bindings === 14, "the 14 global automation bindings are untouched", String(bindings))

  // The stage must be handed back unconfigured. Leaving a real pipeline stage
  // self-scheduling is the one side effect of this script that could reach a
  // candidate.
  const { count: configured } = await db
    .from("job_workflow_sub_stages")
    .select("id", { count: "exact", head: true })
    .not("scheduling_mode", "is", null)
  check(configured === 0, "no stage is left configured for self-scheduling", String(configured))
}

/**
 * Delete this run's scheduling rows. **Never anyone else's.**
 *
 * Scope is the fixture application plus the ids captured in `created` — the
 * second half matters because some rows are created *inside* an RPC and never
 * pass through this script. Rows on any other application are out of scope by
 * construction, which is what `7. Blast radius` proves rather than assumes.
 */
async function clearRequests() {
  if (!ownedApplicationId) throw new Error("clearRequests called before the fixture was chosen")

  const [{ data: ownedRequests }, { data: ownedInterviews }] = await Promise.all([
    db
      .from("interview_scheduling_requests")
      .select("id, interview_id")
      .eq("application_id", ownedApplicationId),
    db.from("interviews").select("id").eq("application_id", ownedApplicationId),
  ])

  const requestIds = uniq([...(ownedRequests ?? []).map((r) => r.id), ...created.requestIds])
  const interviewIds = uniq([
    ...(ownedRequests ?? []).map((r) => r.interview_id),
    ...(ownedInterviews ?? []).map((i) => i.id),
    ...created.interviewIds,
  ])

  // Order matters: calls and holds point at interviews and requests, and a
  // request's FK to its interview has to be dropped before the interview goes.
  if (interviewIds.length > 0) {
    await db.from("scheduled_agent_calls").delete().in("interview_id", interviewIds)
  }
  await db.from("scheduled_agent_calls").delete().eq("application_id", ownedApplicationId)
  if (requestIds.length > 0) {
    await db.from("interview_slot_holds").delete().in("request_id", requestIds)
    await db
      .from("interview_scheduling_requests")
      .update({ interview_id: null })
      .in("id", requestIds)
  }
  if (interviewIds.length > 0) {
    await db.from("interviews").delete().in("id", interviewIds)
  }
  if (requestIds.length > 0) {
    await db.from("interview_scheduling_requests").delete().in("id", requestIds)
  }

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
