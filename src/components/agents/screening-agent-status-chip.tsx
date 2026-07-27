"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { ChevronDown, X } from "lucide-react"

import { ScreeningAgentChecklistFilterMenu } from "@/components/agents/screening-agent-filter-menu"
import { titleCase } from "@/lib/constants"
import {
  AGENT_STATUS_OPTIONS,
  listToParam,
  parseAgentStatusesParam,
} from "@/lib/screening-agent-status"

/**
 * Always-visible Status pill: "Status: All" by default, narrows to
 * Active/Inactive/None via the dropdown. Unlike a hide-until-narrowed pill,
 * this one always shows so "All" is visible as the explicit default state.
 */
export function ScreeningAgentStatusChip() {
  const router = useRouter()
  const params = useSearchParams()
  const statuses = parseAgentStatusesParam(params.get("statuses"))

  function setParam(values: string[]) {
    const sp = new URLSearchParams(params.toString())
    sp.set("statuses", listToParam(values))
    router.push(`/agents/home?${sp.toString()}`)
  }

  const summary =
    statuses.length === AGENT_STATUS_OPTIONS.length
      ? "All"
      : statuses.length === 0
        ? "None"
        : statuses.map(titleCase).join(", ")

  return (
    <div className="inline-flex items-center gap-1 rounded-full bg-accent py-1 pr-1 pl-3 text-xs font-medium text-accent-foreground">
      <ScreeningAgentChecklistFilterMenu
        label="Status"
        options={AGENT_STATUS_OPTIONS}
        selected={statuses}
        align="start"
        onChange={setParam}
        formatLabel={titleCase}
        trigger={
          <button type="button" className="flex items-center gap-1">
            Status: {summary}
            <ChevronDown className="size-3" />
          </button>
        }
      />
      <span className="h-4 w-px bg-accent-foreground/20" aria-hidden />
      <button
        type="button"
        aria-label="Remove status filter"
        onClick={() => setParam([...AGENT_STATUS_OPTIONS])}
        className="rounded-full p-1 hover:bg-accent-foreground/10"
      >
        <X className="size-3" />
      </button>
    </div>
  )
}
