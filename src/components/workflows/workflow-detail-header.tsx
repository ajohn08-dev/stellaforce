"use client"

import { Play } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { useSetHeaderActions } from "@/lib/header-actions-context"
import { useWorkflowEdit } from "@/components/workflows/workflow-edit-provider"

/**
 * Registers Run/Save/Publish as the app header's right-side content while
 * the workflow detail page is mounted, replacing the default
 * notifications/avatar block (see useSetHeaderActions). The breadcrumb
 * (name + status) is set separately — see SetWorkflowBreadcrumb. Run/Publish
 * are still unwired stubs. Save persists the Basic and Stages tabs (see
 * WorkflowEditProvider and each tab's useWorkflowEditTab call) — Scheduling
 * Policy/AI & Automation/Communication remain a UI shell with no backing
 * schema yet.
 */
export function WorkflowDetailHeader() {
  const { saveAll, saving, isDirty } = useWorkflowEdit()

  async function handleSave() {
    const res = await saveAll()
    if (!res.ok) {
      toast.error(res.error)
      return
    }
    toast.success("Workflow saved.")
  }

  useSetHeaderActions(
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        className="gap-1.5"
        onClick={() => toast.info("Not wired up yet — running a workflow is coming soon.")}
      >
        <Play className="size-4" />
        Run
      </Button>
      {/* Disabled (not just while saving) until there's an actual unsaved
          change — otherwise the button looks identical whether or not any
          tab is dirty, which reads as "this isn't reacting to my edits." */}
      <Button variant="secondary" onClick={handleSave} disabled={saving || !isDirty}>
        {saving ? "Saving…" : "Save"}
      </Button>
      <Button onClick={() => toast.info("Not wired up yet — publishing is coming soon.")}>
        Publish
      </Button>
    </div>
  )

  return null
}
