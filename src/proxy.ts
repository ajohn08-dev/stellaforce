import { type NextRequest } from "next/server"

import { updateSession } from "@/lib/supabase/middleware"

export async function proxy(request: NextRequest) {
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
