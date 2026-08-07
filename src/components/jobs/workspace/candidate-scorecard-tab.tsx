import { cn } from "@/lib/utils"
import { SkillToolChips } from "@/components/skill-tool-chips"
import type { Competency, ProficiencyLevel } from "@/components/jobs/draft/steps/competency-data"
import type { ScoreCardCategory } from "@/components/jobs/draft/steps/score-card-step"
import type { ApplicationScorecardCategory } from "@/lib/data"

type ConfidenceLevel = "low" | "medium" | "high"

const CONFIDENCE_META: Record<
  ConfidenceLevel,
  { label: string; chipClass: string; dotClass: string }
> = {
  high: {
    label: "High confidence",
    chipClass: "bg-emerald-100 text-emerald-700",
    dotClass: "bg-emerald-300",
  },
  medium: {
    label: "Medium confidence",
    chipClass: "bg-amber-100 text-amber-700",
    dotClass: "bg-amber-300",
  },
  low: {
    label: "Low confidence",
    chipClass: "bg-slate-100 text-slate-600",
    dotClass: "bg-slate-300",
  },
}

const PROFICIENCY_LABEL: Record<ProficiencyLevel, string> = {
  aware: "Aware",
  proficient: "Proficient",
  expert: "Expert",
}

const PROFICIENCY_RANK: Record<ProficiencyLevel, number> = {
  aware: 1,
  proficient: 2,
  expert: 3,
}

function ConfidenceChip({ level }: { level: ConfidenceLevel }) {
  const confidence = CONFIDENCE_META[level]
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium",
        confidence.chipClass
      )}
    >
      {confidence.label}
    </span>
  )
}

function GapBar({ current, target }: { current: number; target: number }) {
  const meetsTarget = current >= target
  return (
    <div className="relative h-2 w-full rounded-full bg-muted">
      <div
        className={cn(
          "h-full rounded-full",
          meetsTarget ? "bg-emerald-300" : "bg-brand-orange-300"
        )}
        style={{ width: `${Math.min(current, 100)}%` }}
      />
      <div
        className="absolute top-1/2 h-3 w-0.5 -translate-y-1/2 bg-foreground/30"
        style={{ left: `${Math.min(target, 100)}%` }}
        aria-hidden
      />
    </div>
  )
}

/** One competency inside a category — real scored evidence if it exists,
 * otherwise an honest "not yet evaluated" state (no fabricated score). */
function CompetencyBlock({
  competency,
  achieved,
}: {
  competency: Competency
  achieved: ApplicationScorecardCategory["competencies"][number] | undefined
}) {
  if (!achieved) {
    return (
      <div className="rounded-md border border-dashed border-border bg-muted/40 p-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium text-foreground">{competency.description}</p>
          <span className="text-xs font-medium text-muted-foreground">
            Target: {PROFICIENCY_LABEL[competency.selectedLevel]}
          </span>
        </div>
        <div className="mt-3">
          <SkillToolChips skills={competency.skills} tools={competency.tools} />
        </div>
        <p className="mt-3 text-sm text-muted-foreground">Not yet evaluated.</p>
      </div>
    )
  }

  const meetsTarget =
    PROFICIENCY_RANK[achieved.achieved_proficiency] >= PROFICIENCY_RANK[competency.selectedLevel]

  return (
    <div className="rounded-md bg-brand-orange-50 p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-foreground">{competency.description}</p>
        <div className="flex shrink-0 items-center gap-3">
          <span
            className={cn(
              "text-xs font-medium",
              meetsTarget ? "text-emerald-700" : "text-brand-orange-700"
            )}
          >
            {PROFICIENCY_LABEL[achieved.achieved_proficiency]} · Target:{" "}
            {PROFICIENCY_LABEL[competency.selectedLevel]}
          </span>
          <ConfidenceChip level={achieved.confidence} />
        </div>
      </div>

      <div className="mt-3">
        <SkillToolChips skills={competency.skills} tools={competency.tools} />
      </div>

      {achieved.summary && <p className="mt-3 text-sm text-foreground">{achieved.summary}</p>}
    </div>
  )
}

function CategoryCard({
  category,
  competencies,
  realCategory,
}: {
  category: ScoreCardCategory
  competencies: Competency[]
  realCategory: ApplicationScorecardCategory | undefined
}) {
  const achievedByCompetency = new Map(
    (realCategory?.competencies ?? []).map((c) => [c.competency_id, c])
  )

  return (
    <div className="rounded-lg border border-border bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-base text-foreground">{category.name}</p>
        <span className="text-sm text-muted-foreground">Weight: {category.weight}%</span>
      </div>

      {realCategory?.current_score != null && realCategory.target_score != null ? (
        <>
          <div className="mt-3 flex items-center gap-3">
            <GapBar current={realCategory.current_score} target={realCategory.target_score} />
            <span className="shrink-0 text-sm text-foreground">
              {realCategory.current_score}/{realCategory.target_score}
            </span>
          </div>
          {realCategory.confidence && (
            <div className="mt-2 flex items-center gap-1.5">
              <span
                className={cn("size-1.5 rounded-full", CONFIDENCE_META[realCategory.confidence].dotClass)}
              />
              <span className="text-xs text-muted-foreground">
                {CONFIDENCE_META[realCategory.confidence].label}
              </span>
            </div>
          )}
        </>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">No score yet.</p>
      )}

      <div className="mt-4 flex flex-col gap-3">
        {competencies.map((competency) => (
          <CompetencyBlock
            key={competency.id}
            competency={competency}
            achieved={achievedByCompetency.get(competency.id)}
          />
        ))}
      </div>
    </div>
  )
}

export function CandidateScorecardTab({
  candidateName,
  currentStageName,
  categories,
  competencies,
  scorecard,
}: {
  candidateName: string
  currentStageName: string
  /** Job's scorecard categories, already narrowed to competencies assessed
   * by a sub-stage this candidate has reached. */
  categories: ScoreCardCategory[]
  /** Job's competencies, already narrowed the same way. */
  competencies: Competency[]
  /** This application's real computed scorecard rows, if any exist yet. */
  scorecard: ApplicationScorecardCategory[]
}) {
  if (categories.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No scorecard evidence yet — {candidateName} is in {currentStageName}.
      </p>
    )
  }

  const competencyById = new Map(competencies.map((c) => [c.id, c]))
  const realByCategory = new Map(scorecard.map((c) => [c.category_id, c]))

  return (
    <div className="flex flex-col gap-4">
      {categories.map((category) => (
        <CategoryCard
          key={category.id}
          category={category}
          competencies={category.competencyIds
            .map((id) => competencyById.get(id))
            .filter((c): c is Competency => c != null)}
          realCategory={realByCategory.get(category.id)}
        />
      ))}
    </div>
  )
}
