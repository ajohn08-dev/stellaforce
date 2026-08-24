import { type NextRequest } from "next/server"
import { z } from "zod"

import { holdSlot, releaseHold } from "@/lib/server/booking-core"
import {
  badRequestResponse,
  guardBookingRequest,
  invalidTokenResponse,
  logBooking,
  noStoreJson,
} from "@/lib/server/booking-http"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const revalidate = 0

/**
 * POST /api/book/:token/hold — take (or move) this link's single lease.
 * DELETE /api/book/:token/hold — give it back.
 *
 * A hold is a **lease, not a booking**: it lives in `interview_slot_holds` with
 * a TTL, so it stops existing on a clock with nothing on the critical path. The
 * alternative — an `interviews` row with `status = 'held'` — never stops
 * existing, needs a sweeper, and until that sweeper runs is indistinguishable
 * from a real interview to every reader in the system.
 *
 * The body carries a **start instant, not a slot id**. There are no slot ids;
 * the grid is generated, not stored. That is what stops this route being an
 * object-reference oracle — `hold_interview_slot` re-derives notice, horizon and
 * lane availability from the request row, so an instant the candidate was never
 * offered is refused by the same rules that would have hidden it.
 *
 * One lease per request row, enforced by `on conflict (request_id) do update`:
 * a candidate changing their mind moves their hold rather than accumulating
 * them, so browsing cannot drain an agent's concurrency.
 */

const HoldSchema = z.object({
  /** ISO-8601 instant. Absolute, never an offset-less local time. */
  start: z.string().datetime({ offset: true }),
})

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params

  const guard = guardBookingRequest(req, token, "hold")
  if (guard.refusal) return guard.refusal

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return badRequestResponse("Invalid JSON body")
  }

  const parsed = HoldSchema.safeParse(body)
  if (!parsed.success) {
    // Shape errors are the caller's own bug, not a token condition, so they get
    // a real message. Nothing about the token is revealed by saying "start must
    // be an ISO instant" — the request never reached the database.
    return badRequestResponse("`start` must be an ISO-8601 instant")
  }

  const result = await holdSlot(token, parsed.data.start)

  if (!result.ok) {
    logBooking("hold", "refused", { ...guard.context, reasonCode: result.reasonCode })

    // A token that resolved to nothing is indistinguishable from one that never
    // existed — same 404, same body as every other invalid condition.
    if (!result.reasonCode) return invalidTokenResponse()

    // A *slot* refusal is different in kind: the link is fine, the time isn't,
    // and the candidate can act on that. 409 says so, and the message is the
    // candidate-safe sentence from the reason-code table — never the code's
    // internal wording, which describes the agent's capacity to a recruiter.
    return noStoreJson({ ok: false, error: result.message }, { status: 409 })
  }

  logBooking("hold", "ok", guard.context)

  return noStoreJson({
    ok: true,
    // Opaque, and only ever usable alongside the same token: `confirm` looks it
    // up with `where id = ? and request_id = ?`, so a hold id lifted from
    // somewhere else resolves to nothing.
    hold_id: result.holdId,
    starts_at: result.startsAt,
    expires_at: result.expiresAt,
  })
}

/**
 * Release, for the candidate who closes the tab mid-decision.
 *
 * Takes no body: it deletes by `request_id` resolved from the token, so there is
 * nothing for a caller to name and nothing to get wrong. Idempotent, and
 * deliberately silent about whether a hold existed.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params

  const guard = guardBookingRequest(req, token, "hold")
  if (guard.refusal) return guard.refusal

  await releaseHold(token)
  logBooking("hold", "released", guard.context)

  return noStoreJson({ ok: true })
}
