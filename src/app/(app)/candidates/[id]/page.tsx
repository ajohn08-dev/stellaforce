import { notFound } from "next/navigation"

import { Separator } from "@/components/ui/separator"
import { ProfileHeader } from "@/components/candidates/profile/profile-header"
import { ProfileTabs } from "@/components/candidates/profile/profile-tabs"
import { CandidateSidePanel } from "@/components/candidates/profile/candidate-side-panel"
import { SetCandidateBreadcrumb } from "@/components/candidates/profile/set-candidate-breadcrumb"
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

  const { candidate, skills } = result
  // TODO: candidates.work_history isn't a real column yet — mock data until
  // the schema/UI here are approved (see src/lib/mock-work-history.ts).
  const workHistory = MOCK_WORK_HISTORY[candidate.candidate_id] ?? []

  return (
    <div
      className="flex"
      // Inline style, not an arbitrary Tailwind class: this project has
      // already had one bracketed arbitrary-value class silently fail to
      // generate (grid-cols-[1fr_auto_1fr]), and this height calc is worth
      // not gambling on. Only the header (h-14 = 3.5rem) needs subtracting —
      // the route layout cancels <main>'s own padding.
      style={{ minHeight: "calc(100vh - 3.5rem)" }}
    >
      <SetCandidateBreadcrumb name={candidate.full_name} />

      <div className="min-w-0 flex-1 space-y-6 p-6">
        <ProfileHeader candidate={candidate} />
        <ProfileTabs
          candidate={candidate}
          skills={skills}
          workHistory={workHistory}
        />
      </div>
      <Separator orientation="vertical" />
      <div className="min-w-0 flex-1 p-6">
        <CandidateSidePanel candidateId={candidate.candidate_id} />
      </div>
    </div>
  )
}
