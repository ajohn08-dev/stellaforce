import { AnalyticsStatCard } from "@/components/agents/analytics/analytics-stat-card"
import { ScreeningAgentCard } from "@/components/agents/screening-agent-card"
import { ScreeningAgentsList } from "@/components/agents/screening-agents-list"
import { ScreeningAgentSearch } from "@/components/agents/screening-agent-search"
import { ScreeningAgentFilterButton } from "@/components/agents/screening-agent-filter-button"
import { ScreeningAgentStatusChip } from "@/components/agents/screening-agent-status-chip"
import { ScreeningAgentViewToggle } from "@/components/agents/screening-agent-view-toggle"
import { AddScreeningAgentButton } from "@/components/agents/add-screening-agent-button"
import { MOCK_SCREENING_AGENTS } from "@/lib/mock-agents"
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

  const agents = MOCK_SCREENING_AGENTS.filter((agent) => {
    if (!statuses.includes(agent.status)) return false
    if (q && !agent.name.toLowerCase().includes(q)) return false
    return true
  })

  const view = get("view") === "list" ? "list" : "grid"

  const activeCount = MOCK_SCREENING_AGENTS.filter((a) => a.status === "active").length
  const avgHandleTime =
    MOCK_SCREENING_AGENTS.reduce((sum, a) => sum + a.avg_handle_time_minutes, 0) /
    MOCK_SCREENING_AGENTS.length

  const stats = [
    { label: "Total Agents", value: String(MOCK_SCREENING_AGENTS.length) },
    { label: "Active Agents", value: String(activeCount) },
    { label: "Average Handle Time", value: `${avgHandleTime.toFixed(1)} min` },
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
              <ScreeningAgentCard key={agent.agent_id} agent={agent} />
            ))}
          </div>
        ) : (
          <ScreeningAgentsList agents={agents} />
        )}
      </div>
    </div>
  )
}
