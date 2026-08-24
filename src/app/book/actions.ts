"use server"

import {
  confirmBooking as confirmBookingCore,
  holdSlot as holdSlotCore,
  loadBooking as loadBookingCore,
  markBookingOpened as markBookingOpenedCore,
  releaseHold as releaseHoldCore,
} from "@/lib/server/booking-core"
import type { BookingView, ConfirmResult, HoldResult } from "@/lib/server/booking-core"

/**
 * Server Actions for the booking page — a transport, and nothing else.
 *
 * Every rule about tokens, columns and candidate safety lives in
 * `src/lib/server/booking-core.ts`; this file exists so a Server Component can
 * call that module without importing server-only code into a client bundle, and
 * so the module's exports aren't all forced into the `"use server"` contract.
 *
 * ⚠️ **Only async functions may be exported from here.** Every export of a
 * `"use server"` module is compiled into a callable POST endpoint, so a
 * re-exported *type* becomes a value export that doesn't exist and the build
 * fails with `Export BookingView doesn't exist in target module`. Types come
 * from `@/lib/server/booking-core` directly — `import type` is erased, so a
 * Client Component importing one pulls in no server code.
 *
 * `loadBooking` is used by `src/app/book/[token]/page.tsx` for the server render.
 * The interactive calls the client makes go through `/api/book/[token]/*`
 * instead, because a Server Action cannot carry `Cache-Control: no-store`, a
 * `Retry-After`, or an `Idempotency-Key`.
 */

export async function loadBooking(token: string): Promise<BookingView | null> {
  return loadBookingCore(token)
}

export async function markBookingOpened(token: string): Promise<void> {
  return markBookingOpenedCore(token)
}

export async function holdSlot(token: string, startIso: string): Promise<HoldResult> {
  return holdSlotCore(token, startIso)
}

export async function releaseHold(token: string): Promise<void> {
  return releaseHoldCore(token)
}

export async function confirmBooking(input: {
  token: string
  holdId?: string | null
  timezone: string
  startNow?: boolean
}): Promise<ConfirmResult> {
  return confirmBookingCore(input)
}
