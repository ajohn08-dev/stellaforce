import { NextRequest, NextResponse } from "next/server"

import { createAdminClient } from "@/lib/supabase/admin"
import { encryptToken } from "@/lib/google-calendar/crypto"
import {
  decodeState,
  exchangeCode,
  fetchAuthorizedEmail,
} from "@/lib/google-calendar/oauth"

/**
 * GET /api/calendar/oauth/callback
 *
 * Google redirects here after a team member grants (or denies) calendar
 * access. No Supabase session exists at this point (Google is the caller,
 * not a signed-in recruiter), so this always uses the admin client — same
 * category of privileged, no-acting-user write as the resume-ingestion
 * callback. Renders a small standalone HTML response directly rather than a
 * separate app page, since this is a one-shot landing screen, not a route a
 * user navigates to.
 */
export const runtime = "nodejs"

function htmlResponse(status: number, title: string, message: string) {
  return new NextResponse(
    `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
      <style>body{font:16px/1.5 system-ui,sans-serif;max-width:32rem;margin:4rem auto;padding:0 1.5rem;color:#1a1a1a}</style>
    </head><body><h1>${title}</h1><p>${message}</p></body></html>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8" } }
  )
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const url = new URL(req.url)
  const code = url.searchParams.get("code")
  const stateParam = url.searchParams.get("state")
  const error = url.searchParams.get("error")

  if (error) {
    return htmlResponse(400, "Calendar not connected", "Access was not granted, so nothing was connected.")
  }
  if (!code || !stateParam) {
    return htmlResponse(400, "Invalid request", "This link is missing required parameters.")
  }

  const state = decodeState(stateParam)
  if (!state) {
    return htmlResponse(400, "Link expired", "This connect link is invalid or has expired — ask your recruiter to resend it.")
  }

  let tokens
  try {
    tokens = await exchangeCode(code)
  } catch (err) {
    console.error("[calendar-oauth] code exchange failed", err)
    return htmlResponse(500, "Something went wrong", "We couldn't complete the connection. Please try again.")
  }
  if (!tokens.refresh_token) {
    // Google only issues a refresh_token on the first consent (or with
    // prompt=consent, which we always send) — missing here means something's
    // off with the OAuth client config rather than a normal retry case.
    console.error("[calendar-oauth] no refresh_token in Google's response")
    return htmlResponse(500, "Something went wrong", "We couldn't complete the connection. Please try again.")
  }

  let authorizedEmail: string
  try {
    authorizedEmail = await fetchAuthorizedEmail(tokens.access_token)
  } catch (err) {
    console.error("[calendar-oauth] userinfo lookup failed", err)
    return htmlResponse(500, "Something went wrong", "We couldn't verify the connected account. Please try again.")
  }

  if (authorizedEmail.toLowerCase() !== state.email.toLowerCase()) {
    return htmlResponse(
      403,
      "Wrong account",
      `This invite was sent to ${state.email}, but you authorized with ${authorizedEmail}. Please retry using the ${state.email} Google account.`
    )
  }

  const admin = createAdminClient()

  const { data: existing } = await admin
    .from("google_calendar_connections")
    .select("id")
    .ilike("email", state.email)
    .maybeSingle()

  const { data: profileMatch } = await admin
    .from("profiles")
    .select("id")
    .ilike("email", state.email)
    .maybeSingle()

  const row = {
    email: state.email.toLowerCase(),
    profile_id: profileMatch?.id ?? null,
    google_account_email: authorizedEmail,
    refresh_token_encrypted: encryptToken(tokens.refresh_token),
    scope: tokens.scope,
    connected_at: new Date().toISOString(),
    revoked_at: null,
  }

  if (existing) {
    await admin.from("google_calendar_connections").update(row).eq("id", existing.id)
  } else {
    await admin.from("google_calendar_connections").insert(row)
  }

  const { data: job } = await admin
    .from("job_orders")
    .select("client_id")
    .eq("job_id", state.jobId)
    .maybeSingle()

  await admin.from("activity_events").insert({
    event_type: "calendar_connected",
    client_id: job?.client_id ?? null,
    job_id: state.jobId,
    actor_type: "user",
    payload: { email: state.email, job_team_member_id: state.jobTeamMemberId },
  })

  return htmlResponse(200, "Calendar connected", "You're all set — Stellaforce can now help schedule interviews on your calendar. You can close this tab.")
}
