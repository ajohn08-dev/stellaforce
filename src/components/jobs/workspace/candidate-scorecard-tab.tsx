"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { SkillToolChips } from "@/components/skill-tool-chips"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

type ConfidenceLevel = "low" | "medium" | "high"
type ProficiencyLevel = "aware" | "proficient" | "expert"

type EvidenceTrailEntry = {
  stage: string
  note: string
}

type CategoryCompetency = {
  id: string
  name: string
  /** What the evidence so far shows the candidate has actually demonstrated. */
  achievedProficiency: ProficiencyLevel
  /** Required level from the job's evaluation criteria. */
  targetProficiency: ProficiencyLevel
  confidence: ConfidenceLevel
  skills: string[]
  tools: string[]
  /** AI-synthesized one-paragraph rationale. */
  summary: string
  evidenceTrail: EvidenceTrailEntry[]
}

type ScoreCategory = {
  id: string
  name: string
  weight: number
  currentScore: number
  targetScore: number
  confidence: ConfidenceLevel
  competencies: CategoryCompetency[]
}

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

/**
 * Seeded mock scores for this candidate against the job's scorecard
 * categories — UI only, not wired to a real scoring pipeline yet.
 */
const SCORE_CATEGORIES: ScoreCategory[] = [
  {
    id: "product-engineering-execution",
    name: "Product Engineering Execution",
    weight: 60,
    currentScore: 72,
    targetScore: 80,
    confidence: "high",
    competencies: [
      {
        id: "system-design",
        name: "System design & architecture",
        achievedProficiency: "proficient",
        targetProficiency: "expert",
        confidence: "high",
        skills: ["System design", "Scalability"],
        tools: ["AWS", "Postgres"],
        summary:
          "Across the Hiring Manager Interview and both technical rounds, the candidate consistently proposed scalable service boundaries and anticipated failure modes without prompting, including a detailed walkthrough of a production incident they'd resolved.",
        evidenceTrail: [
          {
            stage: "Hiring Manager Interview",
            note: "Proposed scalable service boundaries without prompting.",
          },
          {
            stage: "Technical Interview 2",
            note: "Walked through a production incident they'd resolved, anticipating failure modes.",
          },
        ],
      },
      {
        id: "code-quality",
        name: "Code quality & maintainability",
        achievedProficiency: "proficient",
        targetProficiency: "proficient",
        confidence: "high",
        skills: ["Code review", "Testing"],
        tools: ["ESLint", "Jest"],
        summary:
          "Code samples reviewed during the technical interviews were clean and well-tested, though reviewers noted the candidate leaned on senior teammates for guidance on more complex refactors.",
        evidenceTrail: [
          {
            stage: "Technical Interview 1",
            note: "Submitted clean, well-tested code samples.",
          },
          {
            stage: "Technical Interview 2",
            note: "Leaned on senior teammates for guidance on complex refactors.",
          },
        ],
      },
      {
        id: "production-readiness",
        name: "Production readiness & monitoring",
        achievedProficiency: "aware",
        targetProficiency: "proficient",
        confidence: "medium",
        skills: ["Monitoring", "Incident response"],
        tools: ["Datadog", "PagerDuty"],
        summary:
          "The candidate could describe monitoring and rollback concepts in the abstract, but struggled to give a concrete example of having owned an incident response or on-call rotation.",
        evidenceTrail: [
          {
            stage: "Technical Interview 1",
            note: "Described monitoring and rollback concepts in the abstract.",
          },
          {
            stage: "Hiring Manager Interview",
            note: "Could not give a concrete example of owning an incident response.",
          },
        ],
      },
    ],
  },
  {
    id: "communication-collaboration",
    name: "Communication & Collaboration",
    weight: 40,
    currentScore: 85,
    targetScore: 75,
    confidence: "medium",
    competencies: [
      {
        id: "stakeholder-communication",
        name: "Stakeholder communication",
        achievedProficiency: "expert",
        targetProficiency: "proficient",
        confidence: "high",
        skills: ["Written communication", "Stakeholder management"],
        tools: ["Notion", "Slack"],
        summary:
          "In the Behavioral Round with the CTO, the candidate walked a non-technical panel through a complex architecture tradeoff using a whiteboard analogy reviewers called \"immediately clear\" — cited as a standout moment.",
        evidenceTrail: [
          {
            stage: "Interview: Behavioral Round with CTO",
            note: "Explained a complex architecture tradeoff using a whiteboard analogy reviewers called \"immediately clear\".",
          },
          {
            stage: "Recruiter Screen",
            note: "Clearly articulated career narrative and role motivation.",
          },
        ],
      },
      {
        id: "cross-functional-collaboration",
        name: "Cross-functional collaboration",
        achievedProficiency: "proficient",
        targetProficiency: "proficient",
        confidence: "medium",
        skills: ["Cross-functional collaboration", "Conflict resolution"],
        tools: ["Slack", "Jira"],
        summary:
          "References and the Hiring Manager Interview both highlighted smooth day-to-day collaboration with design and product, with one reference noting occasional friction during scope disagreements.",
        evidenceTrail: [
          {
            stage: "Hiring Manager Interview",
            note: "Highlighted smooth day-to-day collaboration with design and product.",
          },
          {
            stage: "Reference Check",
            note: "One reference noted occasional friction during scope disagreements.",
          },
        ],
      },
    ],
  },
]

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

