import { createBrowserClient } from "@supabase/ssr"

import { publicEnv } from "@/lib/env"
import type { Database } from "@/lib/supabase/types"

/**
 * Browser Supabase client. Uses the anon key; all access is governed by RLS.
 * Safe to import in Client Components.
 */
export function createClient() {
  return createBrowserClient<Database>(
    publicEnv.supabaseUrl,
    publicEnv.supabaseAnonKey
  )
}
