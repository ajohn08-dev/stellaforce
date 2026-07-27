"use client"

import * as React from "react"

import { AnalyticsStatCard } from "@/components/agents/analytics/analytics-stat-card"
import { MetricBarChart } from "@/components/agents/analytics/metric-bar-chart"
import { MetricDimensionToggle } from "@/components/agents/analytics/metric-dimension-toggle"
import {
  SYSTEM_HEALTH_STATS,
  SYSTEM_HEALTH_BREAKDOWNS,
  METRIC_DIMENSIONS,
  type MetricDimension,
  type SystemHealthMetricKey,
} from "@/lib/mock-agent-analytics"

export function SystemHealthPanel() {
  const [selectedKey, setSelectedKey] = React.useState<SystemHealthMetricKey>(
    SYSTEM_HEALTH_STATS[0].key
  )
  const [dimension, setDimension] = React.useState<MetricDimension>("job")

  const selectedStat = SYSTEM_HEALTH_STATS.find((s) => s.key === selectedKey)!
  const dimensionLabel = METRIC_DIMENSIONS.find((d) => d.value === dimension)!.label
  const breakdown = SYSTEM_HEALTH_BREAKDOWNS[selectedKey][dimension]

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {SYSTEM_HEALTH_STATS.map(({ key, ...stat }) => (
          <AnalyticsStatCard
            key={key}
            {...stat}
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
        <MetricBarChart data={breakdown} />
      </div>
    </>
  )
}
