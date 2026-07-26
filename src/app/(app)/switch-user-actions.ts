"use server"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { IMPERSONATOR_COOKIE } from "@/lib/impersonation"

/**
 * Lets a Stellaforce admin view the app as any other user (Stellaforce or
 * client-side) without knowing their password. Generates a magic-link token
 * for the target via the service-role Admin API, then verifies it against
 * the request-scoped client so its cookie adapter swaps the session in place.
 */
export async function switchToUser(targetProfileId: string) {
  const cookieStore = await cookies()

  // Refuse to nest impersonation — must return to the real account first.
  if (cookieStore.get(IMPERSONATOR_COOKIE)) {
    redirect("/home")
  }

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: actingProfile } = await supabase
    .from("profiles")
    .select("side, role")
    .eq("id", user.id)
    .single()

  if (actingProfile?.side !== "stellaforce" || actingProfile.role !== "admin") {
    redirect("/home")
  }

  const { data: targetProfile } = await supabase
    .from("profiles")
    .select("id, email")
    .eq("id", targetProfileId)
    .single()

  if (!targetProfile) {
    redirect("/home")
  }
  if (targetProfile.id === user.id) {
    redirect("/home")
  }

  const {
    data: { session: adminSession },
  } = await supabase.auth.getSession()
  if (!adminSession) redirect("/login")

  const admin = createAdminClient()
  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: targetProfile.email,
  })
  if (linkError || !linkData) redirect("/home?error=switch_user_failed")

  const { error: verifyError } = await supabase.auth.verifyOtp({
    token_hash: linkData.properties.hashed_token,
    type: "magiclink",
  })
  if (verifyError) redirect("/home?error=switch_user_failed")

  cookieStore.set(IMPERSONATOR_COOKIE, JSON.stringify({
    access_token: adminSession.access_token,
    refresh_token: adminSession.refresh_token,
  }), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60, // 1 hour — bounds how long a forgotten switch stays live
  })

  redirect("/home")
}

/** Restores the original admin session saved by switchToUser. */
export async function returnToMyAccount() {
  const cookieStore = await cookies()
  const stored = cookieStore.get(IMPERSONATOR_COOKIE)
  if (!stored) redirect("/home")

  const supabase = await createClient()

  try {
    const { access_token, refresh_token } = JSON.parse(stored.value)
    const { error } = await supabase.auth.setSession({ access_token, refresh_token })
    if (error) throw error
  } catch {
    cookieStore.delete(IMPERSONATOR_COOKIE)
    await supabase.auth.signOut()
    redirect("/login?error=session_expired")
  }

  cookieStore.delete(IMPERSONATOR_COOKIE)
  redirect("/home")
}
