"use client"

import Link from "next/link"
import { MoreVertical } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { MockJob } from "@/lib/mock-jobs"

/** Presentational only — nothing here is wired up to a job_orders write yet. */
export function JobActions({ job }: { job: MockJob }) {
  const stub = (action: string) =>
    toast.info(`Not wired up yet — ${action} is coming soon.`)

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
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
