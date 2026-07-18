import { PipelineCandidateCard } from "@/components/jobs/workspace/pipeline-candidate-card"
import {
  PIPELINE_STAGES,
  type PipelineCandidate,
  type StageKey,
} from "@/lib/pipeline-candidates"

/** Kanban-style board: one column per pipeline stage, candidates as cards within. */
export function PipelineBoard({
  pipeline,
}: {
  pipeline: Record<StageKey, PipelineCandidate[]>
}) {
  return (
    <div className="grid grid-cols-5 gap-4">
      {PIPELINE_STAGES.map(({ key, label }) => {
        const candidates = pipeline[key]
        return (
          <div
            key={key}
            className="flex flex-col rounded-lg border border-border bg-muted/30"
          >
            <div className="flex items-baseline gap-1.5 border-b border-border p-3">
              <span className="text-sm font-semibold">{candidates.length}</span>
              <span className="text-xs text-muted-foreground">{label}</span>
            </div>
            <div className="flex flex-1 flex-col gap-2 p-3">
              {candidates.length ? (
                candidates.map((candidate) => (
                  <PipelineCandidateCard
                    key={candidate.candidate_id}
                    candidate={candidate}
                  />
                ))
              ) : (
                <p className="text-xs text-muted-foreground">No candidates</p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