/** The whole card is the click target for the evidence trail — hover reveals an orange border to signal that. */
function CompetencyBlock({ competency }: { competency: CategoryCompetency }) {
  const [trailOpen, setTrailOpen] = React.useState(false)
  const meetsTarget =
    PROFICIENCY_RANK[competency.achievedProficiency] >=
    PROFICIENCY_RANK[competency.targetProficiency]

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={() => setTrailOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            setTrailOpen(true)
          }
        }}
        className="cursor-pointer rounded-md border border-transparent bg-brand-orange-50 p-3 transition-colors hover:border-brand-orange-300"
      >
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium text-foreground">{competency.name}</p>
          <div className="flex shrink-0 items-center gap-3">
            <span
              className={cn(
                "text-xs font-medium",
                meetsTarget ? "text-emerald-700" : "text-brand-orange-700"
              )}
            >
              {PROFICIENCY_LABEL[competency.achievedProficiency]} · Target:{" "}
              {PROFICIENCY_LABEL[competency.targetProficiency]}
            </span>
            <ConfidenceChip level={competency.confidence} />
          </div>
        </div>

        <div className="mt-3">
          <SkillToolChips skills={competency.skills} tools={competency.tools} />
        </div>

        <p className="mt-3 text-sm text-foreground">{competency.summary}</p>
      </div>

      <Sheet open={trailOpen} onOpenChange={setTrailOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{competency.name}</SheetTitle>
            <SheetDescription>Evidence trail</SheetDescription>
          </SheetHeader>

          <div className="flex flex-col gap-3">
            {competency.evidenceTrail.map((entry, i) => (
              <div key={i} className="rounded-md border border-border p-3">
                <p className="text-xs font-medium text-muted-foreground">
                  {entry.stage}
                </p>
                <p className="mt-1 text-sm text-foreground">{entry.note}</p>
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}

function CategoryCard({ category }: { category: ScoreCategory }) {
  const confidence = CONFIDENCE_META[category.confidence]

  return (
    <div className="rounded-lg border border-border bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-base text-foreground">{category.name}</p>
        <span className="text-sm text-muted-foreground">
          Weight: {category.weight}%
        </span>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <GapBar current={category.currentScore} target={category.targetScore} />
        <span className="shrink-0 text-sm text-foreground">
          {category.currentScore}/{category.targetScore}
        </span>
      </div>

      <div className="mt-2 flex items-center gap-1.5">
        <span className={cn("size-1.5 rounded-full", confidence.dotClass)} />
        <span className="text-xs text-muted-foreground">{confidence.label}</span>
      </div>

      <div className="mt-4 flex flex-col gap-3">
        {category.competencies.map((competency) => (
          <CompetencyBlock key={competency.id} competency={competency} />
        ))}
      </div>
    </div>
  )
}

export function CandidateScorecardTab() {
  return (
    <div className="flex flex-col gap-4">
      {SCORE_CATEGORIES.map((category) => (
        <CategoryCard key={category.id} category={category} />
      ))}
    </div>
  )
}
