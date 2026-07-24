"use client"

import { Tabs, TabsList, TabsPanel, TabsTab } from "@/components/ui/tabs"
import { WorkflowBasicTab } from "@/components/workflows/workflow-basic-tab"
import { WorkflowDetailHeader } from "@/components/workflows/workflow-detail-header"
import { WorkflowStubTab } from "@/components/workflows/workflow-stub-tab"
import type { MockWorkflow } from "@/lib/mock-workflows"

export function WorkflowDetailTabs({ workflow }: { workflow: MockWorkflow }) {
  return (
    <Tabs defaultValue="basic" className="min-h-0 flex-1 gap-0">
      <div className="flex shrink-0 items-center justify-between border-b border-border">
        <TabsList className="border-b-0">
          <TabsTab value="basic">Basic</TabsTab>
          <TabsTab value="stages">Stages</TabsTab>
          <TabsTab value="scheduling-policy">Scheduling Policy</TabsTab>
          <TabsTab value="ai-automation">AI & Automation</TabsTab>
          <TabsTab value="communication">Communication</TabsTab>
        </TabsList>
        <WorkflowDetailHeader />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pt-6 pb-4">
        <TabsPanel value="basic">
          <WorkflowBasicTab workflow={workflow} />
        </TabsPanel>
        <TabsPanel value="stages">
          <WorkflowStubTab label="Stages" />
        </TabsPanel>
        <TabsPanel value="scheduling-policy">
          <WorkflowStubTab label="Scheduling Policy" />
        </TabsPanel>
        <TabsPanel value="ai-automation">
          <WorkflowStubTab label="AI & Automation" />
        </TabsPanel>
        <TabsPanel value="communication">
          <WorkflowStubTab label="Communication" />
        </TabsPanel>
      </div>
    </Tabs>
  )
}
