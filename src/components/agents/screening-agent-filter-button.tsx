"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { Filter } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ScreeningAgentChecklistFilterSubmenuItem } from "@/components/agents/screening-agent-filter-menu"
import { titleCase } from "@/lib/constants"
import {
  AGENT_STATUS_OPTIONS,
  listToParam,
  parseAgentStatusesParam,
} from "@/lib/screening-agent-status"

/** "Filter" opens a menu of filterable fields — currently just Status, which also has its own always-visible chip in the toolbar. */
export function ScreeningAgentFilterButton() {
  const router = useRouter()
  const params = useSearchParams()

  const statuses = parseAgentStatusesParam(params.get("statuses"))

  function setParam(key: string, values: string[]) {
    const sp = new URLSearchParams(params.toString())
    sp.set(key, listToParam(values))
    router.push(`/agents/home?${sp.toString()}`)
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
        <ScreeningAgentChecklistFilterSubmenuItem
          label="Status"
          options={AGENT_STATUS_OPTIONS}
          selected={statuses}
          onChange={(v) => setParam("statuses", v)}
          formatLabel={titleCase}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
