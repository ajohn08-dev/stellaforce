"use client"

import { cn } from "@/lib/utils"
import { METRIC_DIMENSIONS, type MetricDimension } from "@/lib/mock-agent-analytics"

export function MetricDimensionToggle({
  value,
  onChange,
}: {
  value: MetricDimension
  onChange: (value: MetricDimension) => void
}) {
  return (
    <div className="inline-flex items-center rounded-md border border-border p-0.5">
      {METRIC_DIMENSIONS.map((d) => (
        <button
          key={d.value}
          type="button"
          aria-pressed={value === d.value}
          onClick={() => onChange(d.value)}
          className={cn(
            "rounded px-2.5 py-1 text-xs font-medium transition-colors",
            value === d.value
              ? "bg-muted text-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {d.label}
        </button>
      ))}
    </div>
  )
}
