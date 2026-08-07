"use client"

import { toast } from "sonner"
import { Building2, Phone, Star, Video } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
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

function CompletedEvaluationCard({
  stageName,
  evaluation,
}: {
  stageName: string
  evaluation: ApplicationEvaluation
}) {
  return (
    <div className="rounded-lg bg-brand-orange-50 p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-semibold text-foreground">{stageName}</p>
        {evaluation.rubric_score != null && <StarRating score={evaluation.rubric_score} />}
      </div>

      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
        {evaluation.interviewer_name && <span>{evaluation.interviewer_name}</span>}
        {evaluation.mode && (
          <>
            <span>·</span>
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

      {evaluation.summary && <p className="mt-3 text-sm text-foreground">{evaluation.summary}</p>}

      {evaluation.notes.length > 0 && (
        <div className="mt-3 flex flex-col gap-2">
          {evaluation.notes.map((note, i) => (
            <div key={i} className="rounded-md border border-border p-3">
              <p className="text-sm text-foreground">{note}</p>
            </div>
          ))}
        </div>
      )}
    </div>
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
  if (reachedStages.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No evaluations yet — {candidateName} hasn&apos;t reached an evaluated stage.
      </p>
    )
  }

  const evaluationByStage = new Map(evaluations.map((e) => [e.sub_stage_id, e]))

  return (
    <div className="flex flex-col gap-3">
      {reachedStages.map((stage) => {
        const evaluation = evaluationByStage.get(stage.id)
        return evaluation && evaluation.status === "completed" ? (
          <CompletedEvaluationCard key={stage.id} stageName={stage.name} evaluation={evaluation} />
        ) : (
          <PendingEvaluationCard key={stage.id} stageName={stage.name} />
        )
      })}
    </div>
  )
}
