import { AnalyticsStatCard } from "@/components/agents/analytics/analytics-stat-card"
import { ScreeningAgentCard } from "@/components/agents/screening-agent-card"
import { ScreeningAgentsList } from "@/components/agents/screening-agents-list"
import { ScreeningAgentSearch } from "@/components/agents/screening-agent-search"
import { ScreeningAgentFilterButton } from "@/components/agents/screening-agent-filter-button"
import { ScreeningAgentStatusChip } from "@/components/agents/screening-agent-status-chip"
import { ScreeningAgentViewToggle } from "@/components/agents/screening-agent-view-toggle"
import { AddScreeningAgentButton } from "@/components/agents/add-screening-agent-button"
import { getScreeningAgents } from "@/lib/data"
import { parseAgentStatusesParam } from "@/lib/screening-agent-status"

export default async function AgentHomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = await searchParams
  const get = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined)

  const statuses = parseAgentStatusesParam(get("statuses") ?? null)
  const q = get("q")?.trim().toLowerCase()

  const allAgents = await getScreeningAgents()

  const agents = allAgents.filter((agent) => {
    if (!statuses.includes(agent.status)) return false
    if (q && !agent.name.toLowerCase().includes(q)) return false
    return true
  })

  const view = get("view") === "list" ? "list" : "grid"

  const activeCount = allAgents.filter((a) => a.status === "active").length
  // avg_handle_time_minutes is numeric (arrives as a string over the wire) and
  // nullable — agents without one are excluded rather than counted as zero.
  const handleTimes = allAgents
    .map((a) => Number(a.avg_handle_time_minutes))
    .filter((n) => Number.isFinite(n))
  const avgHandleTime = handleTimes.length
    ? handleTimes.reduce((sum, n) => sum + n, 0) / handleTimes.length
    : null

  const stats = [
    { label: "Total Agents", value: String(allAgents.length) },
    { label: "Active Agents", value: String(activeCount) },
    {
      label: "Average Handle Time",
      value: avgHandleTime === null ? "\u2014" : `${avgHandleTime.toFixed(1)} min`,
    },
  ]

  return (
    <div className="flex flex-col">
      <div className="border-b border-border px-4 py-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <ScreeningAgentSearch />
            <ScreeningAgentFilterButton />
          </div>
          <AddScreeningAgentButton />
        </div>
      </div>

      <div className="px-4 pt-4">
        <div className="flex items-center justify-between gap-4">
          <ScreeningAgentStatusChip />
          <ScreeningAgentViewToggle />
        </div>
      </div>

      <div className="space-y-6 p-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {stats.map((stat) => (
            <AnalyticsStatCard key={stat.label} {...stat} />
          ))}
        </div>

        {view === "grid" ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {agents.map((agent) => (
              <ScreeningAgentCard key={agent.id} agent={agent} />
            ))}
          </div>
        ) : (
          <ScreeningAgentsList agents={agents} />
        )}
      </div>
    </div>
  )
}
