import "server-only"

import { createAdminClient } from "@/lib/supabase/admin"
import { decryptToken } from "@/lib/google-calendar/crypto"
import { refreshAccessToken } from "@/lib/google-calendar/oauth"

/**
 * Read-only availability preview for the job workspace's Team panel.
 *
 * Deliberately returns **busy intervals only — never event titles, attendees,
 * locations, or descriptions**. A recruiter needs to see when someone is free,
 * not what they're doing; titles are dropped here, server-side, so they never
 * reach the client bundle or React props.
 *
 * Google's `freeBusy` endpoint would be the natural fit, but it requires
 * `calendar.readonly`/`calendar.freebusy` (verified: it 403s with
 * ACCESS_TOKEN_SCOPE_INSUFFICIENT under our `calendar.events` scope), and
 * widening the scope would force every already-connected person to re-consent.
 * So this reads `events.list` and reduces to intervals, applying the same
 * busy rules free/busy would.
 *
 * n8n owns the *write* side of the Calendar API (creating/updating/cancelling
 * interview events at scheduling time — see
 * docs/google-calendar-consent-plan.md); this read stays in the app because it
 * backs a synchronous UI panel.
 *
 * `google_calendar_connections` is service-role only (encrypted refresh
 * tokens), hence the admin client — same justification as calendar-invite.ts.
 * The refresh token never leaves this module.
 */

export type CalendarBusyBlock = {
  /** ISO instant. All-day blocks are normalized to local-midnight bounds. */
  start: string
  end: string
  allDay: boolean
}

export type CalendarPreview =
  | { ok: true; busy: CalendarBusyBlock[]; windowDays: number }
  | { ok: false; code: "not_connected" | "revoked" | "failed"; error: string }

/**
 * Fetched window. The grid only renders 7 days, but slot suggestions can reach
 * further when few days are preferred (Fridays only → the next one may be 7+
 * days out). Fetching 14 keeps those suggestions grounded in real data instead
 * of treating unknown days as free and offering a slot on top of a meeting.
 */
const WINDOW_DAYS = 14

type GoogleEvent = {
  status?: string
  transparency?: string
  eventType?: string
  attendees?: { self?: boolean; responseStatus?: string }[]
  start?: { dateTime?: string; date?: string }
  end?: { dateTime?: string; date?: string }
}

/**
 * Mirrors how Google's own free/busy treats an event: cancelled events, events
 * explicitly marked "Free" (`transparency: transparent`), working-location
 * entries (the all-day "Home"/"Office" markers), and invitations this person
 * declined do not make them busy.
 */
function isBusy(event: GoogleEvent): boolean {
  if (event.status === "cancelled") return false
  if (event.transparency === "transparent") return false
  if (event.eventType === "workingLocation" || event.eventType === "birthday") return false
  const self = (event.attendees ?? []).find((a) => a.self)
  if (self?.responseStatus === "declined") return false
  return true
}

/** A date-only `YYYY-MM-DD` → that local day's midnight, avoiding the UTC shift. */
function localMidnight(dateOnly: string): string {
  const [y, m, d] = dateOnly.split("-").map(Number)
  return new Date(y, m - 1, d).toISOString()
}

/**
 * When one person is busy over the next {@link WINDOW_DAYS} days. Never throws
 * — every failure is a typed result the panel renders as text.
 */
export async function getCalendarPreview(email: string): Promise<CalendarPreview> {
  const normalized = email.trim().toLowerCase()
  try {
    const admin = createAdminClient()
    const { data: connection } = await admin
      .from("google_calendar_connections")
      .select("id, refresh_token_encrypted")
      .ilike("email", normalized)
      .is("revoked_at", null)
      .maybeSingle()

    if (!connection) {
      return { ok: false, code: "not_connected", error: "This person hasn't connected a calendar yet." }
    }

    let accessToken: string
    try {
      const refreshed = await refreshAccessToken(decryptToken(connection.refresh_token_encrypted))
      accessToken = refreshed.access_token
    } catch (err) {
      // Only an explicit invalid_grant means access was actually withdrawn — a
      // transient Google/network error must not revoke a good connection.
      const message = err instanceof Error ? err.message : ""
      if (message.includes("invalid_grant")) {
        await admin
          .from("google_calendar_connections")
          .update({ revoked_at: new Date().toISOString() })
          .eq("id", connection.id)
        console.error(`[calendar-preview] access revoked for ${normalized}`)
        return {
          ok: false,
          code: "revoked",
          error: "Calendar access was revoked — send them a new connect invite.",
        }
      }
      console.error(`[calendar-preview] token refresh failed for ${normalized}`, err)
      return { ok: false, code: "failed", error: "Could not reach Google Calendar. Please try again." }
    }

    const now = new Date()
    const params = new URLSearchParams({
      timeMin: now.toISOString(),
      timeMax: new Date(now.getTime() + WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString(),
      singleEvents: "true", // expand recurring series into individual instances
      orderBy: "startTime",
      maxResults: "250",
    })

    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )
    if (!res.ok) {
      console.error(`[calendar-preview] events.list responded ${res.status} for ${normalized}`)
      return { ok: false, code: "failed", error: "Google Calendar returned an error. Please try again." }
    }

    const data = (await res.json()) as { items?: GoogleEvent[] }
    const busy: CalendarBusyBlock[] = (data.items ?? [])
      .filter(isBusy)
      .map((e) => {
        const allDay = !e.start?.dateTime
        const start = e.start?.dateTime ?? (e.start?.date ? localMidnight(e.start.date) : "")
        const end = e.end?.dateTime ?? (e.end?.date ? localMidnight(e.end.date) : "")
        return { start, end, allDay }
      })
      .filter((b) => b.start !== "" && b.end !== "")

    return { ok: true, busy, windowDays: WINDOW_DAYS }
  } catch (err) {
    console.error(`[calendar-preview] failed for ${normalized}`, err)
    return { ok: false, code: "failed", error: "Could not load this calendar. Please try again." }
  }
}
