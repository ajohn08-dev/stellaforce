import { type NextRequest } from "next/server"

import { loadAvailability } from "@/lib/server/booking-core"
import {
  guardBookingRequest,
  invalidTokenResponse,
  logBooking,
  noStoreJson,
} from "@/lib/server/booking-http"

export const runtime = "nodejs"
/**
 * Never prerendered, never revalidated. The response is live agent capacity: a
 * cached one offers slots that are already gone, and the candidate finds out by
 * having their booking refused.
 */
export const dynamic = "force-dynamic"
export const revalidate = 0

/**
 * GET /api/book/:token/availability
 *
 * The bookable grid for one link. Public, unauthenticated, and the token in the
 * path is the entire credential.
 *
 * **What is not in the response** is the point of this route. No candidate name,
 * email or phone; no application, job or stage id; no other candidate's booking;
 * no calendar event titles. The agent's occupancy is folded into the grid before
 * it leaves the server, so a slot the candidate cannot have simply isn't listed
 * — the response never says *why*, because "busy" is a fact about someone else's
 * interview.
 *
 * Every unusable-token condition returns one identical 404.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params

  const guard = guardBookingRequest(req, token, "availability")
  if (guard.refusal) return guard.refusal

  const availability = await loadAvailability(token)
  if (!availability) {
    logBooking("availability", "invalid_token", guard.context)
    return invalidTokenResponse()
  }

  logBooking("availability", availability.booked ? "already_booked" : "ok", guard.context)

  return noStoreJson({
    ok: true,
    booked: availability.booked,
    slots: availability.slots,
    can_start_now: availability.canStartNow,
    allow_start_now: availability.allowStartNow,
    slot_minutes: availability.slotMinutes,
    hold_seconds: availability.holdSeconds,
    // The zone the grid was generated in. The candidate's browser renders these
    // instants in whatever zone it likes; this is here so a client can say
    // "times shown in the interviewer's local hours" without guessing.
    operating_timezone: availability.operatingTimezone,
  })
}
