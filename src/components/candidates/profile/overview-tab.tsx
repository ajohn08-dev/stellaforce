import { Badge } from "@/components/ui/badge"
import { TierBadge } from "@/components/tier-badge"
import { HighlightCallout } from "@/components/candidates/profile/highlight-callout"
import { TenureStatTiles } from "@/components/candidates/profile/tenure-stat-tiles"
import { ExperienceEntry } from "@/components/candidates/profile/experience-entry"
import { ProficiencyBadge } from "@/components/candidates/profile/proficiency-badge"
import { titleCase } from "@/lib/constants"
import { formatEducationLine } from "@/lib/education"
import { groupSkillsByCategory } from "@/lib/skill-categories"
import {
  calculateTenureStats,
  notableEmployer,
  type WorkHistoryEntry,
} from "@/lib/work-history"
import type { CandidateRow, SkillRow } from "@/lib/supabase/types"

/** The current role if there is one, otherwise the most recently ended one. */
function mostRecentRole(entries: WorkHistoryEntry[]): WorkHistoryEntry | null {
  if (entries.length === 0) return null
  return (
    entries.find((e) => !e.end_date) ??
    [...entries].sort((a, b) => (b.end_date ?? "").localeCompare(a.end_date ?? ""))[0]
  )
}

export function OverviewTab({
  candidate: c,
  skills,
  workHistory,
}: {
  candidate: CandidateRow
  skills: SkillRow[]
  workHistory: WorkHistoryEntry[]
}) {
  const notable = notableEmployer(workHistory)
  const recentRole = mostRecentRole(workHistory)
  const educationLine = formatEducationLine(c.education)
  const categories = groupSkillsByCategory(skills)

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

      {categories.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground">
            Skill Map
          </h2>
          <div className="flex flex-wrap gap-2">
            {categories.map(({ category, tier }) => (
              <div
                key={category}
                className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5"
              >
                <span className="text-sm">{category}</span>
                <ProficiencyBadge tier={tier} />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
