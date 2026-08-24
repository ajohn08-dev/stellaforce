import { NextRequest } from "next/server"

import { GET as availability } from "@/app/api/book/[token]/availability/route"
import { DELETE as releaseHold, POST as hold } from "@/app/api/book/[token]/hold/route"
import { POST as confirm } from "@/app/api/book/[token]/confirm/route"
import { bookingTokenFingerprint, hashBookingToken, mintBookingToken } from "@/lib/server/booking-token"
import { BOOKING_BUDGETS } from "@/lib/server/booking-http"
import { __resetRateLimitsForTests, rateLimit } from "@/lib/server/rate-limit"
import {
  __resetIdempotencyForTests,
  normalizeIdempotencyKey,
  withIdempotency,
} from "@/lib/server/idempotency"

/**
 * The public booking endpoints, driven headless.
 *
 * Calls the **real route handlers** — the same exported functions Next invokes —
 * with hand-built `NextRequest`s, so the assertions are about what a candidate's
 * browser would actually receive rather than about a re-implementation of it.
 *
 * Everything here uses tokens that do not exist. That is deliberate and is most
 * of the point: the security properties worth guarding are the ones on the
 * *failure* path, and they are the ones no happy-path test ever reaches. The
 * booking path itself is covered against the real database by
 * `npm run scheduling-e2e`.
 *
 *     npm run booking-check
 *
 * Writes nothing. The only database traffic is a handful of indexed lookups for
 * token hashes that were never stored.
 */

let failures = 0
function check(ok: boolean, label: string, detail = "") {
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`)
  if (!ok) failures++
}
function section(name: string) {
  console.log(`\n${name}`)
}

/** A syntactically valid token — 32 random bytes, base64url — that was never issued. */
function unissuedToken(): string {
  return mintBookingToken().token
}

function request(
  path: string,
  init: { method?: string; ip?: string; body?: unknown; headers?: Record<string, string> } = {}
): NextRequest {
  return new NextRequest(`https://app.example.test${path}`, {
    method: init.method ?? "GET",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": init.ip ?? "203.0.113.1",
      ...(init.headers ?? {}),
    },
    ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
  })
}

const params = (token: string) => ({ params: Promise.resolve({ token }) })

