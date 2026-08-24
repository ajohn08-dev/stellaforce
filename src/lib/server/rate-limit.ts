import "server-only"

/**
 * A fixed-window rate limiter for the public booking endpoints.
 *
 * ⚠️ **Read this before relying on it.** State lives in the process, so on
 * Vercel the limit is enforced *per running instance*, not globally. An attacker
 * who can spread requests across N warm lambdas gets N times the budget, and a
 * scale-to-zero cold start resets every counter.
 *
 * It is still worth having, and is deliberately the first thing every public
 * route does:
 *
 *  - The realistic attack on `/book/<token>` is **enumeration**, and enumeration
 *    is high-volume from few sources. Even per-instance limits turn "guess until
 *    something works" into a rate no attacker can afford against a 256-bit
 *    keyspace.
 *  - It bounds the damage a broken client does. A retry loop in a candidate's
 *    browser must not be able to hammer `confirm_interview_booking`, which takes
 *    a per-agent advisory lock and would serialise every booking in the system
 *    behind it.
 *  - The failure mode is safe: too *little* limiting under scale-out, never too
 *    much.
 *
 * The durable version belongs in Postgres or Upstash and should replace this
 * module wholesale — the call sites take a key and a budget and would not
 * change. It is not built here because a rate-limit table that every public
 * request writes to needs its own capacity thinking, and getting it wrong locks
 * real candidates out of interviews.
 */

type Window = { count: number; resetAt: number }

/**
 * Bounded so a flood of distinct keys can't exhaust the heap — which would turn
 * a rate limiter into the outage it exists to prevent.
 */
const MAX_TRACKED_KEYS = 10_000

const windows = new Map<string, Window>()

export type RateLimitBudget = {
  /** Requests permitted per window. */
  limit: number
  windowMs: number
}

export type RateLimitResult = {
  ok: boolean
  /** Requests left in the current window. Zero once refused. */
  remaining: number
  /** Whole seconds until the window resets. Feeds `Retry-After`. */
  retryAfterSeconds: number
}

export function rateLimit(key: string, budget: RateLimitBudget): RateLimitResult {
  const now = Date.now()
  const existing = windows.get(key)

  if (!existing || existing.resetAt <= now) {
    if (windows.size >= MAX_TRACKED_KEYS) sweep(now)
    windows.set(key, { count: 1, resetAt: now + budget.windowMs })
    return { ok: true, remaining: budget.limit - 1, retryAfterSeconds: 0 }
  }

  existing.count += 1
  const retryAfterSeconds = Math.max(1, Math.ceil((existing.resetAt - now) / 1000))

  if (existing.count > budget.limit) {
    return { ok: false, remaining: 0, retryAfterSeconds }
  }

  return {
    ok: true,
    remaining: Math.max(0, budget.limit - existing.count),
    retryAfterSeconds,
  }
}

/**
 * Drop expired windows; if that isn't enough, drop the soonest-to-expire.
 *
 * Evicting live entries is a deliberate choice over refusing new ones: an
 * evicted key gets a fresh budget (too permissive for one window) whereas
 * refusing would lock out whoever arrived last, and locking a real candidate out
 * of their interview is the worse of the two failures by a wide margin.
 */
function sweep(now: number): void {
  for (const [key, window] of windows) {
    if (window.resetAt <= now) windows.delete(key)
  }
  if (windows.size < MAX_TRACKED_KEYS) return

  const byExpiry = [...windows.entries()].sort((a, b) => a[1].resetAt - b[1].resetAt)
  for (let i = 0; i < Math.ceil(byExpiry.length / 4); i += 1) {
    windows.delete(byExpiry[i][0])
  }
}

/** Test seam. Never called from request paths. */
export function __resetRateLimitsForTests(): void {
  windows.clear()
}
