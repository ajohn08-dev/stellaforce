import { NextRequest, NextResponse } from "next/server"

import { createAdminClient } from "@/lib/supabase/admin"
import { encryptToken } from "@/lib/google-calendar/crypto"
import {
  decodeState,
  emailFromIdToken,
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

/**
 * One line per step so a failed connect can be pinned to a stage from the
 * Vercel runtime logs alone (filter on `calendar-oauth`). Deliberately never
 * carries the authorization code, any token, the client secret, or the full
 * signed state — only lengths, booleans, and already-known business
 * identifiers (the invited email is shown to the user on the mismatch screen
 * anyway, and is what makes a mismatch debuggable).
 */
type CallbackStep =
  | "state_validation"
  | "token_exchange"
  | "identity_lookup"
  | "email_match"
  | "invite_lookup"
  | "token_storage"
  | "connected"

function logStep(step: CallbackStep, ok: boolean, detail: Record<string, unknown> = {}) {
  const line = JSON.stringify({ tag: "calendar-oauth", step, ok, ...detail })
  if (ok) console.log(line)
  else console.error(line)
}

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
    logStep("state_validation", false, { googleError: error })
    return htmlResponse(400, "Calendar not connected", "Access was not granted, so nothing was connected.")
  }
  if (!code || !stateParam) {
    logStep("state_validation", false, {
      reason: "missing_params",
      hasCode: !!code,
      hasState: !!stateParam,
    })
    return htmlResponse(400, "Invalid request", "This link is missing required parameters.")
  }

  const state = decodeState(stateParam)
  if (!state) {
    // Signature mismatch or past `exp` — the token itself is never logged.
    logStep("state_validation", false, {
      reason: "invalid_or_expired",
      stateLength: stateParam.length,
    })
    return htmlResponse(400, "Link expired", "This connect link is invalid or has expired — ask your recruiter to resend it.")
  }
  const invitedEmail = state.email.trim().toLowerCase()
  logStep("state_validation", true, {
    invitedEmail,
    jobId: state.jobId,
    jobTeamMemberId: state.jobTeamMemberId,
  })

  let tokens
  try {
    tokens = await exchangeCode(code)
  } catch (err) {
    logStep("token_exchange", false, { error: err instanceof Error ? err.message : "unknown" })
    return htmlResponse(500, "Something went wrong", "We couldn't complete the connection. Please try again.")
  }
  logStep("token_exchange", true, {
    hasRefreshToken: !!tokens.refresh_token,
    hasIdToken: !!tokens.id_token,
    grantedScope: tokens.scope,
  })

  if (!tokens.refresh_token) {
    // Google only issues a refresh_token on the first consent (or with
    // prompt=consent, which we always send) — missing here means something's
    // off with the OAuth client config rather than a normal retry case.
    logStep("token_exchange", false, { reason: "no_refresh_token" })
    return htmlResponse(500, "Something went wrong", "We couldn't complete the connection. Please try again.")
  }

  // Prefer the ID token (already in hand, no extra network hop); fall back to
  // the userinfo endpoint. Both need the `openid`/`email` scopes — requesting
  // only `calendar.events` is what made this step fail with a 403 before.
  let authorizedEmail = emailFromIdToken(tokens.id_token)
  let identitySource = "id_token"
  if (!authorizedEmail) {
    try {
      authorizedEmail = await fetchAuthorizedEmail(tokens.access_token)
      identitySource = "userinfo"
    } catch (err) {
      logStep("identity_lookup", false, {
        reason: "userinfo_failed",
        idTokenUsable: false,
        hasIdToken: !!tokens.id_token,
        grantedScope: tokens.scope,
        error: err instanceof Error ? err.message : "unknown",
      })
      return htmlResponse(500, "Something went wrong", "We couldn't verify the connected account. Please try again.")
    }
  }
  logStep("identity_lookup", true, { identitySource, authorizedEmail })

  // Strict match, on trimmed + lowercased values only.
  if (authorizedEmail !== invitedEmail) {
    logStep("email_match", false, { invitedEmail, authorizedEmail })
    return htmlResponse(
      403,
      "Wrong account",
      `This invite was sent to ${state.email}, but you authorized with ${authorizedEmail}. Please retry using the ${state.email} Google account.`
    )
  }
  logStep("email_match", true, { invitedEmail })

  const admin = createAdminClient()

  // Non-blocking: a deleted/renamed invite row shouldn't void a valid consent,
  // but its absence explains later "who was this for" confusion.
  const { data: invite } = await admin
    .from("job_team_members")
    .select("id")
    .eq("id", state.jobTeamMemberId)
    .maybeSingle()
  logStep("invite_lookup", !!invite, {
    jobTeamMemberId: state.jobTeamMemberId,
    found: !!invite,
  })

  const { data: existing } = await admin
    .from("google_calendar_connections")
    .select("id")
    .ilike("email", invitedEmail)
    .maybeSingle()

  const { data: profileMatch } = await admin
    .from("profiles")
    .select("id")
    .ilike("email", invitedEmail)
    .maybeSingle()

  let row
  try {
    row = {
      email: invitedEmail,
      profile_id: profileMatch?.id ?? null,
      google_account_email: authorizedEmail,
      refresh_token_encrypted: encryptToken(tokens.refresh_token),
      scope: tokens.scope,
      connected_at: new Date().toISOString(),
      revoked_at: null,
    }
  } catch (err) {
    // A malformed/absent CALENDAR_TOKEN_ENCRYPTION_KEY lands here.
    logStep("token_storage", false, {
      reason: "encryption_failed",
      error: err instanceof Error ? err.message : "unknown",
    })
    return htmlResponse(500, "Something went wrong", "We couldn't complete the connection. Please try again.")
  }

  const { error: writeError } = existing
    ? await admin.from("google_calendar_connections").update(row).eq("id", existing.id)
    : await admin.from("google_calendar_connections").insert(row)

  if (writeError) {
    logStep("token_storage", false, {
      reason: "db_write_failed",
      mode: existing ? "update" : "insert",
      error: writeError.message,
    })
    return htmlResponse(500, "Something went wrong", "We couldn't save the connection. Please try again.")
  }
  logStep("token_storage", true, {
    mode: existing ? "update" : "insert",
    linkedProfile: !!profileMatch,
  })

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
    payload: { email: invitedEmail, job_team_member_id: state.jobTeamMemberId },
  })

  logStep("connected", true, { invitedEmail, jobId: state.jobId })
  return htmlResponse(200, "Calendar connected", "You're all set — Stellaforce can now help schedule interviews on your calendar. You can close this tab.")
}
