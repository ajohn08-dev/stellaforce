import { CandidateCard } from "@/components/candidates/candidate-card"
import type { CandidateListItem } from "@/lib/data"

export function CandidatesGrid({ data }: { data: CandidateListItem[] }) {
  if (data.length === 0) {
    return (
      <div className="rounded-lg border border-border p-10 text-center text-sm text-muted-foreground">
        No candidates found.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {data.map((candidate) => (
        <CandidateCard key={candidate.candidate_id} candidate={candidate} />
      ))}
    </div>
  )
}
