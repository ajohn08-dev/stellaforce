import { notFound } from "next/navigation"

import { SetWorkflowBreadcrumb } from "@/components/workflows/set-workflow-breadcrumb"
import { WorkflowDetailHeader } from "@/components/workflows/workflow-detail-header"
import { WorkflowDetailTabs } from "@/components/workflows/workflow-detail-tabs"
import { MOCK_WORKFLOWS, type MockWorkflow } from "@/lib/mock-workflows"
import { getWorkflowTemplate } from "@/lib/data"

// Layout/content beyond the Basic tab is a placeholder — Stages, Scheduling
// Policy, AI & Automation, and Communication are stubs to be specified
// later. Renders from MOCK_WORKFLOWS just like the list, since there's no
// workflow_templates table yet (see CLAUDE.md build order). Full white
// background (overrides <main>'s default gray), unlike the candidate detail
// page's white card with a gray margin. SetWorkflowBreadcrumb and
// WorkflowDetailHeader both render null — they register content into the
// app's shared top nav (breadcrumb, and Run/Save/Publish replacing the
// default notifications/avatar) rather than rendering inline here. No
// padding on this root — WorkflowDetailTabs insets its own tab bar and
// panel content instead, so the tab bar can sit flush under the app header.
export default async function WorkflowDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  // Real DB template first; fall back to the mock fixtures for legacy wf-* ids.
  const template = await getWorkflowTemplate(id)
  const workflow: MockWorkflow | undefined = template
    ? {
        workflow_id: template.id,
        name: template.name,
        status: template.status,
        description: template.description ?? "",
        department: template.department ?? "General",
        client_name: template.client?.client_name ?? null,
        created_by: "",
        created_at: template.created_at,
        updated_at: template.updated_at,
        stages: template.sub_stages.map((s) => ({
          id: s.id,
          mainStage: (s.pipeline_stage?.key ?? "screen") as MockWorkflow["stages"][number]["mainStage"],
          name: s.name,
          purpose: s.purpose ?? "",
          scale: "star",
        })),
      }
    : MOCK_WORKFLOWS.find((w) => w.workflow_id === id)
  if (!workflow) notFound()

  return (
    <div
      className="flex flex-col overflow-hidden bg-white"
      style={{ height: "calc(100vh - 3.5rem)" }}
    >
      <SetWorkflowBreadcrumb name={workflow.name} status={workflow.status} />
      <WorkflowDetailHeader />
      <WorkflowDetailTabs workflow={workflow} />
    </div>
  )
}
