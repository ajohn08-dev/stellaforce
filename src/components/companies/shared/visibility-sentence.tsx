"use client"

import * as React from "react"
import { ChevronDown, Eye, EyeOff, Lock, Users } from "lucide-react"

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import {
  AGENT_USE_HELP,
  AGENT_USE_ORDER,
  CLEARANCE_HELP,
  CLEARANCE_LABELS,
  CLEARANCE_ORDER,
  CLEARANCE_QUESTION,
  type AgentUse,
  type Clearance,
} from "@/lib/company-visibility"

/**
 * Visibility as one readable sentence rather than two chips.
 *
 * The old pair of badges — "Candidate-safe" + "Answer only if asked" — required
 * translating jargon into a consequence before you knew what would happen. Here
 * the sentence *is* the consequence, and the two dropdowns are the words inside
 * it, so setting and effect are the same object.
 *
 * The first clause is a **clearance level**, not a statement about who's looking
 * at a screen: candidates have no login, and the only thing that ever speaks to
 * them is an agent. An earlier version said "Candidates can see this", which
 * described something that doesn't exist.
 *
 * The second clause only exists once an item is cleared for candidates, because
 * "how may the agent use this?" is meaningless for something the agent never
 * receives.
 */

const CLEARANCE_CLAUSE: Record<Clearance, string> = CLEARANCE_LABELS

const AGENT_CLAUSE: Record<AgentUse, string> = {
  proactive: "the agent brings it up",
  on_request: "the agent answers only if asked",
  reference_only: "the agent uses it silently, never quotes it",
  escalate: "the agent always hands it to you",
}

const CLEARANCE_ICONS: Record<Clearance, typeof Users> = {
  cleared_for_candidates: Users,
  recruiters_only: EyeOff,
  restricted: Lock,
}

export function VisibilitySentence({
  clearance,
  agentUse,
  onChange,
  readOnly = false,
  audienceNote,
  className,
}: {
  clearance: Clearance
  agentUse: AgentUse | null
  onChange?: (next: { clearance: Clearance; agentUse: AgentUse | null }) => void
  readOnly?: boolean
  /**
   * Narrows who "candidates" means for this item — "on 1 role", "on no role
   * yet". Team knowledge only reaches candidates screening for a role beneath
   * it, so the unqualified sentence overstates the audience.
   */
  audienceNote?: string
  className?: string
}) {
  const Icon = CLEARANCE_ICONS[clearance]
  const escalating = clearance === "cleared_for_candidates" && agentUse === "escalate"

  const tone =
    // Restricted is the strictest rung, not a failure. The lock icon carries
    // it; red is reserved for a check that actually fails.
    clearance === "restricted"
      ? "text-muted-foreground"
      : escalating
        ? "text-amber-800 dark:text-amber-300"
        : clearance === "recruiters_only"
          ? "text-muted-foreground"
          : "text-emerald-800 dark:text-emerald-300"

  return (
    <p
      className={cn(
        "flex flex-wrap items-center gap-x-1 gap-y-0.5 text-sm leading-6",
        tone,
        className
      )}
    >
      <Icon className="size-3.5 shrink-0" />

      <Clause
        label={CLEARANCE_CLAUSE[clearance]}
        readOnly={readOnly}
        heading={CLEARANCE_QUESTION}
        options={CLEARANCE_ORDER.map((v) => ({
          value: v,
          label: CLEARANCE_CLAUSE[v],
          help: CLEARANCE_HELP[v],
          selected: clearance === v,
        }))}
        onSelect={(v) =>
          onChange?.({
            clearance: v as Clearance,
            agentUse:
              v === "cleared_for_candidates" ? (agentUse ?? "on_request") : null,
          })
        }
      />

      {clearance === "cleared_for_candidates" && audienceNote && (
        <span className="opacity-80">{audienceNote}</span>
      )}

      {clearance === "cleared_for_candidates" && agentUse ? (
        <>
          <span>, and</span>
          <Clause
            label={AGENT_CLAUSE[agentUse]}
            readOnly={readOnly}
            heading="How the agent uses it"
            options={AGENT_USE_ORDER.map((v) => ({
              value: v,
              label: AGENT_CLAUSE[v],
              help: AGENT_USE_HELP[v],
              selected: agentUse === v,
            }))}
            onSelect={(v) => onChange?.({ clearance, agentUse: v as AgentUse })}
          />
        </>
      ) : clearance === "recruiters_only" ? (
        <span className="opacity-80">— the agent never receives it</span>
      ) : null}
    </p>
  )
}

function Clause({
  label,
  heading,
  options,
  onSelect,
  readOnly,
}: {
  label: string
  heading: string
  options: { value: string; label: string; help: string; selected: boolean }[]
  onSelect: (value: string) => void
  readOnly: boolean
}) {
  const [open, setOpen] = React.useState(false)

  if (readOnly) return <span className="font-medium">{label}</span>

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            type="button"
            className="inline-flex items-center gap-0.5 rounded-md px-1 py-0.5 font-medium underline decoration-dotted underline-offset-4 transition-colors hover:bg-muted"
          >
            {label}
            <ChevronDown className="size-3 opacity-60" />
          </button>
        }
      />
      <PopoverContent align="start" className="w-80">
        <p className="text-xs font-medium text-muted-foreground">{heading}</p>
        <div className="space-y-0.5">
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => {
                onSelect(o.value)
                setOpen(false)
              }}
              className={cn(
                "flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-foreground transition-colors hover:bg-muted",
                o.selected && "bg-muted"
              )}
            >
              <span
                className={cn(
                  "mt-1.5 size-2 shrink-0 rounded-full",
                  o.selected ? "bg-primary" : "bg-border"
                )}
              />
              <span className="min-w-0">
                <span className="block text-sm font-medium">{o.label}</span>
                <span className="block text-xs text-muted-foreground">{o.help}</span>
              </span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}

/**
 * The section-header variant: the same sentence, applied to everything in the
 * section at once. Reports how many items carry their own setting so a bulk
 * change can offer to keep them.
 */
export function SectionVisibilitySentence({
  clearance,
  agentUse,
  overrideCount,
  mixed = false,
  onChange,
  className,
}: {
  clearance: Clearance
  agentUse: AgentUse | null
  overrideCount: number
  /** True when items here don't share one clearance — "Everything here is" would lie. */
  mixed?: boolean
  onChange?: (next: { clearance: Clearance; agentUse: AgentUse | null }) => void
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-border bg-muted/40 px-3 py-2",
        className
      )}
    >
      <Eye className="size-3.5 shrink-0 text-muted-foreground" />
      <span className="text-xs text-muted-foreground">
        {mixed ? "Set everything here to" : "Everything here is"}
      </span>
      <VisibilitySentence
        clearance={clearance}
        agentUse={agentUse}
        onChange={onChange}
        readOnly={!onChange}
      />
      {overrideCount > 0 && (
        <span className="text-xs text-muted-foreground">
          · {overrideCount} item{overrideCount === 1 ? " has" : "s have"} its own
          setting
        </span>
      )}
    </div>
  )
}
