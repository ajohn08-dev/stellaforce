import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"

import { publicEnv } from "@/lib/env"
import type { Database } from "@/lib/supabase/types"

/**
 * Server Supabase client scoped to the current request's auth cookies.
 * Uses the anon key + the signed-in user's session, so RLS applies.
 * Use this for reads/writes that should respect the recruiter's permissions.
 *
 * Must be called within a request scope (Server Component, Server Action,
 * or route handler).
 */
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    publicEnv.supabaseUrl,
    publicEnv.supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // `setAll` was called from a Server Component. This can be ignored
            // when middleware refreshes user sessions.
          }
        },
      },
    }
  )
}
