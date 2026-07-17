import Image from "next/image"
import { Building2 } from "lucide-react"

import { companyLogoSrc } from "@/lib/company-logos"
import {
  calculateTenureStats,
  formatDateRange,
  formatDuration,
  formatMonth,
  notableEmployer,
  type WorkHistoryEntry,
} from "@/lib/work-history"

export function ExperienceTab({ workHistory }: { workHistory: WorkHistoryEntry[] }) {
  if (workHistory.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No work history recorded.</p>
    )
  }

  const stats = calculateTenureStats(workHistory)
  const notable = notableEmployer(workHistory)

  return (
    <div className="space-y-6">
      {notable && (
        <div className="inline-flex max-w-sm items-start gap-3 rounded-lg border border-brand-orange-200 bg-brand-orange-50 p-4 dark:border-brand-orange-900 dark:bg-brand-orange-950">
          <Building2 className="mt-0.5 size-4 shrink-0 text-brand-orange-600" />
          <div>
            <p className="text-sm font-medium">Notable employer</p>
            <p className="text-sm text-muted-foreground">
              Worked at {notable.company}{" "}
              {notable.end_date
                ? `until ${formatMonth(notable.end_date)}`
                : "— current role"}
            </p>
          </div>
        </div>
      )}

      <div>
        <h2 className="mb-3 text-base font-semibold">Experiences</h2>
        <div className="grid grid-cols-3 gap-3">
          <StatTile
            label="Average tenure"
            value={formatDuration(stats.averageMonths)}
          />
          <StatTile
            label="Current tenure"
            value={stats.currentMonths != null ? formatDuration(stats.currentMonths) : "—"}
          />
          <StatTile
            label="Total experience"
            value={formatDuration(stats.totalMonths)}
          />
        </div>
      </div>

      <div className="space-y-4">
        {workHistory.map((entry, i) => (
          <ExperienceEntry key={i} entry={entry} />
        ))}
      </div>
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

function ExperienceEntry({ entry }: { entry: WorkHistoryEntry }) {
  const logoSrc = companyLogoSrc(entry.company)
  return (
    <div className="flex gap-3">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-md border border-border">
        {logoSrc ? (
          <Image
            src={logoSrc}
            alt=""
            width={24}
            height={24}
            className="object-contain"
          />
        ) : (
          <Building2 className="size-5 text-muted-foreground" />
        )}
      </div>
      <div className="flex-1 space-y-0.5">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-sm font-medium">{entry.title}</p>
            <p className="text-sm text-muted-foreground">{entry.company}</p>
          </div>
          <p className="shrink-0 text-xs text-muted-foreground">
            {formatDateRange(entry)}
          </p>
        </div>
        {entry.location && (
          <p className="text-xs text-muted-foreground">{entry.location}</p>
        )}
        {entry.description && <p className="mt-1 text-sm">{entry.description}</p>}
      </div>
    </div>
  )
}
