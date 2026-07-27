import type { RankedItem } from "@/lib/mock-agent-analytics"

export function RankedBarList({
  items,
  valueSuffix = "%",
}: {
  items: RankedItem[]
  valueSuffix?: string
}) {
  const sorted = [...items].sort((a, b) => b.value - a.value)
  const max = sorted[0]?.value ?? 1

  return (
    <div className="flex flex-col gap-3">
      {sorted.map((item) => (
        <div key={item.label} className="flex items-center gap-3">
          <span className="w-40 shrink-0 truncate text-sm text-muted-foreground" title={item.label}>
            {item.label}
          </span>
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <div className="h-2 min-w-0 flex-1 rounded-full bg-muted">
              <div
                className="h-2 rounded-full bg-brand-purple-600"
                style={{ width: `${(item.value / max) * 100}%` }}
              />
            </div>
            <span className="w-10 shrink-0 text-right text-sm font-medium text-foreground">
              {item.value}
              {valueSuffix}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}
