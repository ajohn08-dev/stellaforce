import { NextResponse, type NextRequest } from "next/server"
import { createServerClient } from "@supabase/ssr"

import { publicEnv } from "@/lib/env"

const PUBLIC_PATHS = ["/login"]

/**
 * API routes authenticate themselves independently (e.g. a bearer secret
 * for webhook callers like n8n) and are never accessed via a browser
 * session, so they must not be redirected to /login for lacking one.
 */
const PUBLIC_PATH_PREFIXES = ["/api/"]

/**
 * Refreshes the Supabase auth session on every request and redirects
 * unauthenticated users to /login. Called from src/proxy.ts.
 *
 * `requestHeaders` replaces the headers forwarded downstream, which is how
 * `proxy.ts` drops `next-url` on the paths a `(.)` interception rewrite would
 * otherwise swallow. Omit it and the request's own headers are passed through
 * unchanged — the only thing this argument is for is that one suppression, so
 * it should not grow into a general header-editing seam.
 */
export async function updateSession(request: NextRequest, requestHeaders?: Headers) {
  const response = requestHeaders
    ? NextResponse.next({ request: { headers: requestHeaders } })
    : NextResponse.next({ request })

  const supabase = createServerClient(
    publicEnv.supabaseUrl,
    publicEnv.supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const isPublicPath =
    PUBLIC_PATHS.some((path) => request.nextUrl.pathname === path) ||
    PUBLIC_PATH_PREFIXES.some((prefix) => request.nextUrl.pathname.startsWith(prefix))

  if (!user && !isPublicPath) {
    const loginUrl = new URL("/login", request.url)
    return NextResponse.redirect(loginUrl)
  }

  return response
}
