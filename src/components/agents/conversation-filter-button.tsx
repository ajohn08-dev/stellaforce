"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { Filter } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ConversationAgentFilterSubmenuItem } from "@/components/agents/conversation-filter-menu"
import { listToParam, parseAgentNamesParam } from "@/lib/conversation-filters"

/** "Filter" opens a menu of filterable fields — currently just Agent, which also has its own always-visible chip in the toolbar. */
export function ConversationFilterButton({ options }: { options: string[] }) {
  const router = useRouter()
  const params = useSearchParams()

  const agents = parseAgentNamesParam(params.get("agents"), options) ?? options

  function setParam(values: string[]) {
    const sp = new URLSearchParams(params.toString())
    sp.set("agents", listToParam(values))
    router.push(`/agents/conversations?${sp.toString()}`)
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
        <ConversationAgentFilterSubmenuItem
          options={options}
          selected={agents}
          onChange={setParam}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
