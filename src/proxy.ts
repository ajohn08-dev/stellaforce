import { type NextRequest } from "next/server"

import { updateSession } from "@/lib/supabase/middleware"

export async function proxy(request: NextRequest) {
  return updateSession(request)
}

export const config = {
  matcher: [
    // `book` is excluded because `/book/<token>` is the candidate's scheduling
    // page: a public, unauthenticated route whose only credential is the token
    // in the URL. Candidates have no login, so passing it through
    // `updateSession` would redirect every one of them to /login.
    //
    // Everything under it runs with the service-role client. See the header of
    // `src/app/book/[token]/page.tsx` for the three rules that entails.
    "/((?!_next/static|_next/image|favicon.ico|book|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
