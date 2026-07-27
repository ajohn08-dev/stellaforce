"use client"

import { toast } from "sonner"

import { Button } from "@/components/ui/button"

/** Stub — no screening_agents table yet, so this just signals what's coming. */
export function AddScreeningAgentButton() {
  return (
    <Button
      onClick={() =>
        toast.info("Not wired up yet — creating agents is coming soon.")
      }
    >
      Create Agent
    </Button>
  )
}
