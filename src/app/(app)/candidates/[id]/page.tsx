import Link from "next/link"
import { notFound } from "next/navigation"

import { buttonVariants } from "@/components/ui/button"
import { ProfileHeader } from "@/components/candidates/profile/profile-header"
import { ProfileTabs } from "@/components/candidates/profile/profile-tabs"
import { getCandidate } from "@/lib/data"
import { MOCK_WORK_HISTORY } from "@/lib/mock-work-history"

export default async function CandidateProfilePage({
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
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <ProfileHeader candidate={candidate} />
        <Link
          href="/candidates"
          className={buttonVariants({ variant: "outline" })}
        >
          Back
        </Link>
      </div>

      <ProfileTabs
        candidate={candidate}
        skills={skills}
        addedBy={addedBy}
        workHistory={workHistory}
      />
    </div>
  )
}
