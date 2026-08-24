import { type NextRequest } from "next/server"
import { z } from "zod"

import { confirmBooking } from "@/lib/server/booking-core"
import {
  badRequestResponse,
  guardBookingRequest,
  invalidTokenResponse,
  logBooking,
  noStoreJson,
} from "@/lib/server/booking-http"
import { bookingTokenFingerprint } from "@/lib/server/booking-token"
import { normalizeIdempotencyKey, withIdempotency } from "@/lib/server/idempotency"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const revalidate = 0

/**
 * POST /api/book/:token/confirm — the commit.
 *
 * Revalidates the token, re-checks capacity, creates the interview, consumes the
 * hold, spends the link, and queues the agent's call — **all inside one
 * transaction** (`confirm_interview_booking`), under a per-agent advisory lock.
 * An interview with no queued call, and a queued call with no interview, are
 * both states nothing in this system can recover from, so neither is allowed to
 * exist for an instant.
 *
 * Nothing is dialled from this request. Start-now queues a row like every other
 * booking and the dispatcher tick picks it up, so there is one place a call can
 * be guarded, retried or suppressed — including by `SCHEDULING_OUTBOUND_ENABLED`,
 * which is off by default and must stay that way outside a deliberate test.
 *
 * **Idempotency is two layers.** `Idempotency-Key` (this file) collapses the
 * double-click and the flaky-signal retry in-process. The database (see
 * `confirmBooking`) is the durable one: the request row is spent at booking, so
 * a replay — different key, different instance, next week — returns the one
 * interview that exists rather than creating a second. The header is an
 * optimisation; correctness does not depend on the caller sending it.
 */

const ConfirmSchema = z
  .object({
    hold_id: z.string().uuid().nullish(),
    /** IANA zone name. Stored on the interview so a reminder renders correctly. */
    timezone: z.string().min(1).max(64),
    start_now: z.boolean().optional(),
  })
  .refine((v) => v.start_now === true || !!v.hold_id, {
    message: "`hold_id` is required unless `start_now` is true",
  })

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params

  const guard = guardBookingRequest(req, token, "confirm")
  if (guard.refusal) return guard.refusal

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return badRequestResponse("Invalid JSON body")
  }

  const parsed = ConfirmSchema.safeParse(body)
  if (!parsed.success) {
    return badRequestResponse(
      parsed.error.issues[0]?.message ?? "Invalid confirmation request"
    )
  }

  // Rejected rather than sanitised when malformed: silently ignoring a bad key
  // would let a caller believe it has replay protection it doesn't have.
  const rawKey = req.headers.get("idempotency-key")
  if (rawKey !== null && normalizeIdempotencyKey(rawKey) === null) {
    return badRequestResponse(
      "`Idempotency-Key` must be 1–200 characters of [A-Za-z0-9._~-]"
    )
  }
  const idempotencyKey = normalizeIdempotencyKey(rawKey)

  // Namespaced by the token's fingerprint so one caller's key cannot address
  // another link's cached response. The fingerprint is derived, not supplied.
  const cacheKey = idempotencyKey
    ? `confirm:${bookingTokenFingerprint(token)}:${idempotencyKey}`
    : null

  const run = () =>
    confirmBooking({
      token,
      holdId: parsed.data.hold_id ?? null,
      timezone: parsed.data.timezone,
      startNow: parsed.data.start_now ?? false,
    })

  const result = cacheKey ? await withIdempotency(cacheKey, run) : await run()

  if (!result.ok) {
    logBooking("confirm", "refused", { ...guard.context, reasonCode: result.reasonCode })

    if (!result.reasonCode) return invalidTokenResponse()

    // The link is valid; the *time* is not — the hold lapsed, or the lane went
    // to someone faster. 409 and a candidate-safe sentence, so the client can
    // send them back to the grid rather than to a dead end.
    return noStoreJson(
      { ok: false, error: result.message, retryable: true },
      { status: 409 }
    )
  }

  logBooking("confirm", result.replayed ? "replayed" : "booked", guard.context)

  return noStoreJson({
    ok: true,
    scheduled_at: result.scheduledAt,
    start_now: result.startNow,
    // True when this request found the booking already made. The candidate is
    // booked either way; a client may use it to skip a celebration animation.
    replayed: result.replayed,
    // Deliberately no interview_id, application_id, agent_id or phone number.
    // The candidate needs to know *when*; every id here is an internal handle
    // that would only widen what a leaked link discloses.
  })
}
