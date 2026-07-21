import { notFound } from "next/navigation"

import { CandidateProfileSheet } from "@/components/candidates/profile/candidate-profile-sheet"
import { ProfileHeader } from "@/components/candidates/profile/profile-header"
import { ProfileTabs } from "@/components/candidates/profile/profile-tabs"
import { getCandidate } from "@/lib/data"
import { MOCK_WORK_HISTORY } from "@/lib/mock-work-history"

export default async function CandidateProfileModal({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const result = await getCandidate(id)
  if (!result) notFound()

  const { candidate, skills, addedBy } = result
  // TODO: candidates.work_history isn't a real column yet — mock data until
  // the schema/UI here are approved (see src/lib/mock-work-history.ts).
  const workHistory = MOCK_WORK_HISTORY[candidate.candidate_id] ?? []

  return (
    <CandidateProfileSheet>
      <div className="shrink-0">
        <ProfileHeader candidate={candidate} />
      </div>
      <ProfileTabs
        candidate={candidate}
        skills={skills}
        workHistory={workHistory}
        addedBy={addedBy}
        dateAdded={candidate.date_added}
      />
    </CandidateProfileSheet>
  )
}
