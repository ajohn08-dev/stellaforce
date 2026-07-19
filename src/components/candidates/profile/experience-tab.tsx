import { HighlightCallout } from "@/components/candidates/profile/highlight-callout"
import { TenureStatTiles } from "@/components/candidates/profile/tenure-stat-tiles"
import { ExperienceEntry } from "@/components/candidates/profile/experience-entry"
import {
  calculateTenureStats,
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
      {notable && <HighlightCallout entry={notable} />}

      <div>
        <h2 className="mb-3 text-base font-semibold">Experiences</h2>
        <TenureStatTiles stats={stats} />
      </div>

      <div className="space-y-4">
        {workHistory.map((entry, i) => (
          <ExperienceEntry key={i} entry={entry} />
        ))}
      </div>
    </div>
  )
}
