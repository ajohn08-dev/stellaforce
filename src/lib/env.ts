/**
 * Centralized, validated access to environment variables.
 *
 * - `NEXT_PUBLIC_*` values are safe for the browser bundle.
 * - `SUPABASE_SERVICE_ROLE_KEY` and `ANTHROPIC_API_KEY` are SERVER ONLY. Importing
 *   `serverEnv` from a Client Component will throw at build/runtime — keep them in
 *   Server Components, Server Actions, and route handlers only.
 */

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. See .env.example.`
    )
  }
  return value
}

/** Public config — safe to reference from client or server code. */
export const publicEnv = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
}

/**
 * Server-only secrets. Access lazily via getters so that merely importing this
 * module in shared code doesn't throw before values are actually needed.
 */
export const serverEnv = {
  get supabaseUrl() {
    return required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL)
  },
  get supabaseServiceRoleKey() {
    return required(
      "SUPABASE_SERVICE_ROLE_KEY",
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )
  },
  get anthropicApiKey() {
    return required("ANTHROPIC_API_KEY", process.env.ANTHROPIC_API_KEY)
  },
  get n8nWebhookUrl() {
    return required("N8N_WEBHOOK_URL", process.env.N8N_WEBHOOK_URL)
  },
  get n8nWebhookSecret() {
    return required("N8N_WEBHOOK_SECRET", process.env.N8N_WEBHOOK_SECRET)
  },
  /** n8n "AI job intake" webhook — turns the Add-Job inputs into a structured
   * role/competencies/scorecard draft. Overridable via env; defaults to the
   * configured Stellaforce n8n instance. */
  get n8nJobWebhookUrl() {
    return (
      process.env.N8N_JOB_WEBHOOK_URL ??
      "https://ajzenarate.app.n8n.cloud/webhook/1ef95b54-f506-4007-a2c2-7d2af8ba9400"
    )
  },
  /** n8n "generate-competencies" webhook — turns a job's role definition into
   * evaluation-criteria competencies. Overridable via env. */
  get n8nCompetenciesWebhookUrl() {
    return (
      process.env.N8N_COMPETENCIES_WEBHOOK_URL ??
      "https://ajzenarate.app.n8n.cloud/webhook/ff025819-345f-4c82-af6b-1ed7a0d6ac2e"
    )
  },
  /** n8n "generate-scorecard" webhook — groups a job's competencies into
   * weighted scorecard categories. Overridable via env. */
  get n8nScorecardWebhookUrl() {
    return (
      process.env.N8N_SCORECARD_WEBHOOK_URL ??
      "https://ajzenarate.app.n8n.cloud/webhook/4a43602f-f2cc-41bf-b2db-ac1862f6c5ba"
    )
  },
  /** n8n "calendar connect invite" webhook — sends the "connect your Google
   * Calendar" email when a team member is added to a job. */
  get n8nCalendarWebhookUrl() {
    return required("N8N_CALENDAR_WEBHOOK_URL", process.env.N8N_CALENDAR_WEBHOOK_URL)
  },
  /** n8n "voice agent test call" webhook — places an outbound test call for a
   * screening agent's "test run" button. Overridable via env. */
  get n8nVoiceTestCallWebhookUrl() {
    return (
      process.env.N8N_VOICE_TEST_CALL_WEBHOOK_URL ??
      "https://ajzenarate.app.n8n.cloud/webhook/705a47f9-d16a-4918-9613-fd98ca1f5cdf"
    )
  },
  get googleClientId() {
    return required("GOOGLE_CLIENT_ID", process.env.GOOGLE_CLIENT_ID)
  },
  get googleClientSecret() {
    return required("GOOGLE_CLIENT_SECRET", process.env.GOOGLE_CLIENT_SECRET)
  },
  /** 32-byte (base64 or hex) key for AES-256-GCM encryption of stored Google
   * OAuth refresh tokens. Generate with `openssl rand -base64 32`. */
  get calendarTokenEncryptionKey() {
    return required(
      "CALENDAR_TOKEN_ENCRYPTION_KEY",
      process.env.CALENDAR_TOKEN_ENCRYPTION_KEY
    )
  },
  /** Signing key for the OAuth `state` param (HMAC) — separate from the token
   * encryption key so rotating one doesn't invalidate the other. */
  get calendarStateSecret() {
    return required("CALENDAR_STATE_SECRET", process.env.CALENDAR_STATE_SECRET)
  },
  /** Absolute site origin (no trailing slash) — needed server-side to build
   * the Google OAuth redirect_uri and links embedded in outbound emails. */
  get siteUrl() {
    return required("SITE_URL", process.env.SITE_URL)
  },
}

/** True when the public Supabase config is present (used to guard demo UI). */
export const isSupabaseConfigured =
  !!publicEnv.supabaseUrl && !!publicEnv.supabaseAnonKey
