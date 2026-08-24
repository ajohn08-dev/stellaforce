"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import { agentSlotGrid, canStartNow, filterByCapacity } from "@/lib/agent-availability"
import { logActivity, logSchedulingFailure } from "@/lib/server/activity"
import { resolveBookingToken, type ResolvedBookingRequest } from "@/lib/server/booking-token"
import { getCalendarPreview } from "@/lib/server/calendar-events"
import {
  candidateMessageFor,
  isBenign,
  isSchedulingReasonCode,
  type SchedulingReasonCode,
} from "@/lib/scheduling-reason-codes"

/**
 * The candidate's side of booking.
 *
 * ⚠️ **Every function here runs with the service-role client.** A candidate has
 * no account, so there is no session and RLS is not there to catch a mistake.
 * Three rules, and they are not optional:
 *
 *   1. **Never `select("*")`.** Explicit column lists only — `candidates` alone
 *      carries email, phone, LinkedIn and an embedding vector.
 *   2. **Never accept an identifier from the client.** Every entry point takes
 *      the raw token and re-resolves it. A `holdId` is only ever used inside a
 *      query that also filters on the resolved request.
 *   3. **Never read another candidate's row.** The one cross-row read this needs
 *      is the agent's occupancy, and it returns instants only — no candidate_id,
 *      no name, no reason a slot is unavailable.
 *
 * Failures collapse to one message on purpose. The difference between "expired"
 * and "never existed" is exactly what confirms to someone guessing that a token
 * existed at all.
 */

export type BookingActionResult =
  | { ok: true }
  | { ok: false; message: string; reasonCode?: SchedulingReasonCode }

export type SlotOption = { start: string; end: string }

export type BookingView = {
  jobTitle: string
  stageName: string
  companyName: string
  candidateFirstName: string
  slotMinutes: number
  allowStartNow: boolean
  canStartNow: boolean
  /** Suggested display zone. The candidate can change it; nothing depends on it. */
  candidateTimezone: string
  operatingTimezone: string
  slots: SlotOption[]
  holdSeconds: number
  /** Set when this link has already been used — the confirmation, not an error. */
  booked: { scheduledAt: string; timezone: string | null } | null
}

/** The single response every failure collapses to. Typed loosely so the
 *  hold and confirm results can both return it without narrowing. */
const GENERIC_FAIL = {
  ok: false as const,
  message: candidateMessageFor(null),
}

/** Everything the booking page renders, or null if the link isn't usable. */
export async function loadBooking(token: string): Promise<BookingView | null> {
  const admin = createAdminClient()
  const request = await resolveBookingToken(admin, token)
  if (!request) return null

  // A spent token still resolves — the confirmation page has to survive a
  // refresh, and `token_expires_at` is set to now() at booking to make the link
  // single-use.
  if (request.status === "booked" && request.interview_id) {
    const { data: interview } = await admin
      .from("interviews")
      .select("scheduled_at, candidate_timezone")
      .eq("id", request.interview_id)
      .maybeSingle()
    const context = await loadContext(admin, request)
    if (!context) return null
    return {
      ...context,
      slots: [],
      canStartNow: false,
      booked: interview
        ? { scheduledAt: interview.scheduled_at, timezone: interview.candidate_timezone }
        : null,
    }
  }

  if (request.status !== "pending" && request.status !== "sent") return null
  if (new Date(request.token_expires_at).getTime() <= Date.now()) return null

  const context = await loadContext(admin, request)
  if (!context) return null

  const occupancy = await loadAgentOccupancy(admin, request)
  const grid = agentSlotGrid({
    operatingTimezone: request.operating_timezone,
    operatingStartHour: request.operating_start_hour,
    operatingEndHour: request.operating_end_hour,
    operatingDays: request.operating_days,
    slotMinutes: request.slot_minutes,
    slotGranularityMinutes: request.slot_granularity_minutes,
    minimumNoticeMinutes: request.minimum_notice_minutes,
    bookingHorizonDays: request.booking_horizon_days,
  })
  const bookable = filterByCapacity(grid, occupancy, request.agent_concurrency_limit)

  return {
    ...context,
    slots: bookable.map((s) => ({
      start: new Date(s.start).toISOString(),
      end: new Date(s.end).toISOString(),
    })),
    canStartNow:
      request.allow_start_now &&
      canStartNow({
        occupancy,
        capacity: request.agent_concurrency_limit,
        slotMinutes: request.slot_minutes,
        operatingTimezone: request.operating_timezone,
        operatingStartHour: request.operating_start_hour,
        operatingEndHour: request.operating_end_hour,
        operatingDays: request.operating_days,
      }),
    booked: null,
  }
}

