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
}

/** True when the public Supabase config is present (used to guard demo UI). */
export const isSupabaseConfigured =
  !!publicEnv.supabaseUrl && !!publicEnv.supabaseAnonKey
