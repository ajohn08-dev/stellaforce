"use client"

import * as React from "react"

import { AnalyticsSection } from "@/components/agents/analytics/analytics-section"
import { AnalyticsFilterBar } from "@/components/agents/analytics/analytics-filter-bar"
import { SystemHealthPanel } from "@/components/agents/analytics/system-health-panel"
import { OperationalEfficiencyPanel } from "@/components/agents/analytics/operational-efficiency-panel"
import { CandidateFunnelCard } from "@/components/agents/analytics/candidate-funnel-card"
import { RankedBarList } from "@/components/agents/analytics/ranked-bar-list"
import {
  SUSPICIOUS_ANSWER_RATE_BY_JOB,
  BOT_LIKELIHOOD_BY_JOB,
  COMPLIANCE_ESCALATE_REASONS,
  TOP_EXCEPTION_REASONS,
  DEFAULT_ANALYTICS_DATE_RANGE,
  getAnalyticsComparisonLabel,
  type AnalyticsDateRange,
} from "@/lib/mock-agent-analytics"

export default function AgentAnalyticsPage() {
  const [dateRange, setDateRange] = React.useState<AnalyticsDateRange>(
    DEFAULT_ANALYTICS_DATE_RANGE
  )
  const comparisonLabel = getAnalyticsComparisonLabel(dateRange)

  return (
    <div
      className="flex flex-col overflow-hidden"
      // Inline style, not an arbitrary Tailwind class: <main> has no padding
      // of its own — every section below manages its own — so only the app
      // header (h-14 = 3.5rem) needs subtracting. Fixed (not min-) height so
      // the filter bar stays put and only the sections below it scroll.
      style={{ height: "calc(100vh - 3.5rem)" }}
    >
      <div className="shrink-0 border-b border-border px-4 py-4">
        <AnalyticsFilterBar dateRange={dateRange} onDateRangeChange={setDateRange} />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex flex-col gap-8 p-4">
          <AnalyticsSection title="System Health">
            <SystemHealthPanel comparisonLabel={comparisonLabel} />
          </AnalyticsSection>

          <AnalyticsSection>
            <CandidateFunnelCard />
          </AnalyticsSection>

          <AnalyticsSection title="Operational Efficiency">
            <OperationalEfficiencyPanel comparisonLabel={comparisonLabel} />
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
      </div>
    </div>
  )
}
