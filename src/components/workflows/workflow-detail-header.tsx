"use client"

import { Play } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"

/**
 * Run/Save/Publish actions row for the workflow detail page. The
 * breadcrumb (name + status) lives in the app's shared top-nav breadcrumb
 * instead of here — see SetWorkflowBreadcrumb, same pattern as every other
 * detail page (e.g. SetCandidateBreadcrumb). Actions are unwired stubs for
 * now (see WorkflowDetailTabs' Basic tab and the sibling stub tabs) — this
 * is a UI shell to be specified further later.
 */
export function WorkflowDetailHeader() {
  return (
    <div className="flex shrink-0 items-center justify-end gap-2">
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
}
