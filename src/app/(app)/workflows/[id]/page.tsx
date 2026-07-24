import { notFound } from "next/navigation"

import { SetWorkflowBreadcrumb } from "@/components/workflows/set-workflow-breadcrumb"
import { WorkflowDetailTabs } from "@/components/workflows/workflow-detail-tabs"
import { MOCK_WORKFLOWS } from "@/lib/mock-workflows"

// Layout/content beyond the Basic tab is a placeholder — Stages, Scheduling
// Policy, AI & Automation, and Communication are stubs to be specified
// later. Renders from MOCK_WORKFLOWS just like the list, since there's no
// workflow_templates table yet (see CLAUDE.md build order). No white-card
// wrapper here (unlike the candidate detail page) — this page keeps the
// app's gray background. The Run/Save/Publish actions live inside
// WorkflowDetailTabs' tab-list row, not as a separate header above it.
export default async function WorkflowDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const workflow = MOCK_WORKFLOWS.find((w) => w.workflow_id === id)
  if (!workflow) notFound()

  return (
    <div
      className="flex flex-col gap-4 overflow-hidden p-4"
      style={{ height: "calc(100vh - 3.5rem)" }}
    >
      <SetWorkflowBreadcrumb name={workflow.name} status={workflow.status} />
      <WorkflowDetailTabs workflow={workflow} />
    </div>
  )
}
