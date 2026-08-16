"use client"

import * as React from "react"
import { ChevronRight } from "lucide-react"
import { toast } from "sonner"

import { cn } from "@/lib/utils"
import { Label } from "@/components/ui/label"
import { AUTOMATION_EVENT_GROUPS } from "@/lib/automation-events"
import { Switch } from "@/components/ui/switch"

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

/** Unwired for now — clicking opens nothing, just signals the automation-rule builder is coming later. */
function AutomationEventRow({ label }: { label: string }) {
  return (
    <button
      type="button"
      onClick={() => toast.info("Not wired up yet — automation rules are coming soon.")}
      className="flex w-full items-center justify-between rounded-lg border border-border bg-white px-4 py-3 text-left text-sm hover:bg-muted/40"
    >
      {label}
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
    </button>
  )
}

/** Fields are unwired placeholders — not yet saved anywhere. */
export function WorkflowAiAutomationTab() {
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
      <div className="flex w-40 shrink-0 flex-col gap-1">
        {SUB_NAV_ITEMS.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setActiveSubNav(item)}
            className={cn(
              "rounded-md px-3 py-2 text-left text-sm",
              activeSubNav === item
                ? "bg-brand-orange-100 font-medium text-foreground"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
            )}
          >
            {item}
          </button>
        ))}
      </div>

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
                Define how you want your pipeline to run
              </p>
            </div>

            {AUTOMATION_EVENT_GROUPS.map((group) => (
              <div key={group.title} className="flex flex-col gap-2">
                <Label>{group.title}</Label>
                {group.events.map((event) => (
                  <AutomationEventRow key={event.id} label={event.label} />
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
