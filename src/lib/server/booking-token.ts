import "server-only"

import { createHash, randomBytes } from "node:crypto"

import { serverEnv } from "@/lib/env"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase/types"

/**
 * The candidate's booking link.
 *
 * 32 random bytes, base64url, in the URL and nowhere else. Only `sha256(token)`
 * is stored, so a database dump does not hand anyone a working link — and the
 * app never string-compares a secret, it hashes what it was given and probes a
 * unique index.
 *
 * **Deliberately not the HMAC `encodeState` pattern** used for Google Calendar
 * consent (`src/lib/google-calendar/oauth.ts`), for three reasons:
 *
 *  1. **Not revocable.** A self-contained HMAC stays valid until its `exp` no
 *     matter what the database says. This link causes a real outbound phone call
 *     to a real person; that capability has to be killable with one UPDATE.
 *  2. **The payload rides in the URL.** `encodeState` base64url's its claims in
 *     plaintext — signed, not encrypted. The booking equivalent would put
 *     `application_id` and `candidate_id` through an email composer, an ESP, a
 *     spam filter and every proxy log between here and the candidate.
 *  3. **No single-use.** Confirm has to be able to answer "this link already
 *     booked", which an HMAC alone cannot.
 */

export type BookingTokenClient = SupabaseClient<Database>

export type MintedToken = {
  /** Goes in the URL. Never stored, never logged. */
  token: string
  tokenHash: string
  url: string
}

export function mintBookingToken(): MintedToken {
  const token = randomBytes(32).toString("base64url")
  return {
    token,
    tokenHash: hashBookingToken(token),
    url: `${serverEnv.siteUrl.replace(/\/$/, "")}/book/${token}`,
  }
}

export function hashBookingToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex")
}

/**
 * The whitelist the public booking page is allowed to know.
 *
 * Explicit, and never `select("*")`. That route runs with the service-role
 * client — RLS is not there to catch a mistake, so the column list is the only
 * thing standing between a candidate and someone else's data. `token_hash` is
 * absent on purpose: nothing downstream needs it, and a value that never leaves
 * this module cannot be leaked by a component that renders its props.
 */
const RESOLVE_COLUMNS = [
  "id",
  "application_id",
  "sub_stage_id",
  "client_id",
  "candidate_id",
  "job_id",
  "agent_id",
  "interviewer_member_id",
  "status",
  "token_expires_at",
  "slot_minutes",
  "slot_granularity_minutes",
  "minimum_notice_minutes",
  "booking_horizon_days",
  "hold_seconds",
  "allow_start_now",
  "agent_concurrency_limit",
  "operating_timezone",
  "operating_start_hour",
  "operating_end_hour",
  "operating_days",
  "interview_id",
  "candidate_timezone",
].join(", ")

export type ResolvedBookingRequest = {
  id: string
  application_id: string
  sub_stage_id: string
  client_id: string
  candidate_id: string
  job_id: string
  agent_id: string | null
  interviewer_member_id: string | null
  status: Database["public"]["Enums"]["scheduling_request_status"]
  token_expires_at: string
  slot_minutes: number
  slot_granularity_minutes: number
  minimum_notice_minutes: number
  booking_horizon_days: number
  hold_seconds: number
  allow_start_now: boolean
  agent_concurrency_limit: number
  operating_timezone: string
  operating_start_hour: number
  operating_end_hour: number
  operating_days: number[]
  interview_id: string | null
  candidate_timezone: string | null
}

/**
 * Look a raw token up.
 *
 * Returns the request whatever its state — expired, booked, cancelled — because
 * the *caller* decides what to show, and the confirmation page has to be
 * re-openable after the token was spent at booking. Callers must map every
 * failure onto one identical message: the difference between "expired" and
 * "never existed" is exactly what confirms to someone guessing that a token
 * existed at all.
 *
 * There is no timing concern here. The presented token is hashed in Node and
 * the *hash* probes a unique index, so a perfect timing oracle reveals only
 * which hashes exist — and 2^256 is not enumerable.
 */
export async function resolveBookingToken(
  supabase: BookingTokenClient,
  rawToken: string
): Promise<ResolvedBookingRequest | null> {
  // Cheap shape check before touching the database: a base64url-encoded 32-byte
  // value is always 43 characters.
  if (!/^[A-Za-z0-9_-]{43}$/.test(rawToken)) return null

  const { data } = await supabase
    .from("interview_scheduling_requests")
    .select(RESOLVE_COLUMNS)
    .eq("token_hash", hashBookingToken(rawToken))
    .maybeSingle<ResolvedBookingRequest>()

  return data ?? null
}
