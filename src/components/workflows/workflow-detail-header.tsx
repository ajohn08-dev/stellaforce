"use client"

import { Play } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { useSetHeaderActions } from "@/lib/header-actions-context"

/**
 * Registers Run/Save/Publish as the app header's right-side content while
 * the workflow detail page is mounted, replacing the default
 * notifications/avatar block (see useSetHeaderActions). The breadcrumb
 * (name + status) is set separately — see SetWorkflowBreadcrumb. Actions
 * are unwired stubs for now (see WorkflowDetailTabs' Basic tab and the
 * sibling stub tabs) — this is a UI shell to be specified further later.
 */
export function WorkflowDetailHeader() {
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
      <Button
        variant="secondary"
        onClick={() => toast.info("Not wired up yet — saving is coming soon.")}
      >
        Save
      </Button>
      <Button onClick={() => toast.info("Not wired up yet — publishing is coming soon.")}>
        Publish
      </Button>
    </div>
  )

  return null
}
