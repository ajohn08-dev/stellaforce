"use client"

import * as React from "react"
import { toast } from "sonner"
import { CircleCheck, CircleSlash, PauseCircle } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  setAutomationScopeState,
  resetAutomationScopeToInherited,
} from "@/app/(app)/automations/actions"
import type { AutomationRunState } from "@/lib/automation-rules"

/** One account's switch, as the server resolved it. */
export type AccountSwitchView = {
  /** Null for the global default row. */
  clientId: string | null
  name: string
  /** Null when this account stores nothing and follows the default. */
  ownState: AutomationRunState | null
  resumeAt: string | null
  /** What actually applies after inheritance. */
  effectiveState: AutomationRunState
  inherited: boolean
  jobCount: number
  editable: boolean
}

/**
 * One row per account, each deciding for itself.
 *
 * The three states are the library's own `automation_state`, not a boolean:
 * `paused` (a hiring manager is away, an incident is open) and `off` (this
 * account does not use automation) are different facts with different expected
 * lifetimes, and an admin who can only say "off" will say it for both.
 */

const STATES: { value: AutomationRunState; label: string; hint: string }[] = [
  { value: "active", label: "On", hint: "The platform acts on its own." },
  { value: "paused", label: "Paused", hint: "Temporarily not running." },
  { value: "off", label: "Off", hint: "This account works manually." },
]

