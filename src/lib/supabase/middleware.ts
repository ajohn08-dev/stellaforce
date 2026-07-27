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
 * unauthenticated users to /login. Called from src/middleware.ts.
 */
export async function updateSession(request: NextRequest) {
  const response = NextResponse.next({ request })

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
