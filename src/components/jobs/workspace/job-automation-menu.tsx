"use client"

import * as React from "react"
import { ChevronDown, ChevronRight, Pause, Play, Square, Zap } from "lucide-react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { AUTOMATION_EVENT_GROUPS } from "@/lib/automation-events"
import { AUTOMATION_SECTIONS } from "@/lib/automation-sections"
import { AutomationRuleFacets } from "@/components/automations/automation-rule-facets"
import {
  AUTOMATION_RUN_STATE_LABEL,
  AUTOMATION_SCOPE_LABEL,
  automationState,
  isLockedByGlobal,
  rulesForEventGroup,
  type AutomationRunState,
  type AutomationState,
} from "@/lib/automation-rules"

/** The categories with rules behind them — `runs` is a log, not a set of rules. */
const CATEGORIES = AUTOMATION_SECTIONS.filter((s) => s.eventGroup)

const ALL_EVENTS = AUTOMATION_EVENT_GROUPS.flatMap((g) => g.events)

const CONTROLS: { value: AutomationRunState; icon: typeof Play; title: string }[] = [
  { value: "active", icon: Play, title: "Run this automation" },
  { value: "paused", icon: Pause, title: "Pause — keep the rule, stop it firing for now" },
  { value: "stopped", icon: Square, title: "Stop — don't run this on this job" },
]

/**
 * State and where it was decided, in one read — as subtext under the rule name
 * rather than a badge in its own column. It belongs to the rule, so it reads as
 * a caption; in a column of its own it competed with the control beside it and
 * pushed the names into a narrow, ragged strip.
 */
function StateSubtext({ state }: { state: AutomationState }) {
  return (
    <span
      className="text-xs text-muted-foreground"
      title={`${AUTOMATION_RUN_STATE_LABEL[state.state]}, set at ${AUTOMATION_SCOPE_LABEL[state.source]} level`}
    >
      {AUTOMATION_RUN_STATE_LABEL[state.state]} · {AUTOMATION_SCOPE_LABEL[state.source]}
    </span>
  )
}

/**
 * Play / pause / stop, as a segmented control rather than a toggle — the
 * current state is one of three and stays visible, so the row reads the same
 * whether you're scanning or changing it.
 */
function StateControl({
  state,
  locked,
  onChange,
}: {
  state: AutomationRunState
  locked: boolean
  onChange: (next: AutomationRunState) => void
}) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center rounded-md border border-border",
        locked && "opacity-50"
      )}
    >
      {CONTROLS.map(({ value, icon: Icon, title }) => {
        const current = state === value
        return (
          <button
            key={value}
            type="button"
            disabled={locked}
            aria-pressed={current}
            title={locked ? "Stopped in the global library — change it there" : title}
            onClick={() => onChange(value)}
            className={cn(
              "flex size-7 items-center justify-center transition-colors first:rounded-l-[5px] last:rounded-r-[5px]",
              current
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
              locked && "cursor-not-allowed hover:bg-transparent hover:text-muted-foreground"
            )}
          >
            <Icon className={cn("size-3.5", current && "fill-current")} />
            <span className="sr-only">{AUTOMATION_RUN_STATE_LABEL[value]}</span>
          </button>
        )
      })}
    </div>
  )
}

/**
 * Per-job automations, as a dialog off the job header.
 *
 * It replaced a cascading dropdown whose every row opened a submenu. A menu
 * can't show how much is running without you reading fourteen rows, and it made
 * every rule look like a local choice when most are inherited — the useful
 * question on a job isn't "what shall I set" but **"what's running here, and
 * where was that decided"**, which is why state and source are one badge.
 *
 * The dialog is a **fixed size**. Its height used to follow the longest
 * category, so switching the left nav resized the window under the pointer —
 * the control you just clicked moved.
 *
 * **UI only.** Initial state is the fixture in `src/lib/automation-rules.ts`,
 * changes are component state and persist nothing. The event list is shared
 * with the workflow settings Automation tab and the company Operations section,
 * so none of the three can drift.
 */
