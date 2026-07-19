"use client"

import { UserPlus } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"

/** Secondary action, only shown for open roles — not wired up to applications yet. */
export function AddCandidateToJobButton() {
  return (
    <Button
      variant="outline"
      className="gap-1.5"
      onClick={() =>
        toast.info(
          "Not wired up yet — adding a candidate to this job is coming soon."
        )
      }
    >
      <UserPlus className="size-4" />
      Add candidate
    </Button>
  )
}
