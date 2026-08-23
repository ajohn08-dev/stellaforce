import { SetSidebarCollapsed } from "@/components/set-sidebar-collapsed"

/** Placeholder — the global defaults above every workflow's Communication tab (src/lib/communication-policy.ts). */
export default function CommunicationsPage() {
  return (
    <div className="space-y-6 p-4">
      <SetSidebarCollapsed />
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Communications</h1>
        <p className="text-sm text-muted-foreground">
          Templates and org-wide defaults for what candidates and interviewers are sent.
        </p>
      </div>

      <p className="text-sm text-muted-foreground">Communications are coming soon.</p>
    </div>
  )
}
