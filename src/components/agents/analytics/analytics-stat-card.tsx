import { cn } from "@/lib/utils"
import type { AnalyticsStat } from "@/lib/mock-agent-analytics"

/**
 * Plain display by default. Pass `onClick` to make it an active/inactive
 * selector instead (e.g. System Health, where picking a card swaps the
 * trend chart below it) — `active` then controls the selected styling.
 */
export function AnalyticsStatCard({
  label,
  value,
  delta,
  onClick,
  active,
}: AnalyticsStat & { onClick?: () => void; active?: boolean }) {
  const isGood = delta ? delta.direction === delta.goodDirection : null
  const clickable = !!onClick

  const content = (
    <>
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
    </>
  )

  const className = cn(
    "flex flex-1 flex-col gap-6 rounded-lg border bg-white p-4 text-left",
    clickable && "cursor-pointer transition-colors hover:border-brand-purple-400",
    active ? "border-brand-purple-600 ring-1 ring-brand-purple-600" : "border-border"
  )

  if (clickable) {
    return (
      <button type="button" onClick={onClick} aria-pressed={active} className={className}>
        {content}
      </button>
    )
  }

  return <div className={className}>{content}</div>
}
