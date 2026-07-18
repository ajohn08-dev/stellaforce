"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { ChevronDown, X } from "lucide-react"

import { JobStatusFilterMenu } from "@/components/jobs/job-status-filter-menu"
import { titleCase } from "@/lib/constants"
import {
  JOB_STATUS_OPTIONS,
  parseStatusesParam,
  statusesToParam,
} from "@/lib/job-status"

/** Row of removable/editable pills for currently active filters, shown above the list. */
export function JobActiveFilters() {
  const router = useRouter()
  const params = useSearchParams()
  const statuses = parseStatusesParam(params.get("statuses"))

  if (statuses.length === 0) return null

  function setStatuses(next: string[]) {
    const sp = new URLSearchParams(params.toString())
    sp.set("statuses", statusesToParam(next))
    router.push(`/jobs?${sp.toString()}`)
  }

  const label = JOB_STATUS_OPTIONS.filter((s) => statuses.includes(s))
    .map(titleCase)
    .join(", ")

  return (
    <div className="flex items-center gap-2">
      <div className="inline-flex items-center gap-1 rounded-full bg-accent py-1 pr-1 pl-3 text-xs font-medium text-accent-foreground">
        <JobStatusFilterMenu
          selected={statuses}
          align="start"
          onChange={setStatuses}
          trigger={
            <button type="button" className="flex items-center gap-1">
              Status: {label}
              <ChevronDown className="size-3" />
            </button>
          }
        />
        <span className="h-4 w-px bg-accent-foreground/20" aria-hidden />
        <button
          type="button"
          aria-label="Remove status filter"
          onClick={() => setStatuses([])}
          className="rounded-full p-1 hover:bg-accent-foreground/10"
        >
          <X className="size-3" />
        </button>
      </div>
    </div>
  )
}
