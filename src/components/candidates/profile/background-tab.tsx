import { ExperienceTab } from "@/components/candidates/profile/experience-tab"
import { EducationTab } from "@/components/candidates/profile/education-tab"
import type { WorkHistoryEntry } from "@/lib/work-history"
import type {
  CandidateCertificationRow,
  CandidateEducationRow,
  CandidateRow,
  CandidateSkillWithSkill,
  CandidateToolWithTool,
} from "@/lib/supabase/types"

/** Combines the former separate Experience and Education tabs into one. */
export function BackgroundTab({
  candidate,
  education,
  certifications,
  skills,
  tools,
  workHistory,
}: {
  candidate: CandidateRow
  education: CandidateEducationRow[]
  certifications: CandidateCertificationRow[]
  skills: CandidateSkillWithSkill[]
  tools: CandidateToolWithTool[]
  workHistory: WorkHistoryEntry[]
}) {
  return (
    <div className="space-y-8">
      <ExperienceTab workHistory={workHistory} />
      <EducationTab
        candidate={candidate}
        education={education}
        certifications={certifications}
        skills={skills}
        tools={tools}
      />
    </div>
  )
}
