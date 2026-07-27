import { Badge } from "@/components/ui/badge"
import { TierBadge } from "@/components/tier-badge"
import { HighlightCallout } from "@/components/candidates/profile/highlight-callout"
import { TenureStatTiles } from "@/components/candidates/profile/tenure-stat-tiles"
import { ExperienceEntry } from "@/components/candidates/profile/experience-entry"
import { titleCase } from "@/lib/constants"
import { formatEducationLine } from "@/lib/education"
import {
  calculateTenureStats,
  mostRecentRole,
  notableEmployer,
  type WorkHistoryEntry,
} from "@/lib/work-history"
import type { CandidateEducationRow, CandidateRow } from "@/lib/supabase/types"

export function OverviewTab({
  candidate: c,
  education,
  workHistory,
}: {
  candidate: CandidateRow
  education: CandidateEducationRow[]
  workHistory: WorkHistoryEntry[]
}) {
  const notable = notableEmployer(workHistory)
  const recentRole = mostRecentRole(workHistory)
  const educationLine = formatEducationLine(education)

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-2">
        <TierBadge tier={c.candidate_tier} />
        <Badge variant="outline">{titleCase(c.data_provenance)}</Badge>
        {c.freshness_score != null && (
          <Badge variant="secondary">
            Freshness {Number(c.freshness_score).toFixed(2)}
          </Badge>
        )}
      </div>

      {notable && (
        <section className="space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground">
            Highlights
          </h2>
          <HighlightCallout entry={notable} />
        </section>
      )}

      {c.professional_summary && (
        <section className="space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground">Summary</h2>
          <p className="text-sm leading-relaxed">{c.professional_summary}</p>
        </section>
      )}

      {c.tier_rationale && (
        <section className="space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground">
            Tier rationale
          </h2>
          <p className="text-sm leading-relaxed">{c.tier_rationale}</p>
        </section>
      )}

      {workHistory.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground">
            Experience
          </h2>
          <TenureStatTiles stats={calculateTenureStats(workHistory)} />
          {recentRole && <ExperienceEntry entry={recentRole} />}
        </section>
      )}

      {educationLine && (
        <section className="space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground">
            Education
          </h2>
          <p className="text-sm">{educationLine}</p>
        </section>
      )}
    </div>
  )
}
