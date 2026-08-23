"use client"

import * as React from "react"
import { ChevronDown, ChevronRight, Pause, Play, Square, Zap } from "lucide-react"
import { toast } from "sonner"

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
import { AUTOMATION_SECTIONS } from "@/lib/automation-sections"
import { AutomationRuleFacets } from "@/components/automations/automation-rule-facets"
import { AutomationStateSubtext } from "@/components/automations/automation-state-subtext"
import {
  resetAutomationToInherited,
  setAutomationState,
} from "@/app/(app)/automations/actions"
import {
  AUTOMATION_RUN_STATE_LABEL,
  type AutomationRunState,
} from "@/lib/automation-rules"
import type { ResolvedAutomation } from "@/lib/automation-resolve"

/** The categories with rules behind them — `runs` is a log, not a set of rules. */
const CATEGORIES = AUTOMATION_SECTIONS.filter((s) => s.eventGroup)

const CONTROLS: { value: AutomationRunState; icon: typeof Play; title: string }[] = [
  { value: "active", icon: Play, title: "Run this automation on this job" },
  { value: "paused", icon: Pause, title: "Pause — keep the rule, stop it firing for now" },
  { value: "off", icon: Square, title: "Off — don't run this on this job" },
]

/**
 * Play / pause / off, as a segmented control rather than a toggle — the current
 * state is one of three and stays visible, so the row reads the same whether
 * you're scanning or changing it.
 */
function StateControl({
  automation,
  pending,
  onChange,
}: {
  automation: ResolvedAutomation
  pending: boolean
  onChange: (next: AutomationRunState) => void
}) {
  const disabled = pending || automation.isLocked || !automation.isApplicable
  return (
    <div
      className={cn(
        "flex shrink-0 items-center rounded-md border border-border",
        disabled && "opacity-50"
      )}
    >
      {CONTROLS.map(({ value, icon: Icon, title }) => {
        const current = automation.effectiveState === value
        return (
          <button
            key={value}
            type="button"
            disabled={disabled}
            aria-pressed={current}
            title={automation.lockedReason ?? title}
            onClick={() => onChange(value)}
            className={cn(
              "flex size-7 items-center justify-center transition-colors first:rounded-l-[5px] last:rounded-r-[5px]",
              current
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
              disabled && "cursor-not-allowed hover:bg-transparent hover:text-muted-foreground"
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
 * can't show how much is running without you reading thirteen rows, and it made
 * every rule look like a local choice when most are inherited — the useful
 * question on a job isn't "what shall I set" but **"what's running here, and
 * where was that decided"**, which is why state and source read as one line.
 *
 * The dialog is a **fixed size**. Its height used to follow the longest
 * category, so switching the left nav resized the window under the pointer —
 * the control you just clicked moved.
 *
 * Every state here comes from `resolveAutomations()` and every change is a
 * sparse job-scoped binding. Nothing on this screen can touch the global,
 * company, or workflow row it inherited from.
 */
export function JobAutomationMenu({
  jobId,
  automations,
}: {
  jobId: string
  automations: ResolvedAutomation[]
}) {
  const [category, setCategory] = React.useState(CATEGORIES[0].key)
  /** One rule expanded at a time — a dialog of thirteen open explanations is a document, not a control. */
  const [openId, setOpenId] = React.useState<string | null>(null)
  const [pendingId, setPendingId] = React.useState<string | null>(null)
  const [isPending, startTransition] = React.useTransition()

  const counts = automations.reduce(
    (acc, a) => {
      acc[a.effectiveState] += 1
      return acc
    },
    { active: 0, paused: 0, off: 0 } as Record<AutomationRunState, number>
  )

  const current = CATEGORIES.find((c) => c.key === category) ?? CATEGORIES[0]
  const rows = automations.filter((a) => a.category === current.key)

  function run(definitionId: string, action: () => Promise<{ ok: boolean; error?: string }>) {
    setPendingId(definitionId)
    startTransition(async () => {
      const result = await action()
      setPendingId(null)
      // The server re-checks every rule the disabled state implies, so a
      // failure here is a real answer, not a race — surface it rather than
      // leaving the row looking as though the click landed.
      if (!result.ok) toast.error(result.error ?? "Couldn't change that automation.")
    })
  }

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
            {counts.active} active · {counts.paused} paused · {counts.off} off
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
              {rows.map((automation) => {
                const id = automation.definitionId
                const open = openId === id
                const pending = isPending && pendingId === id
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
                              automation.effectiveState === "active"
                                ? "text-foreground"
                                : "text-muted-foreground"
                            )}
                          >
                            {automation.name}
                          </span>
                          <AutomationStateSubtext automation={automation} />
                        </span>
                      </button>

                      <div className="flex shrink-0 items-center gap-2">
                        {/* Reset is a separate button, not a fourth segment: the
                            segments are states, and "inherited" is not one — it
                            is the absence of a decision here. */}
                        {automation.canResetToInherited && (
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() =>
                              run(id, () =>
                                resetAutomationToInherited({
                                  definitionId: id,
                                  target: { scope: "job", jobId },
                                })
                              )
                            }
                            className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline disabled:opacity-50"
                          >
                            Reset
                          </button>
                        )}
                        <StateControl
                          automation={automation}
                          pending={pending}
                          onChange={(next) =>
                            run(id, () =>
                              setAutomationState({
                                definitionId: id,
                                target: { scope: "job", jobId },
                                state: next,
                              })
                            )
                          }
                        />
                      </div>
                    </div>

                    {open && (
                      <div className="pb-3 pl-5.5">
                        {automation.isApplicable ? (
                          <div className="rounded-lg border border-border bg-muted/30 p-3">
                            <AutomationRuleFacets automation={automation} brief />
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
