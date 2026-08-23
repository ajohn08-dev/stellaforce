"use client"

import * as React from "react"
import { ArrowDownRight, ChevronDown, ChevronRight } from "lucide-react"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { automationModeLabel } from "@/lib/automation-events"
import { AutomationRuleFacets } from "@/components/automations/automation-rule-facets"
import { AutomationStateSubtext } from "@/components/automations/automation-state-subtext"
import type { ResolvedAutomation } from "@/lib/automation-resolve"

/**
 * A list of automations where each row opens the rule behind it.
 *
 * A trigger name on its own says when something happens and nothing about what
 * happens — which is the question anyone opening this page has. So the rows are
 * disclosures: one open at a time, showing the actions, the work it creates,
 * the SLA it moves, and what it does when it can't finish.
 *
 * Read-only. The controls live on the job dialog, where a change means
 * something specific ("for this job"); a control here would have to ask which
 * scope you meant.
 */
export function AutomationRuleRows({
  automations,
}: {
  automations: ResolvedAutomation[]
}) {
  const [openId, setOpenId] = React.useState<string | null>(null)

  if (automations.length === 0) {
    return <p className="text-sm text-muted-foreground">No triggers defined yet.</p>
  }

  return (
    <ul className="divide-y divide-border">
      {automations.map((automation) => {
        const open = openId === automation.definitionId
        return (
          <li key={automation.definitionId}>
            <button
              type="button"
              onClick={() => setOpenId(open ? null : automation.definitionId)}
              aria-expanded={open}
              className="flex w-full items-center gap-2 py-2 text-left text-sm hover:text-foreground"
            >
              {open ? (
                <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
              ) : (
                <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
              )}
              <span className="flex min-w-0 flex-1 flex-col">
                <span
                  className={cn(
                    "truncate",
                    open ? "font-medium text-foreground" : "text-muted-foreground"
                  )}
                >
                  {automation.name}
                </span>
                <AutomationStateSubtext automation={automation} />
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {automationModeLabel(automation.defaultMode)}
              </span>
            </button>

            {open && (
              <div className="pb-3 pl-5.5">
                {automation.isApplicable ? (
                  <RulePreview automation={automation} />
                ) : (
                  <NoRuleYet />
                )}
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}

/**
 * Where this rule's state came from — the same "From …" read the rest of the
 * app uses for inherited values.
 *
 * This used to be hardcoded to "From global library" on every row, which was
 * true only because nothing had been overridden yet. It now names the layer the
 * resolver actually picked, so a workflow that paused a rule says so here.
 */
function InheritedFrom({ automation }: { automation: ResolvedAutomation }) {
  const { scope, label } = automation.stateSource
  return (
    <Badge
      variant="outline"
      className="text-muted-foreground"
      title={
        scope === "global"
          ? "Inherited from Stellaforce's global rule library"
          : `Set at ${label}`
      }
    >
      <ArrowDownRight data-icon="inline-start" className="size-3" />
      {scope === "job" ? "Set for this job" : `From ${label}`}
    </Badge>
  )
}

function RulePreview({ automation }: { automation: ResolvedAutomation }) {
  return (
    <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <InheritedFrom automation={automation} />
        <span className="text-xs text-muted-foreground">
          {automation.defaultMode === "auto"
            ? "Runs automatically"
            : "Asks for approval first"}
        </span>
      </div>

      <AutomationRuleFacets automation={automation} />
    </div>
  )
}

function NoRuleYet() {
  return (
    <div className="rounded-lg border border-dashed border-border p-3">
      <p className="text-sm text-muted-foreground">
        Nothing runs on this trigger yet.
      </p>
    </div>
  )
}
