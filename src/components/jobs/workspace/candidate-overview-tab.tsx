import { ExperienceEntry } from "@/components/candidates/profile/experience-entry"
import { TenureStatTiles } from "@/components/candidates/profile/tenure-stat-tiles"
import { calculateTenureStats } from "@/lib/work-history"
import { CANDIDATE_WORK_HISTORY } from "@/components/jobs/workspace/candidate-background-tab"

type OverviewSection = {
  tabName: string
  highlights: string[]
}

/**
 * Seeded mock highlights pulled from the other tabs — UI only, not wired
 * to real cross-tab aggregation yet. Mirrors the same seeded data used in
 * the Scorecard, Evaluation, Background, and Activity tabs so the numbers
 * stay consistent across the panel.
 */
const OVERVIEW_SECTIONS: OverviewSection[] = [
  {
    tabName: "Scorecard",
    highlights: [
      "Product Engineering Execution: 72/80 — trending slightly below target",
      "Communication & Collaboration: 85/75 — exceeds target",
      "Stakeholder communication rated Expert against a Proficient target",
    ],
  },
  {
    tabName: "Evaluation",
    highlights: [
      "Technical Interview 1: evaluation pending (interview completed Jul 18)",
      "Hiring Manager Interview: 4/5 — passed, strong culture fit (Alex Kim)",
      "HR Screening: 4.5/5 — compensation and availability confirmed (Priya Shah)",
    ],
  },
]

const ACTIVITY_HIGHLIGHTS = [
  "Technical Interview 1: feedback submitted by Jamie Rivera — Jul 19",
  "Technical Interview 1: attended by Jamie Rivera and Isabella Reyes — Jul 18",
  "Hiring Manager Interview: passed, decision recorded by Alex Kim — Jul 15",
]

const BACKGROUND_HIGHLIGHTS = [
  "MS in Computer Science, University of Illinois (2018)",
  "AWS Certified Machine Learning – Specialty (2022)",
]

function OverviewSectionBlock({ section }: { section: OverviewSection }) {
  return (
    <div>
      <h3 className="text-sm font-medium text-muted-foreground">
        {section.tabName}
      </h3>
      <ul className="mt-2 list-disc space-y-1.5 pl-4">
        {section.highlights.map((highlight, i) => (
          <li key={i} className="text-sm text-foreground">
            {highlight}
          </li>
        ))}
      </ul>
    </div>
  )
}

function BackgroundSection() {
  const mostRecentRole = CANDIDATE_WORK_HISTORY[0]
  const tenureStats = calculateTenureStats(CANDIDATE_WORK_HISTORY)

  return (
    <div>
      <h3 className="text-sm font-medium text-muted-foreground">Background</h3>

      <div className="mt-3 space-y-3">
        <p className="text-sm font-medium text-foreground">Experience</p>
        <TenureStatTiles stats={tenureStats} />
        {mostRecentRole && <ExperienceEntry entry={mostRecentRole} />}
      </div>

      <ul className="mt-4 list-disc space-y-1.5 pl-4">
        {BACKGROUND_HIGHLIGHTS.map((highlight, i) => (
          <li key={i} className="text-sm text-foreground">
            {highlight}
          </li>
        ))}
      </ul>
    </div>
  )
}

export function CandidateOverviewTab() {
  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-brand-purple-200 bg-brand-purple-50 p-4">
        <p className="text-sm font-semibold text-brand-purple-800">Strong Fit</p>
        <p className="mt-1 text-sm text-foreground">
          Communication and stakeholder skills exceed the bar for this role,
          and technical execution is trending well overall — though
          production-readiness experience is still developing relative to
          what the role requires.
        </p>
      </div>

      <div className="space-y-5">
        {OVERVIEW_SECTIONS.map((section) => (
          <OverviewSectionBlock key={section.tabName} section={section} />
        ))}

        <BackgroundSection />

        <OverviewSectionBlock
          section={{ tabName: "Activity", highlights: ACTIVITY_HIGHLIGHTS }}
        />
      </div>
    </div>
  )
}