async function main() {
  // ── The token itself ──────────────────────────────────────────────────────
  section("The token")
  {
    const minted = mintBookingToken()
    check(/^[A-Za-z0-9_-]{43}$/.test(minted.token), "32 random bytes, base64url", "43 chars")
    check(minted.tokenHash === hashBookingToken(minted.token), "the stored value is sha256(token)")
    check(minted.tokenHash.length === 64, "…stored as 64 hex characters")
    check(
      !minted.tokenHash.includes(minted.token) && minted.tokenHash !== minted.token,
      "the hash is not the token"
    )
    check(
      minted.url.endsWith(`/book/${minted.token}`),
      "the URL is built by the app, from the configured public origin"
    )
    check(
      minted.url.startsWith("https://") || minted.url.startsWith("http://localhost"),
      "…and is absolute",
      new URL(minted.url).origin
    )
    check(mintBookingToken().token !== minted.token, "two mints are not the same token")

    const fp = bookingTokenFingerprint(minted.token)
    check(fp.length === 12 && /^[0-9a-f]+$/.test(fp), "the log fingerprint is 12 hex chars", fp)
    check(!minted.token.includes(fp) && !fp.includes(minted.token.slice(0, 8)),
      "…and is not a substring of the token")
    check(
      fp === bookingTokenFingerprint(minted.token),
      "…and is stable, so log lines for one link correlate"
    )
    check(
      fp !== bookingTokenFingerprint(unissuedToken()),
      "…and differs between links"
    )
  }

  // ── One response for every invalid condition ──────────────────────────────
  section("Invalid tokens are indistinguishable")
  {
    // Malformed (rejected on shape, never reaches the database) versus
    // well-formed but never issued (an indexed miss). These take visibly
    // different code paths, and must be impossible to tell apart.
    const malformed = await availability(
      request("/api/book/nope/availability", { ip: "203.0.113.10" }),
      params("nope")
    )
    const unissued = await availability(
      request("/api/book/x/availability", { ip: "203.0.113.11" }),
      params(unissuedToken())
    )

    const malformedBody = await malformed.json()
    const unissuedBody = await unissued.json()

    check(malformed.status === 404, "a malformed token is a 404", String(malformed.status))
    check(unissued.status === unissued.status && unissued.status === 404,
      "a never-issued token is a 404", String(unissued.status))
    check(
      JSON.stringify(malformedBody) === JSON.stringify(unissuedBody),
      "…byte-for-byte the same body",
      JSON.stringify(unissuedBody)
    )
    check(
      !JSON.stringify(unissuedBody).toLowerCase().includes("expire"),
      "…and it never says which condition failed"
    )

    // The same must hold across the write endpoints, which reach the database
    // through different functions entirely.
    const heldNothing = await hold(
      request("/api/book/x/hold", {
        method: "POST",
        ip: "203.0.113.12",
        body: { start: new Date(Date.now() + 86_400_000).toISOString() },
      }),
      params(unissuedToken())
    )
    const confirmedNothing = await confirm(
      request("/api/book/x/confirm", {
        method: "POST",
        ip: "203.0.113.13",
        body: { hold_id: "00000000-0000-4000-8000-000000000000", timezone: "UTC" },
      }),
      params(unissuedToken())
    )
    check(heldNothing.status === 404, "hold answers the same way", String(heldNothing.status))
    check(
      confirmedNothing.status === 404,
      "confirm answers the same way",
      String(confirmedNothing.status)
    )
    check(
      JSON.stringify(await heldNothing.json()) === JSON.stringify(unissuedBody) &&
        JSON.stringify(await confirmedNothing.json()) === JSON.stringify(unissuedBody),
      "…with the identical body"
    )
  }

  // ── Nothing is cacheable ──────────────────────────────────────────────────
  section("Caching is off")
  {
    for (const [name, res] of [
      [
        "availability",
        await availability(
          request("/api/book/x/availability", { ip: "203.0.113.20" }),
          params(unissuedToken())
        ),
      ],
      [
        "hold",
        await hold(
          request("/api/book/x/hold", {
            method: "POST",
            ip: "203.0.113.21",
            body: { start: new Date(Date.now() + 86_400_000).toISOString() },
          }),
          params(unissuedToken())
        ),
      ],
      [
        "confirm",
        await confirm(
          request("/api/book/x/confirm", {
            method: "POST",
            ip: "203.0.113.22",
            body: { timezone: "UTC", start_now: true },
          }),
          params(unissuedToken())
        ),
      ],
    ] as const) {
      const cc = res.headers.get("cache-control") ?? ""
      check(cc.includes("no-store"), `${name} sends no-store`, cc)
      check(
        res.headers.get("referrer-policy") === "no-referrer",
        `${name} sends no-referrer — the URL is a credential`
      )
    }
  }

  // ── Request validation ────────────────────────────────────────────────────
  section("Bad requests are refused before the token is used")
  {
    const noBody = await hold(
      request("/api/book/x/hold", { method: "POST", ip: "203.0.113.30" }),
      params(unissuedToken())
    )
    check(noBody.status === 400, "hold without a body is a 400", String(noBody.status))

    const localTime = await hold(
      request("/api/book/x/hold", {
        method: "POST",
        ip: "203.0.113.31",
        body: { start: "2026-09-01 10:00" },
      }),
      params(unissuedToken())
    )
    check(
      localTime.status === 400,
      "an offset-less local time is refused — instants only",
      String(localTime.status)
    )

    const noHold = await confirm(
      request("/api/book/x/confirm", {
        method: "POST",
        ip: "203.0.113.32",
        body: { timezone: "UTC" },
      }),
      params(unissuedToken())
    )
    check(
      noHold.status === 400,
      "confirm without a hold and without start_now is a 400",
      String(noHold.status)
    )

    const badKey = await confirm(
      request("/api/book/x/confirm", {
        method: "POST",
        ip: "203.0.113.33",
        headers: { "idempotency-key": "not a valid key!!" },
        body: { timezone: "UTC", start_now: true },
      }),
      params(unissuedToken())
    )
    check(
      badKey.status === 400,
      "a malformed Idempotency-Key is refused, not silently ignored",
      String(badKey.status)
    )
  }

  // ── Rate limiting ─────────────────────────────────────────────────────────
  section("Rate limiting")
  {
    __resetRateLimitsForTests()

    const token = unissuedToken()
    const ip = "198.51.100.7"
    const budget = BOOKING_BUDGETS.availability.limit

    let lastOk = 0
    let refused: Response | null = null
    for (let i = 0; i < budget + 5; i += 1) {
      const res = await availability(
        request("/api/book/x/availability", { ip }),
        params(token)
      )
      if (res.status === 429) {
        refused ??= res
      } else {
        lastOk = i + 1
      }
    }

    check(refused !== null, "a flood is eventually refused")
    check(
      lastOk === budget,
      `…after exactly the budget of ${budget}`,
      `${lastOk} allowed`
    )
    const retryAfter = Number(refused?.headers.get("retry-after") ?? 0)
    check(
      retryAfter > 0 && retryAfter <= 60,
      "…with a Retry-After the client can act on",
      `${retryAfter}s`
    )
    check(
      (refused?.headers.get("cache-control") ?? "").includes("no-store"),
      "…and the refusal is itself uncacheable"
    )

    // A different candidate on a different address must be unaffected — the
    // failure mode that matters is one abusive client locking out the rest.
    const other = await availability(
      request("/api/book/x/availability", { ip: "198.51.100.8" }),
      params(unissuedToken())
    )
    check(other.status !== 429, "a different token from a different IP is unaffected")

    // Same token, different IP: still refused, because the token bucket is
    // shared. A leaked link forwarded to a botnet is exactly this shape.
    const sameTokenElsewhere = await availability(
      request("/api/book/x/availability", { ip: "198.51.100.9" }),
      params(token)
    )
    check(
      sameTokenElsewhere.status === 429,
      "…but the same token from a new IP is still refused"
    )

    __resetRateLimitsForTests()
    const budgets = Object.entries(BOOKING_BUDGETS)
    check(
      budgets.every(([, b]) => b.limit > 0 && b.windowMs > 0),
      "every budget is a real limit"
    )
    check(
      BOOKING_BUDGETS.confirm.limit <= BOOKING_BUDGETS.hold.limit &&
        BOOKING_BUDGETS.hold.limit <= BOOKING_BUDGETS.availability.limit,
      "the tightest budget is on confirm, which takes the agent lock"
    )
  }

  // ── The limiter itself ────────────────────────────────────────────────────
  section("The limiter")
  {
    __resetRateLimitsForTests()
    const budget = { limit: 3, windowMs: 50 }

    const first = [0, 1, 2].map(() => rateLimit("k", budget))
    check(first.every((r) => r.ok), "the budget is spendable")
    check(
      first.map((r) => r.remaining).join(",") === "2,1,0",
      "…and counts down",
      first.map((r) => r.remaining).join(",")
    )
    check(!rateLimit("k", budget).ok, "…then refuses")
    check(rateLimit("other", budget).ok, "a different key has its own budget")

    await new Promise((r) => setTimeout(r, 60))
    check(rateLimit("k", budget).ok, "the window resets on its own clock")
  }

  // ── Idempotency ───────────────────────────────────────────────────────────
  section("Idempotency")
  {
    __resetIdempotencyForTests()

    check(normalizeIdempotencyKey(null) === null, "no header is no key")
    check(normalizeIdempotencyKey("  ") === null, "whitespace is not a key")
    check(normalizeIdempotencyKey("a".repeat(201)) === null, "an over-long key is refused")
    check(normalizeIdempotencyKey("has spaces") === null, "a key with spaces is refused")
    check(
      normalizeIdempotencyKey("has:colon") === null,
      "…and so is a separator that could forge a namespace"
    )
    check(
      normalizeIdempotencyKey(" 018f-abc_DEF.1~2 ") === "018f-abc_DEF.1~2",
      "a UUID-shaped key is accepted and trimmed"
    )

    let runs = 0
    const work = async () => {
      runs += 1
      await new Promise((r) => setTimeout(r, 10))
      return runs
    }

    const [a, b] = await Promise.all([
      withIdempotency("key-1", work),
      withIdempotency("key-1", work),
    ])
    check(runs === 1, "two concurrent calls run the work once", `${runs} run`)
    check(a === b, "…and both get the same answer")

    const replay = await withIdempotency("key-1", work)
    check(runs === 1 && replay === a, "a later replay is served from the cache")

    await withIdempotency("key-2", work)
    check(runs === 2, "a different key runs again")

    // A failure must stay retryable — caching it would pin a candidate to an
    // error for the life of the entry.
    let attempts = 0
    const flaky = async () => {
      attempts += 1
      if (attempts === 1) throw new Error("transient")
      return "recovered"
    }
    await withIdempotency("key-3", flaky).catch(() => {})
    const recovered = await withIdempotency("key-3", flaky)
    check(recovered === "recovered", "a rejected attempt is evicted, so a retry can succeed")

    __resetIdempotencyForTests()
  }

  // ── Release ───────────────────────────────────────────────────────────────
  section("Release")
  {
    const res = await releaseHold(
      request("/api/book/x/hold", { method: "DELETE", ip: "203.0.113.40" }),
      params(unissuedToken())
    )
    // Deliberately not a 404: releasing is idempotent and must not report
    // whether a hold — or a token — existed.
    check(res.status === 200, "releasing an unknown hold succeeds silently", String(res.status))
    check(
      JSON.stringify(await res.json()) === JSON.stringify({ ok: true }),
      "…and says nothing else"
    )
  }
}

main()
  .then(() => {
    console.log(failures === 0 ? "\nAll booking-endpoint checks passed.\n" : `\n${failures} failed.\n`)
    process.exit(failures === 0 ? 0 : 1)
  })
  .catch((err) => {
    console.error("\nBooking endpoint check aborted:", err)
    process.exit(1)
  })
