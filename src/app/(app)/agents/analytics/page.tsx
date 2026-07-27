import { AnalyticsSection } from "@/components/agents/analytics/analytics-section"
import { AnalyticsStatCard } from "@/components/agents/analytics/analytics-stat-card"
import { ScreeningsBarChartCard } from "@/components/agents/analytics/screenings-bar-chart-card"
import { HandleTimeLineChartCard } from "@/components/agents/analytics/handle-time-line-chart-card"
import { CandidateFunnelCard } from "@/components/agents/analytics/candidate-funnel-card"
import { RankedBarList } from "@/components/agents/analytics/ranked-bar-list"
import {
  SYSTEM_HEALTH_STATS,
  OPERATIONAL_EFFICIENCY_STATS,
  SUSPICIOUS_ANSWER_RATE_BY_JOB,
  BOT_LIKELIHOOD_BY_JOB,
  COMPLIANCE_ESCALATE_REASONS,
  TOP_EXCEPTION_REASONS,
} from "@/lib/mock-agent-analytics"

export default function AgentAnalyticsPage() {
  return (
    <div className="flex flex-col gap-8 p-4">
      <AnalyticsSection title="System Health">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {SYSTEM_HEALTH_STATS.map((stat) => (
            <AnalyticsStatCard key={stat.label} {...stat} />
          ))}
        </div>
        <ScreeningsBarChartCard />
      </AnalyticsSection>

      <AnalyticsSection>
        <CandidateFunnelCard />
      </AnalyticsSection>

      <AnalyticsSection title="Operational Efficiency">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {OPERATIONAL_EFFICIENCY_STATS.map((stat) => (
            <AnalyticsStatCard key={stat.label} {...stat} />
          ))}
        </div>
        <HandleTimeLineChartCard />
      </AnalyticsSection>

      <AnalyticsSection title="Trust & Exceptions">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-lg border border-border bg-white p-4">
            <p className="text-sm font-medium text-muted-foreground">
              Suspicious Answer Rate
            </p>
            <p className="mt-1 mb-6 text-3xl font-medium tracking-tight text-foreground">
              {Math.round(
                SUSPICIOUS_ANSWER_RATE_BY_JOB.reduce((s, i) => s + i.value, 0) /
                  SUSPICIOUS_ANSWER_RATE_BY_JOB.length
              )}
              %
            </p>
            <RankedBarList items={SUSPICIOUS_ANSWER_RATE_BY_JOB} />
          </div>

          <div className="rounded-lg border border-border bg-white p-4">
            <p className="text-sm font-medium text-muted-foreground">Bot Likelihood</p>
            <p className="mt-1 mb-6 text-3xl font-medium tracking-tight text-foreground">
              {Math.round(
                BOT_LIKELIHOOD_BY_JOB.reduce((s, i) => s + i.value, 0) /
                  BOT_LIKELIHOOD_BY_JOB.length
              )}
              %
            </p>
            <RankedBarList items={BOT_LIKELIHOOD_BY_JOB} />
          </div>

          <div className="rounded-lg border border-border bg-white p-4">
            <p className="mb-6 text-sm font-medium text-muted-foreground">
              Compliance Escalate Reasons
            </p>
            <RankedBarList items={COMPLIANCE_ESCALATE_REASONS} valueSuffix="" />
          </div>

          <div className="rounded-lg border border-border bg-white p-4">
            <p className="mb-6 text-sm font-medium text-muted-foreground">
              Top Exception Reason
            </p>
            <RankedBarList items={TOP_EXCEPTION_REASONS} valueSuffix="" />
          </div>
        </div>
      </AnalyticsSection>
    </div>
  )
}
