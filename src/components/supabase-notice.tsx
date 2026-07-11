import { isSupabaseConfigured } from "@/lib/env"

/**
 * Renders a setup hint when Supabase env vars aren't configured yet, so the app
 * is usable/explorable before the project is connected. Returns null once
 * configured.
 */
export function SupabaseNotice() {
  if (isSupabaseConfigured) return null
  return (
    <div className="rounded-lg border border-dashed border-border bg-muted/40 p-4 text-sm text-muted-foreground">
      <p className="font-medium text-foreground">Supabase not connected yet</p>
      <p className="mt-1">
        Add <code className="font-mono">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
        <code className="font-mono">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to{" "}
        <code className="font-mono">.env.local</code>, run the migrations in{" "}
        <code className="font-mono">supabase/migrations/</code>, then seed with{" "}
        <code className="font-mono">pnpm seed</code>. See the README.
      </p>
    </div>
  )
}
