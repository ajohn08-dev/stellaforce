"use client"

import { MoreVertical } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { MockWorkflow } from "@/lib/mock-workflows"

/** Presentational only — this list renders from mock data, nothing here is wired up yet. */
export function WorkflowActions({ workflow }: { workflow: MockWorkflow }) {
  const stub = (action: string) =>
    toast.info(`Not wired up yet — ${action} is coming soon.`)

  return (
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
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
