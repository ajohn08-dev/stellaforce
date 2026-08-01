"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { createWorkflowTemplate } from "@/app/(app)/workflows/actions"

/** Creates a real draft workflow_templates row and opens its detail page. */
export function AddWorkflowButton() {
  const router = useRouter()
  const [pending, startTransition] = React.useTransition()

  function create() {
    startTransition(async () => {
      const res = await createWorkflowTemplate({ name: "Untitled Workflow" })
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      router.push(`/workflows/${res.id}`)
    })
  }

  return (
    <Button onClick={create} disabled={pending}>
      {pending ? "Creating…" : "New Workflow"}
    </Button>
  )
}
