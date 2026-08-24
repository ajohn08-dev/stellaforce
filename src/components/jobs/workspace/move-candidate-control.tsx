"use client"

import * as React from "react"
import { ArrowLeft, ArrowRight, Loader2, MoreHorizontal, PauseCircle, RotateCcw, X } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  holdCandidate,
  moveCandidate,
  rejectCandidate,
  reopenApplication,
} from "@/app/(app)/jobs/actions"
import type { ApplicationStatus } from "@/lib/supabase/types"

/**
 * What a recruiter can do to a candidate from the pipeline header: move them one
 * stage, park them, or end it.
 *
 * `moveCandidate` and `rejectCandidate` both existed and worked since the
 * workflow-templates pass and **had no caller** — the board was entirely
 * read-only, so no candidate could be advanced or rejected through the UI at
 * all. That mattered more once stage entry became a trigger: "candidate reaches
 * an agent interview stage" is what sends a booking link, and nothing could make
 * it happen.
 *
 * ── One step, not any step ──
 *
 * This was a "Move to stage…" dropdown listing every sub-stage on the job, which
 * let a recruiter send someone from Sourced straight to Offer. A pipeline whose
 * stages can be skipped isn't a pipeline: the evaluations, the scorecard and the
 * fit model all assume a candidate passed through what came before, and stage
 * entry is a *trigger* — jumping past Pre-Screening silently skips the screening
 * call rather than failing.
 *
 * So: two directions and no list. Forward is the primary button. Backward lives
 * in the overflow menu — a demo has to be re-runnable and correcting a misclick
 * is real work, but it is the only one of these four actions that *undoes*
 * rather than decides, and it should not be reachable by reflex next to the
 * button a recruiter presses all day. The adjacency rule is re-checked in the
 * Server Action, because a disabled control is a courtesy.
 *
 * ── Hold and Reject are different kinds of thing ──
 *
 * Hold leaves the candidate on their stage with the clock running; Reject moves
 * them out of the pipeline and closes the stage row. Both are reversible from
 * here, which is what keeps this demoable — and Reopen is the only control
 * offered once an application is no longer active, since every other action
 * would be a lie about a closed application.
 *
 * `stages` **must arrive in pipeline order** — Tier-1 `display_order`, then the
 * sub-stage's. `sortByPipelineStage` in `src/lib/data.ts` is what produces it.
 * Sorting on `display_order` alone is wrong: sub-stages in different Tier-1
 * stages routinely share one, because that column orders *within* a Tier-1 stage.
 */
export function MoveCandidateControl({
  applicationId,
  currentStageId,
  status = "active",
  stages,
}: {
  applicationId: string
  currentStageId: string | null
  status?: ApplicationStatus
  /** In pipeline order. See the note above — this component trusts the order. */
  stages: { id: string; name: string }[]
}) {
  const [pending, setPending] = React.useState<string | null>(null)
  const [isPending, startTransition] = React.useTransition()

  const index = currentStageId ? stages.findIndex((s) => s.id === currentStageId) : -1
  // A candidate not on any stage yet can only enter at the first one.
  const previous = index > 0 ? stages[index - 1] : undefined
  const next = index === -1 ? stages[0] : stages[index + 1]

  function run(key: string, action: () => Promise<{ ok: boolean; error?: string }>, success: string) {
    setPending(key)
    startTransition(async () => {
      const result = await action()
      setPending(null)
      if (!result.ok) {
        toast.error(result.error ?? "That didn't work.")
        return
      }
      toast.success(success)
    })
  }

  const spinner = <Loader2 className="size-3.5 animate-spin" />

  if (status !== "active") {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">
          {status === "on_hold"
            ? "On hold"
            : status === "rejected"
              ? "Rejected"
              : status === "withdrawn"
                ? "Withdrawn"
                : "Hired"}
        </span>
        {status !== "hired" && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={isPending}
            onClick={() =>
              run("reopen", () => reopenApplication(applicationId), "Back in the pipeline.")
            }
          >
            {isPending && pending === "reopen" ? (
              spinner
            ) : (
              <>
                <RotateCcw data-icon="inline-start" className="size-3.5" />
                Reopen
              </>
            )}
          </Button>
        )}
      </div>
    )
  }

  // Order is deliberate, and reads right to left by weight: the primary action
  // sits where the eye lands last, the two quiet outcomes lead into it, and
  // going backwards — the only one of the four that undoes rather than
  // decides — is behind the overflow so it can't be hit by reflex.
  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="text-muted-foreground"
        disabled={isPending}
        onClick={() => run("hold", () => holdCandidate(applicationId), "Put on hold.")}
      >
        {isPending && pending === "hold" ? (
          spinner
        ) : (
          <>
            <PauseCircle data-icon="inline-start" className="size-3.5" />
            Hold
          </>
        )}
      </Button>

      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="text-muted-foreground hover:text-destructive"
        disabled={isPending}
        onClick={() => run("reject", () => rejectCandidate(applicationId), "Candidate rejected.")}
      >
        {isPending && pending === "reject" ? (
          spinner
        ) : (
          <>
            <X data-icon="inline-start" className="size-3.5" />
            Reject
          </>
        )}
      </Button>

      {next && (
        <Button
          type="button"
          size="sm"
          disabled={isPending}
          onClick={() =>
            // Deliberately vague about the booking link: whether one goes out
            // depends on the stage's configuration and the automation gate, and
            // promising it here would be a second source of truth for a decision
            // made server-side.
            run(next.id, () => moveCandidate(applicationId, next.id), `Moved to ${next.name}.`)
          }
        >
          {isPending && pending === next.id ? (
            spinner
          ) : (
            <>
              Move to {next.name}
              <ArrowRight data-icon="inline-end" className="size-3.5" />
            </>
          )}
        </Button>
      )}

      {/* Only rendered when it would hold something. An overflow menu whose one
          item is unavailable is worse than no menu: it promises an action the
          candidate's position doesn't have. */}
      {previous && (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="text-muted-foreground"
                disabled={isPending}
                aria-label="More stage actions"
              >
                {isPending && pending === previous.id ? (
                  spinner
                ) : (
                  <MoreHorizontal className="size-4" />
                )}
              </Button>
            }
          />
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() =>
                run(
                  previous.id,
                  () => moveCandidate(applicationId, previous.id),
                  `Moved back to ${previous.name}.`
                )
              }
            >
              <ArrowLeft data-icon="inline-start" className="size-3.5" />
              Move back to {previous.name}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  )
}
