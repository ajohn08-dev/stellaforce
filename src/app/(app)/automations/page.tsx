import { SetSidebarCollapsed } from "@/components/set-sidebar-collapsed"

/** Placeholder — the automation-rule builder isn't built yet (see `automation_rules` in DB_Schema.md). */
export default function AutomationsPage() {
  return (
    <div className="space-y-6 p-4">
      <SetSidebarCollapsed />
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Automations</h1>
        <p className="text-sm text-muted-foreground">
          Rules that move work forward on their own — what fires, when, and on which pipelines.
        </p>
      </div>

      <p className="text-sm text-muted-foreground">Automations are coming soon.</p>
    </div>
  )
}
