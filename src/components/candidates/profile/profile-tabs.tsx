"use client"

import { Sparkles } from "lucide-react"
import { toast } from "sonner"

import { Tabs, TabsList, TabsPanel, TabsTab } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { OverviewTab } from "@/components/candidates/profile/overview-tab"
import { ExperienceTab } from "@/components/candidates/profile/experience-tab"
import { EducationTab } from "@/components/candidates/profile/education-tab"
import { SkillMapTab } from "@/components/candidates/profile/skill-map-tab"
import type { AddedByProfile } from "@/lib/data"
import type { WorkHistoryEntry } from "@/lib/work-history"
import type { CandidateRow, SkillRow } from "@/lib/supabase/types"

export function ProfileTabs({
  candidate,
  skills,
  addedBy,
  workHistory,
}: {
  candidate: CandidateRow
  skills: SkillRow[]
  addedBy: AddedByProfile | null
  workHistory: WorkHistoryEntry[]
}) {
  return (
    <Tabs defaultValue="overview">
      <div className="flex items-center justify-between">
        <TabsList>
          <TabsTab value="overview">Overview</TabsTab>
          <TabsTab value="experience">Experience</TabsTab>
          <TabsTab value="education">Education</TabsTab>
          <TabsTab value="skill-map">Skill Map</TabsTab>
        </TabsList>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-brand-purple-600 hover:text-brand-purple-700"
          onClick={() =>
            toast.info("Not wired up yet — AI summary is coming soon.")
          }
        >
          <Sparkles className="size-4" />
          Summarize
        </Button>
      </div>

      <TabsPanel value="overview">
        <OverviewTab candidate={candidate} addedBy={addedBy} />
      </TabsPanel>
      <TabsPanel value="experience">
        <ExperienceTab workHistory={workHistory} />
      </TabsPanel>
      <TabsPanel value="education">
        <EducationTab candidate={candidate} />
      </TabsPanel>
      <TabsPanel value="skill-map">
        <SkillMapTab skills={skills} />
      </TabsPanel>
    </Tabs>
  )
}