export function JobAutomationMenu() {
  const [category, setCategory] = React.useState(CATEGORIES[0].key)
  /** One rule expanded at a time — a dialog of fourteen open explanations is a document, not a control. */
  const [openId, setOpenId] = React.useState<string | null>(null)
  /** Only rules changed in this dialog — everything else resolves from the fixture. */
  const [overrides, setOverrides] = React.useState<Record<string, AutomationRunState>>({})

  function stateFor(eventId: string): AutomationState {
    const base = automationState(eventId)
    const override = overrides[eventId]
    // Changing it here is a job-level decision, so the badge says so.
    return override ? { state: override, source: "job" } : base
  }

  const counts = ALL_EVENTS.reduce(
    (acc, e) => {
      acc[stateFor(e.id).state] += 1
      return acc
    },
    { active: 0, paused: 0, stopped: 0 } as Record<AutomationRunState, number>
  )

  const current = CATEGORIES.find((c) => c.key === category) ?? CATEGORIES[0]
  const rows = rulesForEventGroup(current.eventGroup!)

  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button variant="outline" size="icon" aria-label="Automations">
            <Zap />
          </Button>
        }
      />
      {/* Fixed height and width: the content behind the left nav varies in
          length, and a dialog that resizes as you switch section moves every
          control under the pointer. */}
      <DialogContent className="flex h-[34rem] max-h-[85vh] flex-col overflow-hidden sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Automations</DialogTitle>
          <DialogDescription>
            {counts.active} active · {counts.paused} paused · {counts.stopped} stopped
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 gap-6">
          <nav aria-label="Automation categories" className="flex w-48 shrink-0 flex-col gap-1">
            {CATEGORIES.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => setCategory(c.key)}
                className={cn(
                  "rounded-md px-3 py-2 text-left text-sm transition-colors",
                  c.key === category
                    ? "bg-brand-orange-100 font-medium text-foreground"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                )}
              >
                {c.label}
              </button>
            ))}
          </nav>

          <div className="min-h-0 min-w-0 flex-1 overflow-y-auto">
            <p className="text-sm text-muted-foreground">{current.purpose}</p>

            <ul className="mt-2 divide-y divide-border">
              {rows.map(({ id, label, rule }) => {
                const state = stateFor(id)
                const locked = isLockedByGlobal(state)
                const open = openId === id
                return (
                  <li key={id}>
                    <div className="flex items-center gap-3 py-3">
                      {/* The row itself is the disclosure — chevron on the far
                          left, the same shape the company Operations section
                          and the workflow rails use. */}
                      <button
                        type="button"
                        onClick={() => setOpenId(open ? null : id)}
                        aria-expanded={open}
                        className="flex min-w-0 flex-1 items-center gap-2 text-left"
                      >
                        {open ? (
                          <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
                        )}
                        <span className="flex min-w-0 flex-col">
                          <span
                            className={cn(
                              "truncate text-sm",
                              state.state === "active"
                                ? "text-foreground"
                                : "text-muted-foreground"
                            )}
                          >
                            {label}
                          </span>
                          <StateSubtext state={state} />
                        </span>
                      </button>

                      <StateControl
                        state={state.state}
                        locked={locked}
                        onChange={(next) => setOverrides((prev) => ({ ...prev, [id]: next }))}
                      />
                    </div>

                    {open && (
                      <div className="pb-3 pl-5.5">
                        {rule ? (
                          <div className="rounded-lg border border-border bg-muted/30 p-3">
                            <AutomationRuleFacets rule={rule} brief />
                          </div>
                        ) : (
                          <div className="rounded-lg border border-dashed border-border p-3">
                            <p className="text-sm text-muted-foreground">
                              Nothing runs on this trigger yet.
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
