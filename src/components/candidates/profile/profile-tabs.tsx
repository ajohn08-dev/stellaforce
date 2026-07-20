"use client"

import { Sparkles } from "lucide-react"
import { toast } from "sonner"

import { Tabs, TabsList, TabsPanel, TabsTab } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { OverviewTab } from "@/components/candidates/profile/overview-tab"
import { ScorecardTab } from "@/components/candidates/profile/scorecard-tab"
import { EvaluationTab } from "@/components/candidates/profile/evaluation-tab"
import { BackgroundTab } from "@/components/candidates/profile/background-tab"
import { SkillMapTab } from "@/components/candidates/profile/skill-map-tab"
import { ActivityTab } from "@/components/candidates/profile/activity-tab"
import { FilesTab } from "@/components/candidates/profile/files-tab"
import type { WorkHistoryEntry } from "@/lib/work-history"
import type { CandidateRow, SkillRow } from "@/lib/supabase/types"
import type { AddedByProfile } from "@/lib/data"

export function ProfileTabs({
  candidate,
  skills,
  workHistory,
  addedBy,
  dateAdded,
  isAddedToJob = false,
}: {
  candidate: CandidateRow
  skills: SkillRow[]
  workHistory: WorkHistoryEntry[]
  addedBy: AddedByProfile | null
  dateAdded: string
  /** Scorecard/Evaluation only apply once a candidate is attached to a job. */
  isAddedToJob?: boolean
}) {
  return (
    <Tabs defaultValue="overview" className="min-h-0 flex-1 gap-0">
      <div className="-mx-4 flex shrink-0 items-center justify-between border-b border-border px-4">
        <TabsList className="border-b-0">
          <TabsTab value="overview">Overview</TabsTab>
          {isAddedToJob && <TabsTab value="scorecard">Scorecard</TabsTab>}
          {isAddedToJob && <TabsTab value="evaluation">Evaluation</TabsTab>}
          <TabsTab value="background">Background</TabsTab>
          <TabsTab value="skills">Skills</TabsTab>
          <TabsTab value="activity">Activity</TabsTab>
          <TabsTab value="files">Files</TabsTab>
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

      <div className="min-h-0 flex-1 overflow-y-auto pt-4 pb-4">
        <TabsPanel value="overview">
          <OverviewTab
            candidate={candidate}
            skills={skills}
            workHistory={workHistory}
          />
        </TabsPanel>
        {isAddedToJob && (
          <TabsPanel value="scorecard">
            <ScorecardTab />
          </TabsPanel>
        )}
        {isAddedToJob && (
          <TabsPanel value="evaluation">
            <EvaluationTab />
          </TabsPanel>
        )}
        <TabsPanel value="background">
          <BackgroundTab candidate={candidate} workHistory={workHistory} />
        </TabsPanel>
        <TabsPanel value="skills">
          <SkillMapTab skills={skills} />
        </TabsPanel>
        <TabsPanel value="activity">
          <ActivityTab addedBy={addedBy} dateAdded={dateAdded} />
        </TabsPanel>
        <TabsPanel value="files">
          <FilesTab candidateId={candidate.candidate_id} />
        </TabsPanel>
      </div>
    </Tabs>
  )
}