/** Records that the candidate opened their link. Fire-and-forget. */
export async function markBookingOpened(token: string): Promise<void> {
  const admin = createAdminClient()
  const request = await resolveBookingToken(admin, token)
  if (!request) return

  await logActivity(admin, {
    event_type: "booking_link_opened",
    client_id: request.client_id,
    candidate_id: request.candidate_id,
    job_id: request.job_id,
    application_id: request.application_id,
    sub_stage_id: request.sub_stage_id,
    // The first legitimate use of this actor_type: the candidate really is who
    // did this, and they are not a `user` in the profiles sense.
    actor_type: "candidate",
    severity: "info",
    payload: { scheduling_request_id: request.id },
    // Once per request. A candidate re-reading the email is not news.
    idempotency_key: `booking_link_opened:${request.id}`,
  })
}

export type HoldResult =
  | { ok: true; holdId: string; startsAt: string; expiresAt: string }
  | { ok: false; message: string; reasonCode?: SchedulingReasonCode }

/** Take (or move) this candidate's single lease on a slot. */
export async function holdSlot(token: string, startIso: string): Promise<HoldResult> {
  const admin = createAdminClient()
  const request = await resolveBookingToken(admin, token)
  if (!request) return GENERIC_FAIL

  const { data, error } = await admin
    .rpc("hold_interview_slot", {
      p_request_id: request.id,
      p_starts_at: startIso,
    })
    .maybeSingle()

  if (error || !data) return GENERIC_FAIL

  if (data.reason_code) {
    const code = isSchedulingReasonCode(data.reason_code) ? data.reason_code : null
    return {
      ok: false,
      message: candidateMessageFor(code),
      reasonCode: code ?? undefined,
    }
  }

  return {
    ok: true,
    holdId: data.hold_id!,
    startsAt: data.starts_at!,
    expiresAt: data.expires_at!,
  }
}

/** Give a held slot back, so browsing away doesn't tie up an agent lane. */
export async function releaseHold(token: string): Promise<void> {
  const admin = createAdminClient()
  const request = await resolveBookingToken(admin, token)
  if (!request) return
  await admin.from("interview_slot_holds").delete().eq("request_id", request.id)
}

export type ConfirmResult =
  | { ok: true; scheduledAt: string; startNow: boolean }
  | { ok: false; message: string; reasonCode?: SchedulingReasonCode }

/**
 * Commit the booking.
 *
 * The whole transaction — capacity re-check, interview insert, hold consumption,
 * token expiry, queueing the call — happens inside `confirm_interview_booking`
 * under an advisory lock. Nothing here may add network I/O before it: the lock
 * is per-agent and held for the transaction, so an HTTP call inside would
 * serialise every booking in the system behind a remote server.
 */
export async function confirmBooking(input: {
  token: string
  holdId?: string | null
  timezone: string
  startNow?: boolean
}): Promise<ConfirmResult> {
  const admin = createAdminClient()
  const request = await resolveBookingToken(admin, input.token)
  if (!request) return GENERIC_FAIL

  const scope = {
    client_id: request.client_id,
    candidate_id: request.candidate_id,
    job_id: request.job_id,
    application_id: request.application_id,
    sub_stage_id: request.sub_stage_id,
  }

  const { data, error } = await admin
    .rpc("confirm_interview_booking", {
      p_request_id: request.id,
      p_hold_id: input.holdId ?? undefined,
      p_candidate_timezone: input.timezone,
      p_start_now: input.startNow ?? false,
    })
    .maybeSingle()

  if (error || !data) {
    console.error("[book] confirm failed", error)
    return GENERIC_FAIL
  }

  if (data.reason_code) {
    const code = isSchedulingReasonCode(data.reason_code) ? data.reason_code : null

    // Only a real problem raises an alert. A refresh of the confirmation page
    // and a link that was never valid are both normal traffic, and putting them
    // in a recruiter's Actions list would train people to ignore it.
    if (code && !isBenign(code)) {
      await logSchedulingFailure(admin, {
        reasonCode: code,
        scope,
        schedulingRequestId: request.id,
        agentId: request.agent_id,
        detail: { start_now: input.startNow ?? false },
        idempotencyKey: `scheduling_failed:${code}:${request.id}:${Date.now()}`,
        systemSource: "app:booking",
      })
    }
    return { ok: false, message: candidateMessageFor(code), reasonCode: code ?? undefined }
  }

  await logActivity(admin, {
    event_type: "interview_scheduled",
    ...scope,
    actor_type: "candidate",
    severity: "info",
    payload: {
      interview_id: data.interview_id,
      scheduled_at: data.scheduled_at,
      started_now: input.startNow ?? false,
      candidate_timezone: input.timezone,
    },
    // Exactly once per interview, so a confirm replay writes nothing new. This
    // is why the interview is created by an INSERT rather than a status change.
    idempotency_key: `interview_scheduled:${data.interview_id}`,
  })

  // Start-now still goes through the queue rather than dialling from here. One
  // dispatcher means one set of guards, one retry policy and one place a call
  // can be suppressed — and the tick runs every minute, so "immediately" is
  // within a minute rather than within a request.
  return {
    ok: true,
    // Non-null on success: the RPC only omits it when it also sets a reason code.
    scheduledAt: data.scheduled_at ?? new Date().toISOString(),
    startNow: input.startNow ?? false,
  }
}

