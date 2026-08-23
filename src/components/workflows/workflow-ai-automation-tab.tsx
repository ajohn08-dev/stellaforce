"use client"

import * as React from "react"

import { Label } from "@/components/ui/label"
import { AUTOMATION_SECTIONS } from "@/lib/automation-sections"
import { AutomationRuleRows } from "@/components/automations/automation-rule-rows"
import { Switch } from "@/components/ui/switch"
import { WorkflowSubNav } from "@/components/workflows/workflow-sub-nav"
import type { ResolvedAutomation } from "@/lib/automation-resolve"

const SUB_NAV_ITEMS = ["AI Capabilities", "SLA", "Automation"] as const
type SubNavItem = (typeof SUB_NAV_ITEMS)[number]

type ToggleRow = { key: string; label: string; description: string }

const AI_CAPABILITY_ROWS: ToggleRow[] = [
  {
    key: "suggest_questions",
    label: "Suggest interview questions",
    description: "Allow AI to suggest interview questions based on role competencies and stage context.",
  },
  {
    key: "summarize_interviews",
    label: "Summarize Interviews",
    description: "Allow AI to generate structured summaries from interview transcripts to support review.",
  },
]

const SLA_ROWS: ToggleRow[] = [
  { key: "needs_scheduling", label: "Needs Scheduling", description: "Stage interviews need to be scheduled" },
  { key: "needs_feedback", label: "Needs Feedback", description: "Awaiting all interview feedback" },
  { key: "needs_decision", label: "Needs Decision", description: "Candidate is awaiting an offer decision" },
  {
    key: "needs_offer_creation",
    label: "Needs Offer Creation",
    description: "Decision made, offer not yet created",
  },
  {
    key: "offer_needs_to_be_sent",
    label: "Offer needs to be sent",
    description: "Offer created, has not yet been sent",
  },
  { key: "offer_sent", label: "Offer sent", description: "Awaiting candidate decision on offer" },
  { key: "needs_attention", label: "Needs Attention", description: "No activity for some amount of time" },
]

function ToggleRowItem({
  row,
  checked,
  onCheckedChange,
}: {
  row: ToggleRow
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border py-4 first:pt-0 last:border-b-0">
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-medium text-foreground">{row.label}</span>
        <span className="text-sm text-muted-foreground">{row.description}</span>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} className="shrink-0" />
    </div>
  )
}

/** The rule categories, in the order the automations rail and job dialog use. */
const AUTOMATION_CATEGORIES = AUTOMATION_SECTIONS.filter((s) => s.eventGroup)

/**
 * AI Capabilities and SLA are still unwired placeholders — not saved anywhere.
 *
 * **Automation is real.** It shows this Flow's effective rules and where each
 * one's state was decided, resolved through `global → company → workflow`. It
 * previously listed trigger names that opened a "coming soon" toast, which told
 * you a rule might exist without saying whether it would run.
 *
 * Read-only here by design: the per-scope controls live on the job dialog,
 * where "pause this" has one unambiguous meaning. A control on this tab would
 * write a Flow-scoped binding affecting every job that runs it — a change worth
 * its own confirmation, not a segmented control.
 */
export function WorkflowAiAutomationTab({
  automations,
}: {
  automations: ResolvedAutomation[]
}) {
  const [activeSubNav, setActiveSubNav] = React.useState<SubNavItem>("AI Capabilities")
  const [toggles, setToggles] = React.useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {}
    for (const row of [...AI_CAPABILITY_ROWS, ...SLA_ROWS]) initial[row.key] = true
    return initial
  })

  function toggle(key: string, checked: boolean) {
    setToggles((prev) => ({ ...prev, [key]: checked }))
  }

  return (
    <div className="mx-auto flex h-full w-full max-w-4xl gap-8">
      <WorkflowSubNav items={SUB_NAV_ITEMS} value={activeSubNav} onValueChange={setActiveSubNav} />

      <div className="h-full min-w-0 flex-1 overflow-y-auto">
        {activeSubNav === "AI Capabilities" ? (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-0.5">
              <Label>Allowed AI capabilities in this pipeline</Label>
              <p className="text-sm text-muted-foreground">
                Enable which AI-powered assistance is allowed across stages in this pipeline.
              </p>
            </div>
            <div className="flex flex-col">
              {AI_CAPABILITY_ROWS.map((row) => (
                <ToggleRowItem
                  key={row.key}
                  row={row}
                  checked={toggles[row.key] ?? true}
                  onCheckedChange={(checked) => toggle(row.key, checked)}
                />
              ))}
            </div>
          </div>
        ) : activeSubNav === "SLA" ? (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-0.5">
              <Label>Service-Level Agreements</Label>
              <p className="text-sm text-muted-foreground">
                Pipeline specific SLAs will override Global SLAs
              </p>
            </div>
            <div className="flex flex-col">
              {SLA_ROWS.map((row) => (
                <ToggleRowItem
                  key={row.key}
                  row={row}
                  checked={toggles[row.key] ?? true}
                  onCheckedChange={(checked) => toggle(row.key, checked)}
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-0.5">
              <Label>Automation</Label>
              <p className="text-sm text-muted-foreground">
                What runs on this pipeline, and where each rule was decided.
                Rules inherit from the global library unless this workflow or an
                individual job overrides them.
              </p>
            </div>

            {AUTOMATION_CATEGORIES.map((category) => {
              const rows = automations.filter((a) => a.category === category.key)
              if (rows.length === 0) return null
              return (
                <div key={category.key} className="flex flex-col gap-2">
                  <Label>{category.label}</Label>
                  <AutomationRuleRows automations={rows} />
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
