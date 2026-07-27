"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import type { MetricPoint } from "@/lib/mock-agent-analytics"

const CHART_HEIGHT = 220

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

  return (
    <div className="flex" style={{ height: CHART_HEIGHT }}>
      <div
        className="flex flex-col justify-between pr-3 text-right text-xs text-muted-foreground"
        style={{ height: CHART_HEIGHT }}
      >
        {[...yTicks].reverse().map((t) => (
          <span key={t}>{t.toLocaleString()}</span>
        ))}
      </div>

      <div className="relative flex flex-1 items-end justify-between gap-3">
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
                "w-6 rounded-t-[4px] transition-colors",
                hovered === i ? "bg-brand-purple-700" : "bg-brand-purple-600"
              )}
              style={{ height: `${(point.value / yMax) * 100}%` }}
            />
            <span
              title={point.label}
              className="mt-2 w-full text-center text-xs leading-tight text-balance text-muted-foreground"
            >
              {point.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
