import { formatDuration, type TenureStats } from "@/lib/work-history"

export function TenureStatTiles({ stats }: { stats: TenureStats }) {
  return (
    <div className="grid grid-cols-3 gap-3">
      <StatTile label="Average tenure" value={formatDuration(stats.averageMonths)} />
      <StatTile
        label="Current tenure"
        value={stats.currentMonths != null ? formatDuration(stats.currentMonths) : "—"}
      />
      <StatTile label="Total experience" value={formatDuration(stats.totalMonths)} />
    </div>
  )
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </p>
      <p className="mt-1 text-sm font-medium">{value}</p>
    </div>
  )
}
