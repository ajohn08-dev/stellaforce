"use client"

import { toast } from "sonner"

import { Button } from "@/components/ui/button"

/** Stub — no workflow_templates table yet, so this just signals what's coming. */
export function AddWorkflowButton() {
  return (
    <Button
      onClick={() =>
        toast.info("Not wired up yet — creating workflows is coming soon.")
      }
    >
      New Workflow
    </Button>
  )
}
