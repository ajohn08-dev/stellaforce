"use client"

import { Tabs, TabsList, TabsPanel, TabsTab } from "@/components/ui/tabs"
import { ActivityTab } from "@/components/candidates/profile/activity-tab"
import { FilesTab } from "@/components/candidates/profile/files-tab"
import type { AddedByProfile } from "@/lib/data"

export function CandidateSidePanel({
  candidateId,
  addedBy,
  dateAdded,
}: {
  candidateId: string
  addedBy: AddedByProfile | null
  dateAdded: string
}) {
  return (
    <Tabs defaultValue="activity" className="min-h-0 flex-1 gap-0">
      <div className="shrink-0 border-b border-border px-6 pt-6">
        <TabsList className="border-b-0">
          <TabsTab value="activity">Activity</TabsTab>
          <TabsTab value="files">Files</TabsTab>
        </TabsList>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-6 pt-4 pb-6">
        <TabsPanel value="activity">
          <ActivityTab addedBy={addedBy} dateAdded={dateAdded} />
        </TabsPanel>
        <TabsPanel value="files">
          <FilesTab candidateId={candidateId} />
        </TabsPanel>
      </div>
    </Tabs>
  )
}
