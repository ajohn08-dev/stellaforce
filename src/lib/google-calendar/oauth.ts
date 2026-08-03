import "server-only"

import { createHmac, timingSafeEqual } from "node:crypto"

import { serverEnv } from "@/lib/env"

export const GOOGLE_CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events"

const STATE_TTL_SECONDS = 7 * 24 * 60 * 60 // a week — long enough to sit in an inbox

export type ConnectState = {
  email: string
  jobId: string
  jobTeamMemberId: string
  exp: number
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url")
}

function sign(payload: string): string {
  return createHmac("sha256", serverEnv.calendarStateSecret).update(payload).digest("base64url")
}

/** Signs an opaque `state` token — no DB row needed to track a pending consent link. */
export function encodeState(state: Omit<ConnectState, "exp">): string {
  const payload: ConnectState = { ...state, exp: Math.floor(Date.now() / 1000) + STATE_TTL_SECONDS }
  const body = base64url(JSON.stringify(payload))
  return `${body}.${sign(body)}`
}

/** Verifies signature + expiry. Returns null if the state is invalid, tampered, or expired. */
export function decodeState(token: string): ConnectState | null {
  const [body, sig] = token.split(".")
  if (!body || !sig) return null

  const expected = sign(body)
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as ConnectState
    if (typeof payload.exp !== "number" || payload.exp < Math.floor(Date.now() / 1000)) return null
    if (!payload.email || !payload.jobId || !payload.jobTeamMemberId) return null
    return payload
  } catch {
    return null
  }
}

function redirectUri(): string {
  return `${serverEnv.siteUrl}/api/calendar/oauth/callback`
}

/** The full Google consent-screen URL to send in the invite email. */
export function buildAuthUrl(state: Omit<ConnectState, "exp">): string {
  const params = new URLSearchParams({
    client_id: serverEnv.googleClientId,
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: GOOGLE_CALENDAR_SCOPE,
    access_type: "offline",
    prompt: "consent", // force a refresh_token on every grant, even for a re-auth
    state: encodeState(state),
  })
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
}

type GoogleTokenResponse = {
  access_token: string
  refresh_token?: string
  expires_in: number
  scope: string
  token_type: string
}

async function postToken(body: Record<string, string>): Promise<GoogleTokenResponse> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => "")
    throw new Error(`Google token endpoint responded ${res.status}: ${detail}`)
  }
  return res.json() as Promise<GoogleTokenResponse>
}

/** Authorization-code exchange, right after the OAuth callback fires. */
export function exchangeCode(code: string) {
  return postToken({
    code,
    client_id: serverEnv.googleClientId,
    client_secret: serverEnv.googleClientSecret,
    redirect_uri: redirectUri(),
    grant_type: "authorization_code",
  })
}

/** Mints a short-lived access token from a stored refresh token, for n8n to use in one Calendar API call. */
export function refreshAccessToken(refreshToken: string) {
  return postToken({
    refresh_token: refreshToken,
    client_id: serverEnv.googleClientId,
    client_secret: serverEnv.googleClientSecret,
    grant_type: "refresh_token",
  })
}

/** The email of the Google account that just authorized — compared against the invited email. */
export async function fetchAuthorizedEmail(accessToken: string): Promise<string> {
  const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error(`Google userinfo endpoint responded ${res.status}`)
  const data = (await res.json()) as { email?: string }
  if (!data.email) throw new Error("Google userinfo response had no email.")
  return data.email
}
