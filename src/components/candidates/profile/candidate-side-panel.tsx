"use client"

import { Tabs, TabsList, TabsPanel, TabsTab } from "@/components/ui/tabs"
import { ActivityTab } from "@/components/candidates/profile/activity-tab"
import { FilesTab } from "@/components/candidates/profile/files-tab"

export function CandidateSidePanel({ candidateId }: { candidateId: string }) {
  return (
    <Tabs defaultValue="activity">
      <TabsList>
        <TabsTab value="activity">Activity</TabsTab>
        <TabsTab value="files">Files</TabsTab>
      </TabsList>
      <TabsPanel value="activity">
        <ActivityTab candidateId={candidateId} />
      </TabsPanel>
      <TabsPanel value="files">
        <FilesTab candidateId={candidateId} />
      </TabsPanel>
    </Tabs>
  )
}
