import { ExperienceEntry } from "@/components/candidates/profile/experience-entry"
import { TenureStatTiles } from "@/components/candidates/profile/tenure-stat-tiles"
import { calculateTenureStats } from "@/lib/work-history"
import { CANDIDATE_WORK_HISTORY } from "@/components/jobs/workspace/candidate-background-tab"
import type { ScoreCardCategory } from "@/components/jobs/draft/steps/score-card-step"
import type { ApplicationEvaluation, ApplicationScorecardCategory } from "@/lib/data"

const BACKGROUND_HIGHLIGHTS = [
  "MS in Computer Science, University of Illinois (2018)",
  "AWS Certified Machine Learning – Specialty (2022)",
]

/**
 * Seeded mock activity — resume/background and activity-log aggregation
 * aren't stage-gated content (a resume is known from the moment a candidate
 * is sourced) and aren't wired to real data yet; that's a separate gap from
 * the Scorecard/Evaluation stage-gating this tab otherwise reflects.
 */
const ACTIVITY_HIGHLIGHTS = [
  "Technical Interview 1: feedback submitted by Jamie Rivera — Jul 19",
  "Technical Interview 1: attended by Jamie Rivera and Isabella Reyes — Jul 18",
  "Hiring Manager Interview: passed, decision recorded by Alex Kim — Jul 15",
]

function OverviewSectionBlock({
  tabName,
  highlights,
}: {
  tabName: string
  highlights: string[]
}) {
  return (
    <div>
      <h3 className="text-sm font-medium text-muted-foreground">{tabName}</h3>
      <ul className="mt-2 list-disc space-y-1.5 pl-4">
        {highlights.map((highlight, i) => (
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

function getScorecardHighlights(
  categories: ScoreCardCategory[],
  scorecard: ApplicationScorecardCategory[],
  currentStageName: string
): string[] {
  const realByCategory = new Map(scorecard.map((c) => [c.category_id, c]))
  const highlights = categories.flatMap((category) => {
    const real = realByCategory.get(category.id)
    if (!real || real.current_score == null || real.target_score == null) return []
    const trend = real.current_score >= real.target_score ? "meets or exceeds target" : "below target"
    return [`${category.name}: ${real.current_score}/${real.target_score} — ${trend}`]
  })
  return highlights.length > 0
    ? highlights
    : [`No scorecard evidence yet — candidate is in ${currentStageName}.`]
}

function getEvaluationHighlights(
  reachedStages: { id: string; name: string }[],
  evaluations: ApplicationEvaluation[],
  currentStageName: string
): string[] {
  if (reachedStages.length === 0) {
    return [`No evaluations yet — candidate hasn't reached an evaluated stage (currently ${currentStageName}).`]
  }
  const evaluationByStage = new Map(evaluations.map((e) => [e.sub_stage_id, e]))
  return reachedStages.map((stage) => {
    const evaluation = evaluationByStage.get(stage.id)
    if (evaluation && evaluation.status === "completed") {
      return `${stage.name}: ${evaluation.rubric_score != null ? `${evaluation.rubric_score}/5 — ` : ""}${evaluation.summary ?? "evaluation completed"}`
    }
    return `${stage.name}: evaluation pending`
  })
}

export function CandidateOverviewTab({
  candidateName,
  currentStageName,
  categories,
  scorecard,
  reachedStages,
  evaluations,
}: {
  candidateName: string
  currentStageName: string
  /** Job's scorecard categories, already narrowed to competencies assessed
   * by a sub-stage this candidate has reached. */
  categories: ScoreCardCategory[]
  /** This application's real computed scorecard rows, if any exist yet. */
  scorecard: ApplicationScorecardCategory[]
  /** Reached sub-stages that are actual interviews (source excluded). */
  reachedStages: { id: string; name: string }[]
  /** This application's real evaluation rows, if any exist yet. */
  evaluations: ApplicationEvaluation[]
}) {
  const completedCount = evaluations.filter((e) => e.status === "completed").length

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-brand-purple-200 bg-brand-purple-50 p-4">
        <p className="text-sm font-semibold text-brand-purple-800">Progress</p>
        <p className="mt-1 text-sm text-foreground">
          {candidateName} is in {currentStageName}.{" "}
          {reachedStages.length > 0
            ? `${completedCount} of ${reachedStages.length} evaluations completed so far.`
            : "No evaluations to complete yet."}
        </p>
      </div>

      <div className="space-y-5">
        <OverviewSectionBlock
          tabName="Scorecard"
          highlights={getScorecardHighlights(categories, scorecard, currentStageName)}
        />

        <OverviewSectionBlock
          tabName="Evaluation"
          highlights={getEvaluationHighlights(reachedStages, evaluations, currentStageName)}
        />

        <BackgroundSection />

        <OverviewSectionBlock tabName="Activity" highlights={ACTIVITY_HIGHLIGHTS} />
      </div>
    </div>
  )
}
