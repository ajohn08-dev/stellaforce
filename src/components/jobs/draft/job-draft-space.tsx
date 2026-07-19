"use client"

import * as React from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { StepProgressBar, type Step } from "@/components/jobs/draft/step-progress-bar"
import { RoleDefinitionStep } from "@/components/jobs/draft/steps/role-definition-step"
import { EvaluationCriteriaStep } from "@/components/jobs/draft/steps/evaluation-criteria-step"
import { ScoreCardStep } from "@/components/jobs/draft/steps/score-card-step"
import { TeamMembersStep } from "@/components/jobs/draft/steps/team-members-step"
import { INITIAL_COMPETENCIES } from "@/components/jobs/draft/steps/competency-data"
import { useSidebarDefaultCollapsed } from "@/lib/sidebar-context"
import type { MockJob } from "@/lib/mock-jobs"

const STEPS: Step[] = [
  { key: "role-definition", label: "Role Definition" },
  { key: "evaluation-criteria", label: "Evaluation Criteria" },
  { key: "score-card", label: "Scorecard" },
  { key: "team-members", label: "Team Members" },
  { key: "workflow", label: "Workflow" },
]

/**
 * Job setup wizard — shown instead of the pipeline workspace while a job is
 * still in "draft" status. Step content is a placeholder for now; each
 * step's actual fields will be defined later.
 */
export function JobDraftSpace({ job }: { job: MockJob }) {
  const [stepIndex, setStepIndex] = React.useState(0)
  const [competencies, setCompetencies] = React.useState(INITIAL_COMPETENCIES)
  const isLastStep = stepIndex === STEPS.length - 1

  useSidebarDefaultCollapsed(true)

  return (
    <div
      className="flex flex-col overflow-hidden p-4"
      // Inline style, not an arbitrary Tailwind class: <main> has no padding
      // of its own, so only the app header (h-14 = 3.5rem) needs
      // subtracting — this div's own p-4 is included via border-box.
      style={{ height: "calc(100vh - 3.5rem)" }}
    >
      <div className="flex min-h-0 flex-1 gap-4">
        <div className="w-[15%] shrink-0 overflow-y-auto">
          <StepProgressBar
            steps={STEPS}
            currentIndex={stepIndex}
            onStepClick={setStepIndex}
            orientation="vertical"
          />
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="shrink-0">
            <div className="flex items-center justify-between pb-6">
              <Button
                variant="outline"
                disabled={stepIndex === 0}
                onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
              >
                Back
              </Button>
              <Button
                onClick={() => {
                  if (isLastStep) {
                    toast.info(
                      "Not wired up yet — publishing this job is coming soon."
                    )
                  } else {
                    setStepIndex((i) => Math.min(STEPS.length - 1, i + 1))
                  }
                }}
              >
                {isLastStep ? "Publish job" : "Next"}
              </Button>
            </div>

            <h2 className="mb-4 text-lg font-semibold tracking-tight">
              {STEPS[stepIndex].label}
            </h2>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {STEPS[stepIndex].key === "role-definition" ? (
              <RoleDefinitionStep />
            ) : STEPS[stepIndex].key === "evaluation-criteria" ? (
              <EvaluationCriteriaStep
                competencies={competencies}
                setCompetencies={setCompetencies}
              />
            ) : STEPS[stepIndex].key === "score-card" ? (
              <ScoreCardStep competencies={competencies} />
            ) : STEPS[stepIndex].key === "team-members" ? (
              <TeamMembersStep />
            ) : (
              <p className="text-sm text-muted-foreground">
                Setup for this step is coming soon.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
