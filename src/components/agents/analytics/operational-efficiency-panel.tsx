"use client"

import * as React from "react"

import { AnalyticsStatCard } from "@/components/agents/analytics/analytics-stat-card"
import { MetricBarChart } from "@/components/agents/analytics/metric-bar-chart"
import { MetricDimensionToggle } from "@/components/agents/analytics/metric-dimension-toggle"
import {
  OPERATIONAL_EFFICIENCY_STATS,
  OPERATIONAL_EFFICIENCY_BREAKDOWNS,
  OPERATIONAL_EFFICIENCY_CHART_CONFIG,
  METRIC_DIMENSIONS,
  type MetricDimension,
  type OperationalEfficiencyMetricKey,
} from "@/lib/mock-agent-analytics"

export function OperationalEfficiencyPanel({ comparisonLabel }: { comparisonLabel: string }) {
  const [selectedKey, setSelectedKey] = React.useState<OperationalEfficiencyMetricKey>(
    OPERATIONAL_EFFICIENCY_STATS[0].key
  )
  const [dimension, setDimension] = React.useState<MetricDimension>("job")

  const selectedStat = OPERATIONAL_EFFICIENCY_STATS.find((s) => s.key === selectedKey)!
  const dimensionLabel = METRIC_DIMENSIONS.find((d) => d.value === dimension)!.label
  const breakdown = OPERATIONAL_EFFICIENCY_BREAKDOWNS[selectedKey][dimension]
  const chartConfig = OPERATIONAL_EFFICIENCY_CHART_CONFIG[selectedKey]

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {OPERATIONAL_EFFICIENCY_STATS.map(({ key, ...stat }) => (
          <AnalyticsStatCard
            key={key}
            {...stat}
            comparisonLabel={comparisonLabel}
            active={key === selectedKey}
            onClick={() => setSelectedKey(key)}
          />
        ))}
      </div>

      <div className="rounded-lg border border-border bg-white p-4">
        <div className="mb-6 flex items-center justify-between gap-4">
          <p className="text-sm font-medium text-muted-foreground">
            {selectedStat.label} by {dimensionLabel}
          </p>
          <MetricDimensionToggle value={dimension} onChange={setDimension} />
        </div>
        <MetricBarChart
          data={breakdown}
          yMax={chartConfig.yMax}
          yTicks={chartConfig.yTicks}
          valueSuffix={chartConfig.valueSuffix}
        />
      </div>
    </>
  )
}
