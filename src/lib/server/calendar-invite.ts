import "server-only"

import { createAdminClient } from "@/lib/supabase/admin"
import { serverEnv } from "@/lib/env"
import { buildAuthUrl } from "@/lib/google-calendar/oauth"

/**
 * `google_calendar_connections` has no RLS policy for `authenticated` (it
 * holds encrypted refresh tokens — service-role only, see the migration), so
 * this always reads/writes through the admin client, even though callers are
 * normal recruiter-session Server Actions. Same category of narrow, justified
 * admin-client use as candidate-ingest.ts.
 */

export type CalendarInviteInput = {
  email: string
  name: string
  jobId: string
  jobTeamMemberId: string
}

/**
 * Sends the "connect your Google Calendar" invite via n8n, unless this person
 * already has an active connection (per-person, reused across jobs — a no-op
 * in that case, not a resend). Best-effort: never blocks the caller (adding a
 * team member should succeed even if n8n/email is down).
 */
export async function sendCalendarConnectInvite(input: CalendarInviteInput): Promise<void> {
  try {
    const admin = createAdminClient()
    const { data: existing } = await admin
      .from("google_calendar_connections")
      .select("id, revoked_at")
      .ilike("email", input.email)
      .is("revoked_at", null)
      .maybeSingle()

    if (existing) return // already connected — no invite needed

    const connectUrl = buildAuthUrl({
      email: input.email,
      jobId: input.jobId,
      jobTeamMemberId: input.jobTeamMemberId,
    })

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15_000)
    const res = await fetch(serverEnv.n8nCalendarWebhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serverEnv.n8nWebhookSecret}`,
      },
      body: JSON.stringify({
        email: input.email,
        name: input.name,
        job_id: input.jobId,
        connect_url: connectUrl,
      }),
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout))

    if (!res.ok) {
      console.error(`[calendar-invite] n8n webhook responded ${res.status}`)
    }
  } catch (err) {
    console.error("[calendar-invite] failed to send connect invite", err)
  }
}
