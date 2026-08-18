"use client"

import { draftKey } from "@/lib/company-draft-keys"
import * as React from "react"
import { ChevronDown, Lock, Quote } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import {
  EditableText,
  EditableTextarea,
} from "@/components/companies/shared/editable-field"
import { TrustWarning } from "@/components/companies/shared/trust-warning"
import { VisibilitySentence } from "@/components/companies/shared/visibility-sentence"
import { useDraftField } from "@/components/companies/company-draft-context"
import { useFieldScope } from "@/components/companies/shared/field-scope"
import type { AgentUse, Clearance } from "@/lib/company-visibility"
import {
  IMMIGRATION_VALUE_AGENT_BEHAVIOR,
  IMMIGRATION_VALUE_LABELS,
  UNKNOWN_FALLBACK,
  type ImmigrationValue,
  type PolicyItem,
} from "@/lib/mock-companies"

const IMMIGRATION_ORDER: ImmigrationValue[] = [
  "confirmed_yes",
  "confirmed_no",
  "role_dependent",
  "case_by_case",
  "unknown",
  "restricted",
]

const VALUE_STYLES: Record<ImmigrationValue, string> = {
  confirmed_yes:
    "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  confirmed_no: "bg-muted text-muted-foreground",
  role_dependent: "bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300",
  case_by_case: "bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300",
  unknown: "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
  restricted: "bg-destructive/10 text-destructive",
}

/**
 * One policy, editable, with **the exact sentence a candidate would hear**
 * underneath it.
 *
 * Showing the output rather than only the setting is the point. A recruiter can
 * check the wording is accurate and on-brand without simulating the agent in
 * their head — and when a value is unknown, they see the literal fallback the
 * candidate gets, which is far more convincing than the word "unknown".
 */
export function PolicyRow({
  policy,
  today,
}: {
  policy: PolicyItem
  today: Date
}) {
  const [expanded, setExpanded] = React.useState(false)
  const scope = useFieldScope(policy.label)

  const [clearance, setAudience] = useDraftField(
    draftKey.policyVisibility(policy.id) + "-clearance",
    policy.visibility.clearance,
    scope
  ) as readonly [Clearance, (v: Clearance) => void]
  const [agentUse, setAgentUse] = useDraftField(
    draftKey.policyVisibility(policy.id) + "-agent-use",
    policy.visibility.agentUse ?? "",
    scope
  ) as readonly [string, (v: string) => void]
  const [immigrationValue, setImmigrationValue] = useDraftField(
    draftKey.policy(policy.id, "value"),
    policy.immigrationValue ?? "",
    scope
  ) as readonly [string, (v: string) => void]

  // Every flag reads the **edited** value, not the stored one. Deriving
  // `isUnknown` from the prop while `isRestricted` came from state meant
  // switching a policy to Unknown left the old candidate-facing sentence on
  // screen — defeating the one thing this row exists to show.
  const isImmigration = Boolean(policy.immigrationValue)
  const isUnknown = immigrationValue === "unknown"
  const isRestricted = clearance === "restricted"
  const isInternal = clearance === "recruiters_only"
  const notEntered = !policy.value && !policy.immigrationValue

  return (
    <div className="space-y-2 px-4 py-3">
      <div className="grid gap-1 sm:grid-cols-[13rem_minmax(0,1fr)] sm:items-start sm:gap-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {policy.label}
        </div>

        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            {isImmigration ? (
              <ImmigrationValuePicker
                selected={immigrationValue as ImmigrationValue}
                onSelect={setImmigrationValue}
              />
            ) : (
              <EditableText
                fieldKey={draftKey.policy(policy.id, "value")}
                value={policy.value}
                placeholder="Not yet entered"
                ariaLabel={policy.label}
                className="flex-1"
              />
            )}
          </div>

          {isImmigration && (
            <p className="text-xs text-muted-foreground">
              {IMMIGRATION_VALUE_AGENT_BEHAVIOR[immigrationValue as ImmigrationValue]}
            </p>
          )}

          {isUnknown ? (
            <p className="flex items-start gap-2 rounded-md bg-amber-50 p-2.5 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
              <Quote className="mt-0.5 size-3 shrink-0" />
              <span>
                {UNKNOWN_FALLBACK}
                <span className="mt-1 block text-xs opacity-80">
                  Fixed wording — not editable while this policy is unconfirmed.
                </span>
              </span>
            </p>
          ) : isRestricted || isInternal ? (
            <p
              className={cn(
                "flex items-center gap-2 rounded-md p-2.5 text-xs",
                isRestricted
                  ? "bg-destructive/[0.06] text-destructive"
                  : "bg-muted text-muted-foreground"
              )}
            >
              <Lock className="size-3 shrink-0" />
              {isRestricted
                ? "The agent won't acknowledge this detail. It escalates instead."
                : "Recruiters only — no agent receives this, so there's nothing for a candidate to hear."}
            </p>
          ) : notEntered ? (
            <p className="rounded-md border border-dashed border-border p-2.5 text-xs text-muted-foreground">
              Nothing entered yet, so the agent has nothing to say here. &ldquo;Not
              entered&rdquo; and &ldquo;not offered&rdquo; are different answers — set
              the value either way.
            </p>
          ) : (
            <div className="space-y-1">
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Quote className="size-3 shrink-0" />
                What a candidate hears
              </p>
              <EditableTextarea
                fieldKey={draftKey.policy(policy.id, "spoken")}
                value={policy.candidateFacingText}
                placeholder="Write the sentence the agent should say"
                label={`${policy.label} wording`}
                ariaLabel={`What a candidate hears about ${policy.label}`}
                rows={2}
              />
            </div>
          )}

          <TrustWarning item={policy} today={today} />

          {expanded && (
            <VisibilitySentence
              clearance={clearance}
              agentUse={(agentUse || null) as AgentUse | null}
              onChange={(next) => {
                setAudience(next.clearance)
                setAgentUse(next.agentUse ?? "")
              }}
            />
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded((v) => !v)}
            className="-ml-2 h-auto px-2 py-0.5 text-xs text-muted-foreground"
          >
            {expanded ? "Hide" : "How far this travels"}
          </Button>
        </div>
      </div>
    </div>
  )
}

function ImmigrationValuePicker({
  selected,
  onSelect,
}: {
  selected: ImmigrationValue
  onSelect: (value: ImmigrationValue) => void
}) {
  const [open, setOpen] = React.useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button variant="ghost" size="sm" className="-ml-2 h-auto px-1.5 py-0.5">
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                VALUE_STYLES[selected]
              )}
            >
              {IMMIGRATION_VALUE_LABELS[selected]}
              <ChevronDown className="size-3" />
            </span>
          </Button>
        }
      />
      <PopoverContent align="start" className="w-80">
        <p className="text-xs font-medium text-muted-foreground">
          Every immigration policy needs an explicit value
        </p>
        <div className="space-y-0.5">
          {IMMIGRATION_ORDER.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => {
                onSelect(v)
                setOpen(false)
              }}
              className={cn(
                "flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-muted",
                selected === v && "bg-muted"
              )}
            >
              <span
                className={cn(
                  "mt-1.5 size-2 shrink-0 rounded-full",
                  selected === v ? "bg-primary" : "bg-border"
                )}
              />
              <span className="min-w-0">
                <span className="block text-sm font-medium">
                  {IMMIGRATION_VALUE_LABELS[v]}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {IMMIGRATION_VALUE_AGENT_BEHAVIOR[v]}
                </span>
              </span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
