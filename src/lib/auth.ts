import "server-only"

import { createClient } from "@/lib/supabase/server"
import type { ClientRole, ProfileSide, UserRole } from "@/lib/supabase/types"

export type CurrentProfile = {
  id: string
  email: string
  full_name: string | null
  role: UserRole
  side: ProfileSide
  client_id: string | null
  client_role: ClientRole | null
}

/**
 * Resolves the signed-in user's profile for the current request, or null if
 * no one is logged in. Server-only — call from Server Components, Server
 * Actions, or route handlers.
 */
export async function getCurrentProfile(): Promise<CurrentProfile | null> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, side, client_id, client_role")
    .eq("id", user.id)
    .single()

  if (!profile) return null

  return {
    id: profile.id,
    email: profile.email,
    full_name: profile.full_name,
    role: profile.role,
    side: profile.side,
    client_id: profile.client_id,
    client_role: profile.client_role,
  }
}
