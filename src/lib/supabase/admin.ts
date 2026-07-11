import "server-only"

import { createClient } from "@supabase/supabase-js"

import { serverEnv } from "@/lib/env"
import type { Database } from "@/lib/supabase/types"

/**
 * Service-role Supabase client. BYPASSES Row-Level Security.
 *
 * SERVER ONLY — the `server-only` import above makes bundling this into client
 * code a build error. Use exclusively inside Server Actions / route handlers for
 * privileged writes (e.g. seeding, embedding backfills, provenance flips) where
 * you have already authorized the recruiter. Never return the raw client or its
 * key to the browser.
 */
export function createAdminClient() {
  return createClient<Database>(
    serverEnv.supabaseUrl,
    serverEnv.supabaseServiceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}
