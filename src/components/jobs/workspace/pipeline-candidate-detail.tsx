import { Mail, Phone } from "lucide-react"

import { CandidateAvatar } from "@/components/candidate-avatar"
import { ContactPill } from "@/components/contact-pill"
import { GithubIcon, LinkedinIcon } from "@/components/icons/brand-icons"
import { TierBadge } from "@/components/tier-badge"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsPanel, TabsTab } from "@/components/ui/tabs"
import type { PipelineCandidate } from "@/lib/pipeline-candidates"

/** Right-hand elaboration of the selected candidate — same header+tabs shape as the candidate workspace page. */
export function PipelineCandidateDetail({
  candidate,
}: {
  candidate: PipelineCandidate
}) {
  return (
    <div className="space-y-4">
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
        />
        <ContactPill
          href={`mailto:${candidate.email}`}
          icon={<Mail className="size-3.5" />}
          label={candidate.email}
        />
        <ContactPill
          href={`tel:${candidate.phone}`}
          icon={<Phone className="size-3.5" />}
          label={candidate.phone}
        />
        <ContactPill
          href={candidate.github_url}
          icon={<GithubIcon className="size-3.5" />}
          label="GitHub profile"
        />
      </div>

      <Tabs defaultValue="overview" className="gap-3">
        <TabsList>
          <TabsTab value="overview">Overview</TabsTab>
          <TabsTab value="experience">Experience</TabsTab>
          <TabsTab value="education">Education</TabsTab>
          <TabsTab value="skill-map">Skill Map</TabsTab>
          <TabsTab value="activity">Activity</TabsTab>
          <TabsTab value="files">Files</TabsTab>
        </TabsList>

        <TabsPanel value="overview" className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {candidate.days_in_stage} day{candidate.days_in_stage === 1 ? "" : "s"} in
            this stage.
          </p>
          <p className="text-sm">{candidate.summary}</p>
        </TabsPanel>

        <TabsPanel value="experience">
          <div className="rounded-lg border border-border p-3">
            <p className="text-sm font-medium">{candidate.title}</p>
            <p className="text-sm text-muted-foreground">
              {candidate.company} • {candidate.location}
            </p>
          </div>
        </TabsPanel>

        <TabsPanel value="education">
          <p className="text-sm text-muted-foreground">No education on file yet.</p>
        </TabsPanel>

        <TabsPanel value="skill-map">
          <div className="flex flex-wrap gap-2">
            {candidate.skills.map((skill) => (
              <Badge key={skill} variant="secondary">
                {skill}
              </Badge>
            ))}
          </div>
        </TabsPanel>

        <TabsPanel value="activity">
          <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
        </TabsPanel>

        <TabsPanel value="files">
          <p className="text-sm text-muted-foreground">No files uploaded yet.</p>
        </TabsPanel>
      </Tabs>
    </div>
  )
}
