"use client"

import * as React from "react"
import { ArrowDownRight, ChevronDown, ChevronRight } from "lucide-react"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { automationModeLabel } from "@/lib/automation-events"
import { AutomationRuleFacets } from "@/components/automations/automation-rule-facets"
import { rulesForEventGroup, type AutomationRule } from "@/lib/automation-rules"

/**
 * The trigger list for one group, where each row opens the rule behind it.
 *
 * A trigger name on its own says when something happens and nothing about what
 * happens — which is the question anyone opening this page has. So the rows are
 * disclosures: one open at a time, showing the actions, the work it creates,
 * the SLA it moves, and what it does when it can't finish.
 */
export function AutomationRuleRows({ groupTitle }: { groupTitle: string }) {
  const rows = rulesForEventGroup(groupTitle)
  const [openId, setOpenId] = React.useState<string | null>(null)

  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">No triggers defined yet.</p>
  }

  return (
    <ul className="divide-y divide-border">
      {rows.map(({ id, label, rule }) => {
        const open = openId === id
        return (
          <li key={id}>
            <button
              type="button"
              onClick={() => setOpenId(open ? null : id)}
              aria-expanded={open}
              className="flex w-full items-center gap-2 py-2 text-left text-sm hover:text-foreground"
            >
              {open ? (
                <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
              ) : (
                <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
              )}
              <span className={cn("flex-1", open ? "font-medium text-foreground" : "text-muted-foreground")}>
                {label}
              </span>
              {rule && (
                <span className="shrink-0 text-xs text-muted-foreground">
                  {automationModeLabel(rule.mode)}
                </span>
              )}
            </button>

            {open && (
              <div className="pb-3 pl-5.5">
                {rule ? <RulePreview rule={rule} /> : <NoRuleYet />}
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}

/** Where this rule comes from — the same "From …" read the rest of the page uses for inherited values. */
function InheritedFromGlobal() {
  return (
    <Badge
      variant="outline"
      className="text-muted-foreground"
      title="Inherited from Stellaforce's global rule library"
    >
      <ArrowDownRight data-icon="inline-start" className="size-3" />
      From global library
    </Badge>
  )
}

function RulePreview({ rule }: { rule: AutomationRule }) {
  return (
    <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <InheritedFromGlobal />
        <span className="text-xs text-muted-foreground">
          Runs on {automationModeLabel(rule.mode).toLowerCase()}
        </span>
      </div>

      <AutomationRuleFacets rule={rule} />
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