export function AccountAutomationRows({
  global,
  accounts,
  readOnly,
}: {
  global: AccountSwitchView | null
  accounts: AccountSwitchView[]
  readOnly: boolean
}) {
  return (
    <div className="flex flex-col gap-6">
      {global && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-medium text-foreground">Default</h2>
          <p className="text-sm text-muted-foreground">
            What an account does before anyone decides for it. Changing this never
            overrides an account that has decided — each one below wins for itself.
          </p>
          <div className="rounded-lg border border-border">
            <AccountRow row={global} readOnly={readOnly} />
          </div>
        </section>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-foreground">Accounts</h2>
        {accounts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No accounts yet.</p>
        ) : (
          <div className="divide-y divide-border rounded-lg border border-border">
            {accounts.map((row) => (
              <AccountRow key={row.clientId} row={row} readOnly={readOnly} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function AccountRow({ row, readOnly }: { row: AccountSwitchView; readOnly: boolean }) {
  const [pending, startTransition] = React.useTransition()
  const [confirming, setConfirming] = React.useState<AutomationRunState | null>(null)

  const target = row.clientId
    ? ({ scope: "company", clientId: row.clientId } as const)
    : ({ scope: "global" } as const)

  function apply(state: AutomationRunState, resumeAt: string | null) {
    startTransition(async () => {
      const result = await setAutomationScopeState({
        target,
        state,
        resumeAt: state === "paused" ? resumeAt : null,
      })
      if (!result.ok) toast.error(result.error)
      else toast.success(`Automations ${labelOf(state).toLowerCase()} for ${row.name}.`)
      setConfirming(null)
    })
  }

  /**
   * Only interrupt when the interruption carries information.
   *
   * Turning automations **on** restores normal behaviour and is trivially
   * undone, so it applies straight away. **Off** shows what it will reach
   * before it reaches it, and **Paused** exists to offer a resume date. Nothing
   * asks why any more — a mandatory field on a switch people flip routinely is
   * friction that gets filled with "." and tells nobody anything.
   */
  function choose(state: AutomationRunState) {
    if (state === "active") apply(state, null)
    else setConfirming(state)
  }

  function inherit() {
    startTransition(async () => {
      const result = await resetAutomationScopeToInherited({ target })
      if (!result.ok) toast.error(result.error)
      else toast.success(`${row.name} follows the default again.`)
    })
  }

  return (
    <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <StateIcon state={row.effectiveState} />
          <span className="truncate text-sm font-medium text-foreground">{row.name}</span>
        </div>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {describe(row)}
          {row.clientId && row.jobCount > 0 && (
            <> · {row.jobCount} active {row.jobCount === 1 ? "job" : "jobs"}</>
          )}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {!readOnly && row.editable && (
          <>
            <div className="inline-flex rounded-md border border-border p-0.5">
              {STATES.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  disabled={pending}
                  title={s.hint}
                  onClick={() =>
                    s.value === row.effectiveState && !row.inherited
                      ? undefined
                      : choose(s.value)
                  }
                  className={cn(
                    "rounded px-2.5 py-1 text-sm transition-colors disabled:opacity-50",
                    row.effectiveState === s.value && !row.inherited
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>
            {row.clientId && !row.inherited && (
              <Button variant="ghost" size="sm" disabled={pending} onClick={inherit}>
                Use default
              </Button>
            )}
          </>
        )}
      </div>

      <ConfirmDialog
        key={confirming ?? "closed"}
        state={confirming}
        row={row}
        pending={pending}
        onCancel={() => setConfirming(null)}
        onConfirm={apply}
      />
    </div>
  )
}

/**
 * Shown only for **Off** and **Paused**, never for turning back on.
 *
 * Off states its blast radius before it reaches it; Paused exists to offer a
 * resume date. Turning automations on restores normal behaviour and is
 * trivially undone, so it needs no ceremony — and nothing asks why any more.
 */
function ConfirmDialog({
  state,
  row,
  pending,
  onCancel,
  onConfirm,
}: {
  state: AutomationRunState | null
  row: AccountSwitchView
  pending: boolean
  onCancel: () => void
  onConfirm: (state: AutomationRunState, resumeAt: string | null) => void
}) {
  // Fresh on every open, via the remount key at the call site rather than an
  // effect that resets — the state only ever needs to be right at mount.
  const [resumeAt, setResumeAt] = React.useState("")

  if (!state || state === "active") return null

  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {state === "paused" ? "Pause automations" : "Turn automations off"}
            {row.clientId ? ` for ${row.name}` : ""}
          </DialogTitle>
          <DialogDescription>
            {row.clientId ? (
              <>
                No agent calls, candidate emails or hiring-team messages will go
                out for {row.name}
                {row.jobCount > 0 && (
                  <>
                    {" "}
                    — across {row.jobCount} active {row.jobCount === 1 ? "job" : "jobs"}
                  </>
                )}
                . Everything is still recorded, and the next action is still
                shown so someone can do it by hand.
              </>
            ) : (
              <>
                Accounts that have not decided for themselves will stop running
                automations. Accounts that have decided keep their own setting.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {state === "paused" && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="resume-at" className="text-sm font-medium">
              Resume on <span className="font-normal text-muted-foreground">(optional)</span>
            </label>
            <Input
              id="resume-at"
              type="date"
              value={resumeAt}
              onChange={(e) => setResumeAt(e.target.value)}
            />
            <p className="text-sm text-muted-foreground">
              Automations start again on their own that morning. Leave it empty to
              resume by hand.
            </p>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onCancel} disabled={pending}>
            Cancel
          </Button>
          <Button
            onClick={() =>
              onConfirm(
                state,
                // A date input gives a local calendar day; resume at the start
                // of it rather than at midnight UTC, which is the previous
                // evening for most of the Americas.
                resumeAt ? new Date(`${resumeAt}T00:00:00`).toISOString() : null
              )
            }
            disabled={pending}
          >
            {state === "paused" ? "Pause" : "Turn off"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function StateIcon({ state }: { state: AutomationRunState }) {
  if (state === "active") return <CircleCheck className="size-4 shrink-0 text-muted-foreground" />
  if (state === "paused") return <PauseCircle className="size-4 shrink-0 text-amber-600" />
  return <CircleSlash className="size-4 shrink-0 text-amber-600" />
}

function labelOf(state: AutomationRunState): string {
  return STATES.find((s) => s.value === state)?.label ?? state
}

/** One sentence saying what is true and where it was decided. */
function describe(row: AccountSwitchView): string {
  const state = labelOf(row.effectiveState)
  if (row.inherited) {
    return row.clientId ? `${state} · following the default` : `${state} · nothing set`
  }
  if (row.effectiveState === "paused" && row.resumeAt) {
    return `Paused until ${new Date(row.resumeAt).toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
    })}`
  }
  return `${state} · set for this account`
}
