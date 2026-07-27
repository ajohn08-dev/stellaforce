"use client"

import * as React from "react"

import { MetricDimensionToggle } from "@/components/agents/analytics/metric-dimension-toggle"
import { HANDLE_TIME_TREND, type MetricDimension } from "@/lib/mock-agent-analytics"

const CHART_HEIGHT = 220
const VIEW_W = 800
const VIEW_H = 220
const Y_MAX = 20
const Y_TICKS = [0, 5, 10, 15, 20]

function xAt(i: number, n: number) {
  return (i / (n - 1)) * VIEW_W
}
function yAt(value: number) {
  return VIEW_H - (value / Y_MAX) * VIEW_H
}

export function HandleTimeLineChartCard() {
  const [dimension, setDimension] = React.useState<MetricDimension>("job")
  const [hovered, setHovered] = React.useState<number | null>(null)
  const containerRef = React.useRef<HTMLDivElement>(null)
  const data = HANDLE_TIME_TREND[dimension]

  const linePath = data
    .map((p, i) => `${i === 0 ? "M" : "L"} ${xAt(i, data.length)} ${yAt(p.value)}`)
    .join(" ")

  function onMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    const fraction = (e.clientX - rect.left) / rect.width
    const index = Math.round(fraction * (data.length - 1))
    setHovered(Math.min(data.length - 1, Math.max(0, index)))
  }

  const last = data[data.length - 1]

  return (
    <div className="rounded-lg border border-border bg-white p-4">
      <div className="mb-6 flex items-center justify-between gap-4">
        <p className="text-sm font-medium text-muted-foreground">
          Average Handle Time (min) per Week
        </p>
        <MetricDimensionToggle value={dimension} onChange={setDimension} />
      </div>

      <div className="flex" style={{ height: CHART_HEIGHT }}>
        <div
          className="flex flex-col justify-between pr-3 text-right text-xs text-muted-foreground"
          style={{ height: CHART_HEIGHT }}
        >
          {[...Y_TICKS].reverse().map((t) => (
            <span key={t}>{t}</span>
          ))}
        </div>

        <div
          ref={containerRef}
          className="relative flex-1"
          style={{ height: CHART_HEIGHT }}
          onMouseMove={onMouseMove}
          onMouseLeave={() => setHovered(null)}
        >
          {Y_TICKS.map((t) => (
            <div
              key={t}
              className="absolute right-0 left-0 border-t border-border"
              style={{ bottom: `${(t / Y_MAX) * 100}%` }}
              aria-hidden
            />
          ))}

          <svg
            viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
            preserveAspectRatio="none"
            className="absolute inset-0 size-full overflow-visible"
          >
            <path
              d={linePath}
              fill="none"
              stroke="var(--brand-purple-600)"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
            {hovered !== null && (
              <line
                x1={xAt(hovered, data.length)}
                x2={xAt(hovered, data.length)}
                y1={0}
                y2={VIEW_H}
                stroke="var(--border)"
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
              />
            )}
            {data.map((p, i) => (
              <circle
                key={p.label}
                cx={xAt(i, data.length)}
                cy={yAt(p.value)}
                r={hovered === i ? 5 : 4}
                fill="var(--brand-purple-600)"
                stroke="white"
                strokeWidth={2}
              />
            ))}
          </svg>

          <span className="absolute top-0 right-0 -translate-y-1/2 rounded bg-brand-purple-50 px-1.5 py-0.5 text-xs font-medium text-brand-purple-700 dark:bg-brand-purple-950 dark:text-brand-purple-300">
            {last.value} min
          </span>

          {hovered !== null && (
            <div
              className="absolute z-10 -translate-x-1/2 -translate-y-full rounded-md bg-foreground px-2 py-1 text-xs whitespace-nowrap text-background shadow-sm"
              style={{
                left: `${(hovered / (data.length - 1)) * 100}%`,
                top: `${yAt(data[hovered].value) - 8}px`,
              }}
            >
              <span className="font-semibold">{data[hovered].value} min</span> ·{" "}
              {data[hovered].label}
            </div>
          )}
        </div>
      </div>

      <div className="mt-2 flex justify-between pl-8 text-xs text-muted-foreground">
        {data.map((p) => (
          <span key={p.label}>{p.label}</span>
        ))}
      </div>
    </div>
  )
}
