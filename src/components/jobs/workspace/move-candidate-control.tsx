"use client"

import * as React from "react"
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { moveCandidate } from "@/app/(app)/jobs/actions"

/**
 * Move a candidate one step along the pipeline.
 *
 * `moveCandidate` has existed and worked since the workflow-templates pass and
 * **had no caller** — the pipeline board was entirely read-only, so no candidate
 * could be advanced through the UI at all. That mattered more once stage entry
 * became a trigger: "candidate reaches an agent interview stage" is what sends a
 * booking link, and nothing could make it happen.
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
 * So there are two buttons and no list. Forward is the primary action. Backward
 * exists because a demo has to be re-runnable and correcting a misclick is real
 * work, but it is deliberately quieter — it is a correction, not a step.
 *
 * The adjacency rule is re-checked in the Server Action. A disabled control is a
 * courtesy; the rule is enforced where it can't be bypassed.
 *
 * `stages` **must arrive in pipeline order** — Tier-1 `display_order`, then the
 * sub-stage's. `sortByPipelineStage` in `src/lib/data.ts` is what produces it,
 * and every caller here is fed from it. Sorting on `display_order` alone is
 * wrong: sub-stages in different Tier-1 stages routinely share one, because that
 * column orders *within* a Tier-1 stage.
 */
export function MoveCandidateControl({
  applicationId,
  currentStageId,
  stages,
}: {
  applicationId: string
  currentStageId: string | null
  /** In pipeline order. See the note above — this component trusts the order. */
  stages: { id: string; name: string }[]
}) {
  const [pendingId, setPendingId] = React.useState<string | null>(null)
  const [isPending, startTransition] = React.useTransition()

  const index = currentStageId ? stages.findIndex((s) => s.id === currentStageId) : -1
  // A candidate not on any stage yet can only enter at the first one.
  const previous = index > 0 ? stages[index - 1] : undefined
  const next = index === -1 ? stages[0] : stages[index + 1]

  if (!previous && !next) return null

  function move(stage: { id: string; name: string }) {
    setPendingId(stage.id)
    startTransition(async () => {
      const result = await moveCandidate(applicationId, stage.id)
      setPendingId(null)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      // Deliberately vague about the booking link: whether one goes out depends
      // on the stage's configuration and the automation gate, and promising it
      // here would be a second source of truth for a decision made server-side.
      toast.success(`Moved to ${stage.name}.`)
    })
  }

  return (
    <div className="flex items-center gap-2">
      {previous && (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="text-muted-foreground"
          disabled={isPending}
          onClick={() => move(previous)}
          title={`Move back to ${previous.name}`}
        >
          {isPending && pendingId === previous.id ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <>
              <ArrowLeft data-icon="inline-start" className="size-3.5" />
              {previous.name}
            </>
          )}
        </Button>
      )}
      {next && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isPending}
          onClick={() => move(next)}
        >
          {isPending && pendingId === next.id ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <>
              {next.name}
              <ArrowRight data-icon="inline-end" className="size-3.5" />
            </>
          )}
        </Button>
      )}
    </div>
  )
}