// ── Reads ───────────────────────────────────────────────────────────────────

/** Names for the page. Explicit columns; nothing here identifies anyone else. */
async function loadContext(
  admin: ReturnType<typeof createAdminClient>,
  request: ResolvedBookingRequest
): Promise<Omit<BookingView, "slots" | "canStartNow" | "booked"> | null> {
  const [{ data: job }, { data: stage }, { data: candidate }, { data: client }] =
    await Promise.all([
      admin.from("job_orders").select("title").eq("job_id", request.job_id).maybeSingle(),
      admin
        .from("job_workflow_sub_stages")
        .select("name")
        .eq("id", request.sub_stage_id)
        .maybeSingle(),
      admin
        .from("candidates")
        .select("first_name, timezone")
        .eq("candidate_id", request.candidate_id)
        .maybeSingle(),
      admin
        .from("clients")
        .select("client_name")
        .eq("client_id", request.client_id)
        .maybeSingle(),
    ])

  if (!job || !stage) return null

  return {
    jobTitle: job.title,
    stageName: stage.name,
    companyName: client?.client_name ?? "",
    candidateFirstName: candidate?.first_name ?? "",
    slotMinutes: request.slot_minutes,
    allowStartNow: request.allow_start_now,
    // `candidates.timezone` is the only timezone column in the schema and is
    // nullable. The client component overrides this with the browser's zone when
    // it's absent; this is only the server-rendered starting point.
    candidateTimezone:
      request.candidate_timezone ?? candidate?.timezone ?? request.operating_timezone,
    operatingTimezone: request.operating_timezone,
    holdSeconds: request.hold_seconds,
  }
}

/**
 * The agent's committed time over the booking horizon — **instants only**.
 *
 * This is the one query on this page that reads rows belonging to other
 * candidates, so it selects two timestamps and nothing else. Because `agents`
 * has no tenant column the pool is shared across clients, which makes a leak
 * here cross-*tenant*, not merely cross-candidate.
 */
async function loadAgentOccupancy(
  admin: ReturnType<typeof createAdminClient>,
  request: ResolvedBookingRequest
): Promise<{ start: number; end: number }[]> {
  const from = new Date().toISOString()
  const to = new Date(Date.now() + request.booking_horizon_days * 86_400_000).toISOString()
  const isAgent = request.agent_id !== null
  const column = isAgent ? "agent_id" : "interviewer_member_id"
  const resourceId = request.agent_id ?? request.interviewer_member_id!

  // An interviewer is also busy with everything already in their own calendar,
  // which Stellaforce does not store. `getCalendarPreview` reads it live and
  // returns **intervals only** — never a title, attendee or location. That
  // restraint is the whole reason it exists (see calendar-events.ts).
  const external = isAgent
    ? []
    : await (async () => {
        const { data: member } = await admin
          .from("job_team_members")
          .select("email")
          .eq("id", request.interviewer_member_id!)
          .maybeSingle()
        if (!member?.email) return []
        const preview = await getCalendarPreview(member.email)
        // A calendar we can't read means we cannot promise the slot is free, so
        // offer nothing rather than book someone over a meeting.
        if (!preview.ok) return [{ start: Date.now(), end: new Date(to).getTime() }]
        return preview.busy.map((b) => ({
          start: new Date(b.start).getTime(),
          end: new Date(b.end).getTime(),
        }))
      })()

  const [{ data: interviews }, { data: holds }] = await Promise.all([
    admin
      .from("interviews")
      .select("scheduled_at, ends_at")
      .eq(column, resourceId)
      .in("status", ["scheduled", "in_progress"])
      .lt("scheduled_at", to)
      .gt("ends_at", from),
    admin
      .from("interview_slot_holds")
      .select("starts_at, ends_at")
      .eq(column, resourceId)
      .gt("expires_at", from)
      .neq("request_id", request.id)
      .lt("starts_at", to)
      .gt("ends_at", from),
  ])

  return [
    ...external,
    ...(interviews ?? []).map((i) => ({
      start: new Date(i.scheduled_at).getTime(),
      end: new Date(i.ends_at).getTime(),
    })),
    ...(holds ?? []).map((h) => ({
      start: new Date(h.starts_at).getTime(),
      end: new Date(h.ends_at).getTime(),
    })),
  ]
}
