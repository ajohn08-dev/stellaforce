"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import type { MetricPoint } from "@/lib/mock-agent-analytics"

const CHART_HEIGHT = 220
/** Per-bar slot width — wide enough for a two-line job/client/agent name. Below
 * this many columns don't fit the panel, the chart scrolls horizontally
 * instead of squeezing bars until they overlap. */
const MIN_COLUMN_WIDTH = 104

export function MetricBarChart({
  data,
  yMax = 100,
  yTicks = [0, 25, 50, 75, 100],
  valueSuffix = "%",
}: {
  data: MetricPoint[]
  yMax?: number
  yTicks?: number[]
  valueSuffix?: string
}) {
  const [hovered, setHovered] = React.useState<number | null>(null)
  const columnsMinWidth = data.length * MIN_COLUMN_WIDTH

  return (
    <div className="flex">
      <div
        className="flex flex-col justify-between pr-4 text-right text-xs text-muted-foreground"
        style={{ height: CHART_HEIGHT }}
      >
        {[...yTicks].reverse().map((t) => (
          <span key={t}>{t.toLocaleString()}</span>
        ))}
      </div>

      <div className="min-w-0 flex-1 overflow-x-auto">
        <div
          className="relative flex gap-4"
          style={{ height: CHART_HEIGHT, minWidth: columnsMinWidth }}
        >
          {yTicks.map((t) => (
            <div
              key={t}
              className="absolute right-0 left-0 border-t border-border"
              style={{ bottom: `${(t / yMax) * 100}%` }}
              aria-hidden
            />
          ))}

          {data.map((point, i) => (
            <div
              key={point.label}
              className="relative z-10 flex h-full min-w-0 flex-1 flex-col items-center justify-end"
              style={{ minWidth: MIN_COLUMN_WIDTH }}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered((h) => (h === i ? null : h))}
            >
              {hovered === i && (
                <div className="absolute -top-9 z-20 rounded-md bg-foreground px-2 py-1 text-xs whitespace-nowrap text-background shadow-sm">
                  <span className="font-semibold">{point.value}</span>
                  {valueSuffix}
                </div>
              )}
              <div
                className={cn(
                  "rounded-t-[4px] transition-colors",
                  hovered === i ? "bg-brand-purple-700" : "bg-brand-purple-600"
                )}
                style={{
                  height: `${(point.value / yMax) * 100}%`,
                  width: "56%",
                  maxWidth: 64,
                }}
              />
            </div>
          ))}
        </div>

        <div className="mt-4 flex gap-4" style={{ minWidth: columnsMinWidth }}>
          {data.map((point) => (
            <span
              key={point.label}
              title={point.label}
              className="min-w-0 flex-1 text-center text-xs leading-tight text-balance text-muted-foreground"
              style={{ minWidth: MIN_COLUMN_WIDTH }}
            >
              {point.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
