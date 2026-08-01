"use client"

import * as React from "react"
import Link from "next/link"
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
import { deleteJob } from "@/app/(app)/jobs/actions"
import type { MockJob } from "@/lib/mock-jobs"

export function JobActions({ job }: { job: MockJob }) {
  const router = useRouter()
  const [pending, startTransition] = React.useTransition()
  const stub = (action: string) =>
    toast.info(`Not wired up yet — ${action} is coming soon.`)

  function handleDelete() {
    if (!window.confirm(`Delete draft job "${job.title}"? This can't be undone.`)) return
    startTransition(async () => {
      const res = await deleteJob(job.job_id)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success("Draft job deleted.")
      router.refresh()
    })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Actions for ${job.title}`}
          >
            <MoreVertical />
          </Button>
        }
      />
      <DropdownMenuContent>
        <DropdownMenuItem render={<Link href={`/jobs/${job.job_id}`} />}>
          View details
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => stub("editing this job")}>
          Edit job
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => stub("duplicating this job")}>
          Duplicate
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => stub("closing this job")}>
          Close job
        </DropdownMenuItem>
        {job.status === "draft" && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              disabled={pending}
              onClick={handleDelete}
              className="text-destructive focus:text-destructive"
            >
              {pending ? "Deleting…" : "Delete draft"}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
