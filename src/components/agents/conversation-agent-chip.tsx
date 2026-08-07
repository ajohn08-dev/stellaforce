"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { ChevronDown, X } from "lucide-react"

import { ConversationAgentFilterMenu } from "@/components/agents/conversation-filter-menu"
import { AGENT_NAME_OPTIONS, listToParam, parseAgentNamesParam } from "@/lib/conversation-filters"

/**
 * Always-visible Agent pill: "Agent: All" by default, narrows to specific
 * agents via the dropdown. Unlike a hide-until-narrowed pill, this one
 * always shows so "All" is visible as the explicit default state.
 */
export function ConversationAgentChip() {
  const router = useRouter()
  const params = useSearchParams()
  const agents = parseAgentNamesParam(params.get("agents"))

  function setParam(values: string[]) {
    const sp = new URLSearchParams(params.toString())
    sp.set("agents", listToParam(values))
    router.push(`/agents/conversations?${sp.toString()}`)
  }

  const summary =
    agents.length === AGENT_NAME_OPTIONS.length
      ? "All"
      : agents.length === 0
        ? "None"
        : agents.join(", ")

  return (
    <div className="inline-flex items-center gap-1 rounded-full bg-accent py-1 pr-1 pl-3 text-xs font-medium text-accent-foreground">
      <ConversationAgentFilterMenu
        options={AGENT_NAME_OPTIONS}
        selected={agents}
        align="start"
        onChange={setParam}
        trigger={
          <button type="button" className="flex max-w-80 items-center gap-1">
            <span className="truncate">Agent: {summary}</span>
            <ChevronDown className="size-3 shrink-0" />
          </button>
        }
      />
      <span className="h-4 w-px bg-accent-foreground/20" aria-hidden />
      <button
        type="button"
        aria-label="Remove agent filter"
        onClick={() => setParam([...AGENT_NAME_OPTIONS])}
        className="rounded-full p-1 hover:bg-accent-foreground/10"
      >
        <X className="size-3" />
      </button>
    </div>
  )
}
