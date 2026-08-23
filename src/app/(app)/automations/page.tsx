import { Suspense } from "react"

import { SetSidebarCollapsed } from "@/components/set-sidebar-collapsed"
import { AutomationToolbar } from "@/components/automations/automation-toolbar"
import { AutomationSectionNav } from "@/components/automations/automation-section-nav"
import { AutomationRuleRows } from "@/components/automations/automation-rule-rows"
import { findAutomationSection } from "@/lib/automation-sections"

/**
 * Placeholder — the automation-rule builder isn't built yet (see
 * `automation_rules` in DB_Schema.md), so the toolbar and rail drive an empty
 * list. Same shell as `/jobs` and `/companies`: a bordered toolbar strip, then
 * a body that scrolls on its own; `?section=` drives the rail, so every
 * section is deep-linkable.
 */
export default async function AutomationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = await searchParams
  const q = (typeof sp.q === "string" ? sp.q : "").trim()
  const section = findAutomationSection(typeof sp.section === "string" ? sp.section : undefined)

  return (
    <div
      className="flex flex-col overflow-hidden"
      // Inline style, not an arbitrary Tailwind class: <main> has no padding of
      // its own, so only the app header (h-14 = 3.5rem) needs subtracting.
      style={{ height: "calc(100vh - 3.5rem)" }}
    >
      <SetSidebarCollapsed />

      <div className="shrink-0 border-b border-border px-4 py-4">
        {/* useSearchParams needs a Suspense boundary to keep this route static. */}
        <Suspense fallback={<div className="h-9" />}>
          <AutomationToolbar />
        </Suspense>
      </div>

      <div className="flex min-h-0 flex-1 gap-6 p-4">
        <Suspense fallback={<div className="w-56 shrink-0" />}>
          <AutomationSectionNav active={section.key} />
        </Suspense>

        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-0.5">
              <h2 className="text-sm font-medium text-foreground">{section.label}</h2>
              <p className="text-sm text-muted-foreground">{section.purpose}</p>
            </div>

            <div className="flex flex-col items-center gap-1 rounded-lg border border-dashed border-border p-8 text-center">
              <p className="text-sm font-medium text-foreground">
                {q ? `No automations match “${q}”` : "No automations here yet"}
              </p>
              <p className="text-sm text-muted-foreground">
                {section.key === "runs"
                  ? "Runs appear here once an automation has fired."
                  : "Rules you add to this section will be listed here."}
              </p>
            </div>

            {/* The rules this section can run — the same vocabulary the
                workflow settings tab offers, so what's listed here is what's
                actually pickable there. Each row opens what the rule does. */}
            {section.eventGroup && (
              <div className="flex flex-col gap-2">
                <p className="text-sm font-medium text-foreground">Rules available here</p>
                <AutomationRuleRows groupTitle={section.eventGroup} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
