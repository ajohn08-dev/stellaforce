import { cn } from "@/lib/utils"
import type { AnalyticsStat } from "@/lib/mock-agent-analytics"

export function AnalyticsStatCard({ label, value, delta }: AnalyticsStat) {
  const isGood = delta ? delta.direction === delta.goodDirection : null

  return (
    <div className="flex flex-1 flex-col gap-6 rounded-lg border border-border bg-white p-4">
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <div className="flex items-center gap-2">
        <p className="text-3xl font-medium tracking-tight text-foreground">{value}</p>
        {delta && (
          <span
            className={cn(
              "text-sm font-medium",
              isGood
                ? "text-emerald-700 dark:text-emerald-400"
                : "text-brand-orange-700 dark:text-brand-orange-400"
            )}
          >
            {delta.text}
          </span>
        )}
      </div>
    </div>
  )
}
