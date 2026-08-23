import { SetSidebarCollapsed } from "@/components/set-sidebar-collapsed"

/**
 * Placeholder. Users are still created by hand in the Supabase dashboard and
 * elevated there (see Auth in CLAUDE.md) — this is where that moves.
 */
export default function TeamAccessPage() {
  return (
    <div className="space-y-6 p-4">
      <SetSidebarCollapsed />
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Team Access</h1>
        <p className="text-sm text-muted-foreground">
          Who can sign in, and what each of them may do.
        </p>
      </div>

      <p className="text-sm text-muted-foreground">
        Team access is coming soon — for now, users and roles are managed in Supabase.
      </p>
    </div>
  )
}
