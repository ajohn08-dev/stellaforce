import { notFound } from "next/navigation"

import { CandidateProfileSheet } from "@/components/candidates/profile/candidate-profile-sheet"
import { ProfileHeader } from "@/components/candidates/profile/profile-header"
import { ProfileTabs } from "@/components/candidates/profile/profile-tabs"
import { getCandidate } from "@/lib/data"

export default async function CandidateProfileModal({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const result = await getCandidate(id)
  if (!result) notFound()

  const { candidate, skills, education, certifications, workHistory, addedBy } = result

  return (
    <CandidateProfileSheet>
      <div className="shrink-0">
        <ProfileHeader candidate={candidate} workHistory={workHistory} />
      </div>
      <ProfileTabs
        candidate={candidate}
        skills={skills}
        education={education}
        certifications={certifications}
        workHistory={workHistory}
        addedBy={addedBy}
        dateAdded={candidate.date_added}
      />
    </CandidateProfileSheet>
  )
}
