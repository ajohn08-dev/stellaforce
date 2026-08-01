"use client"

import { Tabs, TabsList, TabsPanel, TabsTab } from "@/components/ui/tabs"
import { WorkflowAiAutomationTab } from "@/components/workflows/workflow-ai-automation-tab"
import { WorkflowBasicTab } from "@/components/workflows/workflow-basic-tab"
import { WorkflowSchedulingPolicyTab } from "@/components/workflows/workflow-scheduling-policy-tab"
import { WorkflowStagesTab } from "@/components/workflows/workflow-stages-tab"
import { WorkflowStubTab } from "@/components/workflows/workflow-stub-tab"
import type { MockWorkflow } from "@/lib/mock-workflows"

export function WorkflowDetailTabs({ workflow }: { workflow: MockWorkflow }) {
  return (
    <Tabs defaultValue="basic" className="min-h-0 flex-1 gap-0">
      <TabsList className="pr-6 pl-3">
        <TabsTab value="basic">Basic</TabsTab>
        <TabsTab value="stages">Stages</TabsTab>
        <TabsTab value="scheduling-policy">Scheduling Policy</TabsTab>
        <TabsTab value="ai-automation">AI & Automation</TabsTab>
        <TabsTab value="communication">Communication</TabsTab>
      </TabsList>

      {/*
        keepMounted on every panel: these tabs hold local form state with no
        autosave, so switching tabs must not unmount (and silently discard)
        whatever the user was mid-typing in the one they're leaving.
      */}
      <TabsPanel
        value="basic"
        keepMounted
        className="min-h-0 flex-1 overflow-y-auto px-6 pt-6 pb-4"
      >
        <WorkflowBasicTab workflow={workflow} />
      </TabsPanel>
      <TabsPanel value="stages" keepMounted className="min-h-0 flex-1 overflow-hidden">
        <WorkflowStagesTab workflow={workflow} />
      </TabsPanel>
      <TabsPanel
        value="scheduling-policy"
        keepMounted
        className="min-h-0 flex-1 overflow-y-auto px-6 pt-6 pb-4"
      >
        <WorkflowSchedulingPolicyTab />
      </TabsPanel>
      <TabsPanel
        value="ai-automation"
        keepMounted
        className="min-h-0 flex-1 overflow-hidden px-6 pt-6 pb-4"
      >
        <WorkflowAiAutomationTab />
      </TabsPanel>
      <TabsPanel
        value="communication"
        keepMounted
        className="min-h-0 flex-1 overflow-y-auto px-6 pt-6 pb-4"
      >
        <WorkflowStubTab label="Communication" />
      </TabsPanel>
    </Tabs>
  )
}
