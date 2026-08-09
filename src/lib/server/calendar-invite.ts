import "server-only"

import { createAdminClient } from "@/lib/supabase/admin"
import { serverEnv } from "@/lib/env"
import { buildAuthUrl, STATE_TTL_SECONDS } from "@/lib/google-calendar/oauth"

/**
 * `google_calendar_connections` has no RLS policy for `authenticated` (it
 * holds encrypted refresh tokens — service-role only, see the migration), so
 * this always reads/writes through the admin client, even though callers are
 * normal recruiter-session Server Actions. Same category of narrow, justified
 * admin-client use as candidate-ingest.ts.
 */

/**
 * Which of the three triggers fired this invite. n8n switches the email copy on
 * it: `added` (first-time, on join), `resend` (recruiter clicked Resend in the
 * Team dialog), `reconnect` (a Calendar API call failed — access was revoked).
 */
export type CalendarInviteReason = "added" | "resend" | "reconnect"

export type CalendarInviteInput = {
  email: string
  name: string
  jobId: string
  jobTeamMemberId: string
  /** Defaults to `added`. */
  reason?: CalendarInviteReason
  role?: string | null
  /** The recruiter who triggered it — becomes the email's Reply-To. */
  sentBy?: { name: string; email: string } | null
}

export type CalendarInviteResult =
  | { ok: true }
  | {
      ok: false
      code: "already_connected" | "not_configured" | "webhook_failed"
      error: string
    }

/**
 * Sends the "connect your Google Calendar" invite via n8n, unless this person
 * already has an active connection (per-person, reused across jobs — a no-op
 * in that case, not a resend).
 *
 * Never throws: the add/reconnect callers are best-effort (adding a team member
 * should succeed even if n8n/email is down) and ignore the return value. The
 * recruiter-initiated resend action reads it so its toast reflects what
 * actually happened.
 */
export async function sendCalendarConnectInvite(
  input: CalendarInviteInput
): Promise<CalendarInviteResult> {
  try {
    const admin = createAdminClient()
    const { data: existing } = await admin
      .from("google_calendar_connections")
      .select("id, revoked_at")
      .ilike("email", input.email)
      .is("revoked_at", null)
      .maybeSingle()

    if (existing) {
      return {
        ok: false,
        code: "already_connected",
        error: `${input.name} has already connected their calendar.`,
      }
    }

    // Job/client context so the email can name the role the person is being
    // asked to interview for — best-effort, the invite still sends without it.
    const { data: job } = await admin
      .from("job_orders")
      .select("title, clients(client_name)")
      .eq("job_id", input.jobId)
      .maybeSingle()

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
        reason: input.reason ?? "added",
        email: input.email,
        name: input.name,
        role: input.role ?? null,
        job_id: input.jobId,
        job_title: job?.title ?? null,
        client_name: job?.clients?.client_name ?? null,
        team_member_id: input.jobTeamMemberId,
        connect_url: connectUrl,
        connect_url_expires_at: new Date(
          Date.now() + STATE_TTL_SECONDS * 1000
        ).toISOString(),
        sent_by_name: input.sentBy?.name ?? null,
        sent_by_email: input.sentBy?.email ?? null,
      }),
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout))

    if (!res.ok) {
      console.error(`[calendar-invite] n8n webhook responded ${res.status}`)
      return {
        ok: false,
        code: "webhook_failed",
        error: `The invite service responded ${res.status}. Please try again.`,
      }
    }

    return { ok: true }
  } catch (err) {
    // Also the path for a missing N8N_CALENDAR_WEBHOOK_URL / SITE_URL, since
    // serverEnv throws on access — hence the "not configured" wording.
    console.error("[calendar-invite] failed to send connect invite", err)
    return {
      ok: false,
      code: "not_configured",
      error: "Could not reach the invite service — check the n8n calendar webhook config.",
    }
  }
}
