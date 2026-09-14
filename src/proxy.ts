import { type NextRequest } from "next/server"

import { updateSession } from "@/lib/supabase/middleware"

/**
 * Static pages that sit directly under `/candidates`, which also owns the
 * `@modal/(.)[id]` interception route.
 *
 * Interception is a **rewrite**, not a route match. The build emits a
 * `beforeFiles` rule — source `/candidates/:nxtIid`, destination
 * `/candidates/(.):nxtIid`, conditional on the `next-url` header matching
 * `/candidates(?:/.*)?` — so *every* client-side navigation that starts under
 * `/candidates` and lands on a single segment under `/candidates` is rewritten
 * into the modal route before any page is matched. `:nxtIid` is a wildcard: it
 * captures `search` and `new` exactly as happily as it captures a uuid.
 *
 * The consequence was that Advanced Search 404'd on every soft navigation —
 * the rewrite sent `/candidates/search` to the profile sheet, which called
 * `getCandidate("search")`, got null, and called `notFound()`, replacing the
 * whole tree. A hard reload of the same URL worked, because a typed URL sends
 * no `next-url` and so never matched the rewrite. That asymmetry is what made
 * it look like the page was missing rather than broken.
 *
 * Adding a static `@modal/search/page.tsx` does **not** fix this — slot-level
 * static-beats-dynamic precedence is decided after the rewrite has already
 * changed the path. Dropping the header is the only seam before it: without
 * `next-url` the rule's `has` condition fails, the request resolves to its own
 * page, and the modal slot falls through to its `default.tsx`.
 *
 * This suppresses interception for these two paths only. `/candidates/[id]`
 * still intercepts normally, so clicking a candidate from the list still opens
 * the profile sheet over it.
 *
 * **Add a route here whenever a static page is added under `/candidates`.**
 */
const INTERCEPTION_SHADOWED_PATHS = new Set([
  "/candidates/search",
  "/candidates/new",
])

export async function proxy(request: NextRequest) {
  if (
    INTERCEPTION_SHADOWED_PATHS.has(request.nextUrl.pathname) &&
    request.headers.has("next-url")
  ) {
    const headers = new Headers(request.headers)
    headers.delete("next-url")
    return updateSession(request, headers)
  }

  return updateSession(request)
}

export const config = {
  matcher: [
    // `book` and `api/book` are excluded because they are the candidate's
    // scheduling surface: public, unauthenticated routes whose only credential
    // is the token in the URL. Candidates have no login, so passing them
    // through `updateSession` would redirect every one of them to /login.
    //
    // **Both entries are required.** `book` alone only excludes the page —
    // `/api/book/...` starts with `api`, so it would still match and every
    // availability/hold/confirm call would be answered with a redirect to the
    // login page instead of JSON.
    //
    // Everything under both runs with the service-role client. See the header
    // of `src/lib/server/booking-core.ts` for the three rules that entails.
    "/((?!_next/static|_next/image|favicon.ico|book|api/book|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
