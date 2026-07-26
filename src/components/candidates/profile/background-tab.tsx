import { ExperienceTab } from "@/components/candidates/profile/experience-tab"
import { EducationTab } from "@/components/candidates/profile/education-tab"
import type { WorkHistoryEntry } from "@/lib/work-history"
import type {
  CandidateCertificationRow,
  CandidateEducationRow,
  CandidateRow,
} from "@/lib/supabase/types"

/** Combines the former separate Experience and Education tabs into one. */
export function BackgroundTab({
  candidate,
  education,
  certifications,
  workHistory,
}: {
  candidate: CandidateRow
  education: CandidateEducationRow[]
  certifications: CandidateCertificationRow[]
  workHistory: WorkHistoryEntry[]
}) {
  return (
    <div className="space-y-8">
      <ExperienceTab workHistory={workHistory} />
      <EducationTab
        candidate={candidate}
        education={education}
        certifications={certifications}
      />
    </div>
  )
}
