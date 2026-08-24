import "server-only"

/**
 * `Idempotency-Key` replay for confirm.
 *
 * **This is the second of two layers, and the weaker one.** The durable layer is
 * the database: `confirm_interview_booking` takes `FOR UPDATE` on the request
 * row, and a replay finds `status = 'booked'` and returns the interview that
 * already exists (see `20260823211548_interview_booking_functions.sql`). That is
 * what makes double-confirm safe across instances, across deploys, and forever —
 * a candidate who books, closes the tab, and reopens the link a week later gets
 * their booking back rather than a second one.
 *
 * This cache exists for the case the database layer handles correctly but
 * expensively: the double-click, the mobile browser that retries on flaky
 * signal, the impatient refresh. Without it each of those takes a per-agent
 * advisory lock and serialises every other booking in the system behind a round
 * trip. With it, the second request is answered from memory.
 *
 * Two consequences of being in-process, both acceptable *because* the durable
 * layer is underneath:
 *
 *  - A replay routed to a different instance misses the cache and falls through
 *    to Postgres, which returns the same answer anyway. A miss costs latency,
 *    never correctness.
 *  - Entries are dropped on cold start. Same reasoning.
 *
 * Concurrent requests sharing a key await **one** in-flight promise, so two
 * simultaneous clicks produce one call rather than two racing on the row lock.
 */

type Entry<T> = {
  /** In flight, or settled and being replayed within the TTL. */
  promise: Promise<T>
  expiresAt: number
}

const TTL_MS = 10 * 60 * 1000
const MAX_ENTRIES = 5_000

const entries = new Map<string, Entry<unknown>>()

/**
 * Run `work` once per key, replaying the first result for `TTL_MS`.
 *
 * A rejected promise is evicted rather than cached: a transient failure must be
 * retryable, and caching it would pin a candidate to an error for ten minutes.
 */
export async function withIdempotency<T>(key: string, work: () => Promise<T>): Promise<T> {
  const now = Date.now()
  const existing = entries.get(key)
  if (existing && existing.expiresAt > now) {
    return existing.promise as Promise<T>
  }

  if (entries.size >= MAX_ENTRIES) sweep(now)

  const promise = work()
  entries.set(key, { promise, expiresAt: now + TTL_MS })

  promise.catch(() => {
    const current = entries.get(key)
    if (current?.promise === promise) entries.delete(key)
  })

  return promise
}

function sweep(now: number): void {
  for (const [key, entry] of entries) {
    if (entry.expiresAt <= now) entries.delete(key)
  }
  if (entries.size < MAX_ENTRIES) return
  const oldest = [...entries.entries()].sort((a, b) => a[1].expiresAt - b[1].expiresAt)
  for (let i = 0; i < Math.ceil(oldest.length / 4); i += 1) entries.delete(oldest[i][0])
}

/**
 * Constrain what a client may use as a key.
 *
 * The key is concatenated into a map key alongside the token fingerprint, so an
 * unbounded value would let a caller both blow the cache budget and forge a
 * collision with another request's namespace by embedding a separator.
 */
export function normalizeIdempotencyKey(raw: string | null): string | null {
  if (!raw) return null
  const trimmed = raw.trim()
  if (trimmed.length === 0 || trimmed.length > 200) return null
  if (!/^[A-Za-z0-9._~-]+$/.test(trimmed)) return null
  return trimmed
}

/** Test seam. Never called from request paths. */
export function __resetIdempotencyForTests(): void {
  entries.clear()
}
