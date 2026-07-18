"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { Filter } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { JobStatusFilterSubmenuItem } from "@/components/jobs/job-status-filter-menu"
import { parseStatusesParam, statusesToParam } from "@/lib/job-status"

/**
 * "Filter" opens a menu of filterable fields (currently just Status — more
 * are coming). Each field cascades its own options into a submenu rather
 * than exposing them directly here.
 */
export function JobFilterButton() {
  const router = useRouter()
  const params = useSearchParams()
  const statuses = parseStatusesParam(params.get("statuses"))

  function setStatuses(next: string[]) {
    const sp = new URLSearchParams(params.toString())
    sp.set("statuses", statusesToParam(next))
    router.push(`/jobs?${sp.toString()}`)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button type="button" variant="outline" className="gap-1.5">
            <Filter className="size-4" />
            Filter
          </Button>
        }
      />
      <DropdownMenuContent>
        <JobStatusFilterSubmenuItem selected={statuses} onChange={setStatuses} />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
