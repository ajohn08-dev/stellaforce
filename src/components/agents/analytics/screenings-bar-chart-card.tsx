"use client"

import * as React from "react"

import { MetricDimensionToggle } from "@/components/agents/analytics/metric-dimension-toggle"
import { cn } from "@/lib/utils"
import { SCREENINGS_TREND, type MetricDimension } from "@/lib/mock-agent-analytics"

const CHART_HEIGHT = 220
/** Clean round ticks above the highest bar, so gridlines read as real values. */
const Y_MAX = 320
const Y_TICKS = [0, 80, 160, 240, 320]

export function ScreeningsBarChartCard() {
  const [dimension, setDimension] = React.useState<MetricDimension>("job")
  const [hovered, setHovered] = React.useState<number | null>(null)
  const data = SCREENINGS_TREND[dimension]

  return (
    <div className="rounded-lg border border-border bg-white p-4">
      <div className="mb-6 flex items-center justify-between gap-4">
        <p className="text-sm font-medium text-muted-foreground">
          Screenings Completed per Week
        </p>
        <MetricDimensionToggle value={dimension} onChange={setDimension} />
      </div>

      <div className="flex" style={{ height: CHART_HEIGHT }}>
        <div
          className="flex flex-col justify-between pr-3 text-right text-xs text-muted-foreground"
          style={{ height: CHART_HEIGHT }}
        >
          {[...Y_TICKS].reverse().map((t) => (
            <span key={t}>{t.toLocaleString()}</span>
          ))}
        </div>

        <div className="relative flex flex-1 items-end justify-between gap-3">
          {Y_TICKS.map((t) => (
            <div
              key={t}
              className="absolute right-0 left-0 border-t border-border"
              style={{ bottom: `${(t / Y_MAX) * 100}%` }}
              aria-hidden
            />
          ))}

          {data.map((point, i) => (
            <div
              key={point.label}
              className="relative z-10 flex h-full flex-1 flex-col items-center justify-end"
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered((h) => (h === i ? null : h))}
            >
              {hovered === i && (
                <div className="absolute -top-9 z-20 rounded-md bg-foreground px-2 py-1 text-xs whitespace-nowrap text-background shadow-sm">
                  <span className="font-semibold">{point.value}</span> screenings
                </div>
              )}
              <div
                className={cn(
                  "w-6 rounded-t-[4px] transition-colors",
                  hovered === i ? "bg-brand-purple-700" : "bg-brand-purple-600"
                )}
                style={{ height: `${(point.value / Y_MAX) * 100}%` }}
              />
              <span className="mt-2 text-xs text-muted-foreground">{point.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
