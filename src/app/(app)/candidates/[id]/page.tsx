import { notFound } from "next/navigation"

import { ProfileHeader } from "@/components/candidates/profile/profile-header"
import { ProfileTabs } from "@/components/candidates/profile/profile-tabs"
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

  const { candidate, skills, addedBy } = result
  // TODO: candidates.work_history isn't a real column yet — mock data until
  // the schema/UI here are approved (see src/lib/mock-work-history.ts).
  const workHistory = MOCK_WORK_HISTORY[candidate.candidate_id] ?? []

  return (
    <div
      className="flex flex-col gap-6 overflow-hidden p-4"
      // Inline style, not an arbitrary Tailwind class: this project has
      // already had one bracketed arbitrary-value class silently fail to
      // generate (grid-cols-[1fr_auto_1fr]), and this height calc is worth
      // not gambling on. <main> has no padding of its own — only the app
      // header (h-14 = 3.5rem) needs subtracting; this div's own p-4 is
      // included in that height via border-box. Fixed (not min-) height so
      // the header stays put and only the tab content below it scrolls.
      style={{ height: "calc(100vh - 3.5rem)" }}
    >
      <SetCandidateBreadcrumb name={candidate.full_name} />

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
    </div>
  )
}
