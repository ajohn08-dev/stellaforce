import "server-only"

import { NextResponse, type NextRequest } from "next/server"

import { bookingTokenFingerprint } from "@/lib/server/booking-token"
import { rateLimit, type RateLimitBudget } from "@/lib/server/rate-limit"
import { GENERIC_CANDIDATE_MESSAGE } from "@/lib/scheduling-reason-codes"

/**
 * Shared plumbing for `/api/book/[token]/*`.
 *
 * These three routes are the only unauthenticated, service-role, write-capable
 * endpoints in the app. Everything they have in common lives here so that
 * "public booking endpoint" is one decision applied three times rather than
 * three routes that drifted apart — the failure mode being the fourth route,
 * added later, that forgets the `no-store` or the rate limit.
 */

/**
 * Budgets, per token **and** per IP, per minute.
 *
 * Sized against what a real candidate does rather than what feels safe. Someone
 * on a train changing timezone, re-picking times and watching a hold count down
 * generates a surprising number of requests, and a limit that fires on a real
 * booking is worse than one an attacker can survive — the attacker is up against
 * a 256-bit token either way.
 */
export const BOOKING_BUDGETS = {
  /** Read-only and polled, so the loosest of the three. */
  availability: { limit: 60, windowMs: 60_000 },
  /** A write, but a cheap one, and candidates genuinely change their minds. */
  hold: { limit: 30, windowMs: 60_000 },
  /** Takes a per-agent advisory lock. Tightest budget in the app. */
  confirm: { limit: 10, windowMs: 60_000 },
} satisfies Record<string, RateLimitBudget>

/**
 * `no-store`, not `no-cache`.
 *
 * Availability is live capacity and a booking response is personal; either one
 * sitting in Vercel's edge cache, a corporate proxy, or the candidate's own
 * browser is a correctness bug before it is a privacy one — a cached grid offers
 * slots that are gone. `private` and `Vary: *` are belt-and-braces for
 * intermediaries that treat `no-store` as advisory.
 */
export function noStoreJson(body: unknown, init?: { status?: number; headers?: HeadersInit }) {
  const response = NextResponse.json(body, { status: init?.status ?? 200 })
  response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, private")
  response.headers.set("Pragma", "no-cache")
  response.headers.set("Vary", "*")
  // The URL is a credential. It must not travel in a Referer to anything the
  // response might cause the browser to load.
  response.headers.set("Referrer-Policy", "no-referrer")
  if (init?.headers) {
    for (const [key, value] of new Headers(init.headers)) response.headers.set(key, value)
  }
  return response
}

/**
 * The one response every invalid-token condition collapses to.
 *
 * Never existed, wrong shape, expired, cancelled, stage deleted, belongs to a
 * closed application — one status, one body, no timing tell worth having. The
 * difference between "expired" and "never existed" is precisely what confirms to
 * someone guessing that a token existed at all.
 */
export function invalidTokenResponse() {
  return noStoreJson({ ok: false, error: GENERIC_CANDIDATE_MESSAGE }, { status: 404 })
}

/** A refusal the caller can act on, unlike the token responses. */
export function tooManyRequestsResponse(retryAfterSeconds: number) {
  return noStoreJson(
    { ok: false, error: "Too many requests. Please wait a moment and try again." },
    { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
  )
}

export function badRequestResponse(error: string) {
  return noStoreJson({ ok: false, error }, { status: 400 })
}

/**
 * Best-effort client address for rate-limit keying.
 *
 * `x-forwarded-for` is spoofable in general; on Vercel the platform appends the
 * real peer, so the **last** entry is the trustworthy one. Falling back to a
 * constant is deliberate: an unknown address shares one bucket rather than
 * getting a free pass, which is the safe direction for a limiter.
 */
export function clientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for")
  if (forwarded) {
    const parts = forwarded.split(",").map((p) => p.trim()).filter(Boolean)
    if (parts.length > 0) return parts[parts.length - 1]
  }
  return req.headers.get("x-real-ip")?.trim() || "unknown"
}

export type BookingRequestContext = {
  /** Log-safe handle for this link. Never the token. */
  fingerprint: string
  ip: string
}

/**
 * Rate-limit gate. Returns a 429 to return, or the context to carry on with.
 *
 * Keyed on the token fingerprint **and** the IP, and both are checked. Token
 * alone lets one attacker with many links through; IP alone punishes an office
 * NAT where several candidates share an address. Requiring both to pass costs
 * one extra map lookup.
 */
export function guardBookingRequest(
  req: NextRequest,
  rawToken: string,
  scope: keyof typeof BOOKING_BUDGETS
): { refusal: NextResponse; context: null } | { refusal: null; context: BookingRequestContext } {
  const fingerprint = bookingTokenFingerprint(rawToken)
  const ip = clientIp(req)
  const budget = BOOKING_BUDGETS[scope]

  const byToken = rateLimit(`book:${scope}:t:${fingerprint}`, budget)
  const byIp = rateLimit(`book:${scope}:i:${ip}`, budget)

  if (!byToken.ok || !byIp.ok) {
    const retryAfter = Math.max(byToken.retryAfterSeconds, byIp.retryAfterSeconds)
    logBooking(scope, "rate_limited", { fingerprint })
    return { refusal: tooManyRequestsResponse(retryAfter), context: null }
  }

  return { refusal: null, context: { fingerprint, ip } }
}

/**
 * Structured, deliberately incurious logging.
 *
 * The token never appears — only its fingerprint, which correlates a candidate's
 * complaint to a set of log lines without being usable as a credential. Nothing
 * that identifies the *person* appears either: no email, no phone, no name, no
 * candidate or application id, and **not the IP** — it is used for rate-limit
 * keying, where it never leaves memory, but a candidate's home address-by-proxy
 * sitting in a log aggregator is personal data we have no reason to retain. A
 * log line here answers "did this link work and why not", which is the only
 * question this surface is asked.
 */
export function logBooking(
  scope: string,
  outcome: string,
  context: { fingerprint: string; reasonCode?: string | null }
): void {
  console.info(
    JSON.stringify({
      at: "api/book",
      scope,
      outcome,
      token_fp: context.fingerprint,
      reason_code: context.reasonCode ?? null,
    })
  )
}
