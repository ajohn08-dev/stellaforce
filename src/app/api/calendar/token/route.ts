import { NextRequest, NextResponse } from "next/server"

import { createAdminClient } from "@/lib/supabase/admin"
import { isN8nAuthorized } from "@/lib/server/n8n-auth"
import { decryptToken } from "@/lib/google-calendar/crypto"
import { refreshAccessToken } from "@/lib/google-calendar/oauth"
import { sendCalendarConnectInvite } from "@/lib/server/calendar-invite"

/**
 * POST /api/calendar/token
 *
 * Called by n8n right before it makes a Calendar API call on someone's
 * behalf. Mints and returns a short-lived access token — never the refresh
 * token — so n8n only ever holds a credential valid for ~1 hour, keeping the
 * long-lived secret (refresh token + Google client secret) inside the app's
 * server-only boundary. On a refresh failure (revoked/expired beyond
 * refresh), marks the connection broken and re-sends the connect invite
 * (reactive revocation handling — see docs/google-calendar-consent-plan.md).
 */
export const runtime = "nodejs"

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!isN8nAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 })
  }

  const email = (body as { email?: unknown })?.email
  if (typeof email !== "string" || !email.trim()) {
    return NextResponse.json({ ok: false, error: "email is required" }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: connection } = await admin
    .from("google_calendar_connections")
    .select("id, refresh_token_encrypted")
    .ilike("email", email)
    .is("revoked_at", null)
    .maybeSingle()

  if (!connection) {
    return NextResponse.json({ ok: false, error: "not_connected" }, { status: 404 })
  }

  try {
    const refreshed = await refreshAccessToken(decryptToken(connection.refresh_token_encrypted))
    return NextResponse.json({
      ok: true,
      access_token: refreshed.access_token,
      expires_in: refreshed.expires_in,
    })
  } catch (err) {
    console.error(`[calendar-token] refresh failed for ${email}`, err)

    await admin
      .from("google_calendar_connections")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", connection.id)

    const { data: lastMembership } = await admin
      .from("job_team_members")
      .select("id, job_id, name, role")
      .ilike("email", email)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    // activity_events requires at least one of candidate/job/application_id —
    // only log + re-invite when there's a job to scope it to.
    if (lastMembership) {
      await admin.from("activity_events").insert({
        event_type: "calendar_connection_revoked",
        job_id: lastMembership.job_id,
        actor_type: "system",
        system_source: "n8n:calendar_token_refresh",
        payload: { email },
      })

      await sendCalendarConnectInvite({
        email,
        name: lastMembership.name,
        jobId: lastMembership.job_id,
        jobTeamMemberId: lastMembership.id,
        reason: "reconnect",
        role: lastMembership.role,
      })
    }

    return NextResponse.json({ ok: false, error: "revoked" }, { status: 409 })
  }
}
