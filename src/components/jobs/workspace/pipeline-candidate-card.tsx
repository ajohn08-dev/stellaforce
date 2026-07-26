import { CandidateAvatar } from "@/components/candidate-avatar"
import { cn } from "@/lib/utils"
import type { PipelineCandidate } from "@/lib/pipeline-candidates"

export function PipelineCandidateCard({
  candidate,
  selected,
  onSelect,
}: {
  candidate: PipelineCandidate
  selected?: boolean
  onSelect?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex w-full items-start gap-2.5 rounded-md border p-3 text-left transition-colors",
        selected
          ? "border-brand-orange-300 bg-brand-orange-100 dark:bg-brand-orange-950"
          : "border-border bg-background hover:bg-muted/50"
      )}
    >
      <CandidateAvatar name={candidate.full_name} className="size-9 shrink-0" />
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="truncate text-sm font-medium">{candidate.full_name}</p>
        <p className="truncate text-xs text-muted-foreground">
          {candidate.title} at {candidate.company}
        </p>
        <p className="text-xs text-muted-foreground">
          {candidate.days_in_stage} day{candidate.days_in_stage === 1 ? "" : "s"} in stage
        </p>
      </div>
    </button>
  )
}
