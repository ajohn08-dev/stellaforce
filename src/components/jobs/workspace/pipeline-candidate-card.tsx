import { TierBadge } from "@/components/tier-badge"
import type { PipelineCandidate } from "@/lib/pipeline-candidates"

export function PipelineCandidateCard({
  candidate,
}: {
  candidate: PipelineCandidate
}) {
  return (
    <div className="rounded-md border border-border bg-background p-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">{candidate.full_name}</span>
        <TierBadge tier={candidate.tier} />
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        {candidate.days_in_stage} day{candidate.days_in_stage === 1 ? "" : "s"} in stage
      </p>
    </div>
  )
}
