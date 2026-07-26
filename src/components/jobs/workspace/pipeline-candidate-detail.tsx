import { Mail, Phone } from "lucide-react"

import { CandidateAvatar } from "@/components/candidate-avatar"
import { ContactPill } from "@/components/contact-pill"
import { GithubIcon, LinkedinIcon } from "@/components/icons/brand-icons"
import { TierBadge } from "@/components/tier-badge"
import { Tabs, TabsList, TabsPanel, TabsTab } from "@/components/ui/tabs"
import { CandidateOverviewTab } from "@/components/jobs/workspace/candidate-overview-tab"
import { CandidateScorecardTab } from "@/components/jobs/workspace/candidate-scorecard-tab"
import { CandidateEvaluationTab } from "@/components/jobs/workspace/candidate-evaluation-tab"
import { CandidateBackgroundTab } from "@/components/jobs/workspace/candidate-background-tab"
import { CandidateActivityTab } from "@/components/jobs/workspace/candidate-activity-tab"
import type { PipelineCandidate } from "@/lib/pipeline-candidates"

/** Right-hand elaboration of the selected candidate — same header+tabs shape as the candidate workspace page. */
export function PipelineCandidateDetail({
  candidate,
}: {
  candidate: PipelineCandidate
}) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="h-10 shrink-0 bg-gradient-to-r from-brand-orange-500 to-brand-purple-600" />

      <div className="shrink-0 space-y-4 bg-white p-4">
        <div className="flex items-center gap-3">
          <CandidateAvatar name={candidate.full_name} className="size-14 text-base" />
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-semibold tracking-tight">
                {candidate.full_name}
              </h2>
              <TierBadge tier={candidate.tier} />
            </div>
            <p className="text-muted-foreground">
              {candidate.title} at {candidate.company} • {candidate.location}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <ContactPill
            href={candidate.linkedin_url}
            icon={<LinkedinIcon className="size-3.5" />}
            label="LinkedIn profile"
            className="bg-white"
          />
          <ContactPill
            href={`mailto:${candidate.email}`}
            icon={<Mail className="size-3.5" />}
            label={candidate.email}
            className="bg-white"
          />
          <ContactPill
            href={`tel:${candidate.phone}`}
            icon={<Phone className="size-3.5" />}
            label={candidate.phone}
            className="bg-white"
          />
          <ContactPill
            href={candidate.github_url}
            icon={<GithubIcon className="size-3.5" />}
            label="GitHub profile"
            className="bg-white"
          />
        </div>
      </div>

      <Tabs defaultValue="overview" className="flex min-h-0 flex-1 flex-col gap-0">
        <TabsList className="shrink-0 bg-white px-4">
          <TabsTab value="overview">Overview</TabsTab>
          <TabsTab value="scorecard">Scorecard</TabsTab>
          <TabsTab value="evaluation">Evaluation</TabsTab>
          <TabsTab value="background">Background</TabsTab>
          <TabsTab value="activity">Activity</TabsTab>
          <TabsTab value="files">Files</TabsTab>
        </TabsList>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <TabsPanel value="overview">
            <CandidateOverviewTab />
          </TabsPanel>

          {/* Every candidate here is already in this job's pipeline, so
              Scorecard/Evaluation always apply — unlike the general candidate
              profile page, there's no "not added" state to gate on. */}
          <TabsPanel value="scorecard">
            <CandidateScorecardTab />
          </TabsPanel>

          <TabsPanel value="evaluation">
            <CandidateEvaluationTab />
          </TabsPanel>

          <TabsPanel value="background">
            <CandidateBackgroundTab />
          </TabsPanel>

          <TabsPanel value="activity">
            <CandidateActivityTab />
          </TabsPanel>

          <TabsPanel value="files">
            <p className="text-sm text-muted-foreground">No files uploaded yet.</p>
          </TabsPanel>
        </div>
      </Tabs>
    </div>
  )
}
