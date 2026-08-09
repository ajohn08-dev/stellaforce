"use client"

import * as React from "react"
import { toast } from "sonner"
import { Building2, ChevronRight, MessageSquareText, Mic, Phone, Star, Video } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { EvaluationDetailSheet } from "@/components/jobs/workspace/evaluation-detail-sheet"
import type { ApplicationEvaluation } from "@/lib/data"

const MODE_META: Record<
  NonNullable<ApplicationEvaluation["mode"]>,
  { label: string; icon: typeof Video }
> = {
  video: { label: "Video", icon: Video },
  phone: { label: "Phone", icon: Phone },
  onsite: { label: "Onsite", icon: Building2 },
  async: { label: "Async", icon: Building2 },
}

function StarRating({ score }: { score: number }) {
  const rounded = Math.round(score)
  return (
    <div className="flex items-center gap-0.5" aria-label={`${score} out of 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={cn(
            "size-4",
            i <= rounded
              ? "fill-brand-orange-300 text-brand-orange-300"
              : "text-muted-foreground/30"
          )}
        />
      ))}
    </div>
  )
}

function ModeTag({ mode }: { mode: NonNullable<ApplicationEvaluation["mode"]> }) {
  const meta = MODE_META[mode]
  const Icon = meta.icon
  return (
    <span className="inline-flex items-center gap-1">
      <Icon className="size-3.5" />
      {meta.label}
    </span>
  )
}

/** Summary card for a completed evaluation. Deliberately shallow — one clamped
 * line of summary plus counts — because the detail (recording, Q&A, full
 * transcript, notes) lives in the panel this opens. */
function CompletedEvaluationCard({
  stageName,
  evaluation,
  onOpen,
}: {
  stageName: string
  evaluation: ApplicationEvaluation
  onOpen: () => void
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Open the ${stageName} evaluation`}
      className="group w-full rounded-lg border border-border bg-white p-4 text-left transition-colors hover:border-muted-foreground/30 hover:bg-muted/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-semibold text-foreground">{stageName}</p>
        <div className="flex items-center gap-2">
          {evaluation.rubric_score != null && <StarRating score={evaluation.rubric_score} />}
          <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
        </div>
      </div>

      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
        {evaluation.interviewer_name && <span>{evaluation.interviewer_name}</span>}
        {evaluation.mode && (
          <>
            {evaluation.interviewer_name && <span>·</span>}
            <ModeTag mode={evaluation.mode} />
          </>
        )}
        {evaluation.interview_date && (
          <>
            <span>·</span>
            <span>{new Date(evaluation.interview_date).toLocaleDateString()}</span>
          </>
        )}
      </div>

      {evaluation.summary && (
        <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{evaluation.summary}</p>
      )}

      {/* What's waiting inside, so the card is worth clicking. */}
      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        {evaluation.recording && (
          <span className="inline-flex items-center gap-1">
            <Mic className="size-3.5" />
            Recording
          </span>
        )}
        {evaluation.questions.length > 0 && (
          <span>
            {evaluation.questions.length} question
            {evaluation.questions.length === 1 ? "" : "s"}
          </span>
        )}
        {evaluation.notes.length > 0 && (
          <span className="inline-flex items-center gap-1">
            <MessageSquareText className="size-3.5" />
            {evaluation.notes.length} note{evaluation.notes.length === 1 ? "" : "s"}
          </span>
        )}
      </div>
    </button>
  )
}

function PendingEvaluationCard({ stageName }: { stageName: string }) {
  return (
    <div className="rounded-lg border-2 border-dashed border-border bg-muted/40 p-4">
      <p className="text-sm font-semibold text-foreground">{stageName}</p>

      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">No evaluation submitted yet.</p>
        <Button
          size="sm"
          onClick={() =>
            toast.info("Not wired up yet — adding an evaluation is coming soon.")
          }
        >
          Add evaluation
        </Button>
      </div>
    </div>
  )
}

export function CandidateEvaluationTab({
  candidateName,
  reachedStages,
  evaluations,
}: {
  candidateName: string
  /** Reached sub-stages that are actually interviews (source excluded), in
   * pipeline order. */
  reachedStages: { id: string; name: string }[]
  /** This application's real evaluation rows, if any exist yet. */
  evaluations: ApplicationEvaluation[]
}) {
  // Only the stage is held in state; the evaluation itself is looked up during
  // render, so an open panel picks up fresh data after a write (adding a note
  // revalidates the page) without an effect to resync it.
  const [selectedStageId, setSelectedStageId] = React.useState<string | null>(null)

  if (reachedStages.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No evaluations yet — {candidateName} hasn&apos;t reached an evaluated stage.
      </p>
    )
  }

  const evaluationByStage = new Map(evaluations.map((e) => [e.sub_stage_id, e]))

  // Newest first: the stage still awaiting an evaluation leads, then completed
  // stages in reverse pipeline order. `reachedStages` arrives oldest-first, so
  // each group is reversed rather than sorted by date — pipeline position is
  // the real chronology, and a missing interview_date can't reshuffle it.
  const cards = reachedStages.map((stage) => ({
    stage,
    evaluation: evaluationByStage.get(stage.id) ?? null,
  }))
  const ordered = [
    ...cards.filter((c) => c.evaluation?.status !== "completed").reverse(),
    ...cards.filter((c) => c.evaluation?.status === "completed").reverse(),
  ]

  const selectedStage = reachedStages.find((s) => s.id === selectedStageId)
  const selectedEvaluation = selectedStageId ? evaluationByStage.get(selectedStageId) : undefined
  const selected =
    selectedStage && selectedEvaluation
      ? { evaluation: selectedEvaluation, stageName: selectedStage.name }
      : null

  return (
    <>
      <div className="flex flex-col gap-3">
        {ordered.map(({ stage, evaluation }) =>
          evaluation && evaluation.status === "completed" ? (
            <CompletedEvaluationCard
              key={stage.id}
              stageName={stage.name}
              evaluation={evaluation}
              onOpen={() => setSelectedStageId(stage.id)}
            />
          ) : (
            <PendingEvaluationCard key={stage.id} stageName={stage.name} />
          )
        )}
      </div>

      <EvaluationDetailSheet
        selected={selected}
        candidateName={candidateName}
        onOpenChange={(open) => {
          if (!open) setSelectedStageId(null)
        }}
      />
    </>
  )
}
