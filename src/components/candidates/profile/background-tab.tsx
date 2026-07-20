import { ExperienceTab } from "@/components/candidates/profile/experience-tab"
import { EducationTab } from "@/components/candidates/profile/education-tab"
import type { WorkHistoryEntry } from "@/lib/work-history"
import type { CandidateRow } from "@/lib/supabase/types"

/** Combines the former separate Experience and Education tabs into one. */
export function BackgroundTab({
  candidate,
  workHistory,
}: {
  candidate: CandidateRow
  workHistory: WorkHistoryEntry[]
}) {
  return (
    <div className="space-y-8">
      <ExperienceTab workHistory={workHistory} />
      <EducationTab candidate={candidate} />
    </div>
  )
}
