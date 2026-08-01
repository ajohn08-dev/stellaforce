"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { MoreVertical } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { deleteWorkflowTemplate } from "@/app/(app)/workflows/actions"
import type { MockWorkflow } from "@/lib/mock-workflows"

/**
 * View details/Edit workflow/Duplicate/Publish/Archive are presentational
 * only — this list renders from mock data, nothing there is wired up yet.
 * Delete is real, backed by the existing `deleteWorkflowTemplate` action.
 */
export function WorkflowActions({ workflow }: { workflow: MockWorkflow }) {
  const router = useRouter()
  const [confirmOpen, setConfirmOpen] = React.useState(false)
  const [pending, startTransition] = React.useTransition()

  const stub = (action: string) =>
    toast.info(`Not wired up yet — ${action} is coming soon.`)

  function handleDelete() {
    startTransition(async () => {
      const res = await deleteWorkflowTemplate(workflow.workflow_id)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      setConfirmOpen(false)
      toast.success(`Deleted "${workflow.name}".`)
      router.refresh()
    })
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Actions for ${workflow.name}`}
            >
              <MoreVertical />
            </Button>
          }
        />
        <DropdownMenuContent>
          <DropdownMenuItem onClick={() => stub("viewing this workflow")}>
            View details
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => stub("editing this workflow")}>
            Edit workflow
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => stub("duplicating this workflow")}>
            Duplicate
          </DropdownMenuItem>
          {workflow.status === "draft" ? (
            <DropdownMenuItem onClick={() => stub("publishing this workflow")}>
              Publish
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onClick={() => stub("archiving this workflow")}>
              Archive
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onClick={() => setConfirmOpen(true)}
          >
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this workflow?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete &quot;{workflow.name}&quot;. This action cannot
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmOpen(false)} disabled={pending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleDelete}
              disabled={pending}
            >
              {pending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
