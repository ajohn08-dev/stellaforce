"use client"

import * as React from "react"

import { PipelineCandidateCard } from "@/components/jobs/workspace/pipeline-candidate-card"
import { PipelineCandidateDetail } from "@/components/jobs/workspace/pipeline-candidate-detail"
import type { PipelineCandidate } from "@/lib/pipeline-candidates"

/** Two-column stage view: candidate list on the left (1/4), selected candidate's detail on the right. */
export function PipelineStagePanel({
  candidates,
}: {
  candidates: PipelineCandidate[]
}) {
  const [selectedId, setSelectedId] = React.useState(candidates[0]?.candidate_id)

  if (candidates.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No candidates in this stage.</p>
    )
  }

  const selected =
    candidates.find((c) => c.candidate_id === selectedId) ?? candidates[0]

  return (
    <div className="flex h-full gap-4">
      <div className="scrollbar-light flex h-full w-1/4 shrink-0 flex-col gap-2 overflow-y-auto">
        {candidates.map((candidate) => (
          <PipelineCandidateCard
            key={candidate.candidate_id}
            candidate={candidate}
            selected={candidate.candidate_id === selected.candidate_id}
            onSelect={() => setSelectedId(candidate.candidate_id)}
          />
        ))}
      </div>

      <div className="flex h-full min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-white">
        <PipelineCandidateDetail candidate={selected} />
      </div>
    </div>
  )
}
