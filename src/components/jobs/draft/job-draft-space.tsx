"use client"

import * as React from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { StepProgressBar, type Step } from "@/components/jobs/draft/step-progress-bar"
import { RoleDefinitionStep } from "@/components/jobs/draft/steps/role-definition-step"
import { EvaluationCriteriaStep } from "@/components/jobs/draft/steps/evaluation-criteria-step"
import { ScoreCardStep } from "@/components/jobs/draft/steps/score-card-step"
import { TeamMembersStep } from "@/components/jobs/draft/steps/team-members-step"
import { WorkflowStep } from "@/components/jobs/draft/steps/workflow-step"
import { INITIAL_COMPETENCIES } from "@/components/jobs/draft/steps/competency-data"
import { INITIAL_MEMBERS, type Member } from "@/components/jobs/draft/steps/team-member-data"
import { useSidebarDefaultCollapsed } from "@/lib/sidebar-context"
import type { MockJob } from "@/lib/mock-jobs"

const STEPS: Step[] = [
  {
    key: "role-definition",
    label: "Role Definition",
    description:
      "Define the basics of this role — title, workplace, description, and employment details.",
  },
  {
    key: "evaluation-criteria",
    label: "Evaluation Criteria",
    description:
      "Set the competencies and skill levels candidates will be assessed against.",
  },
  {
    key: "score-card",
    label: "Scorecard",
    description:
      "Weight each evaluation category so it reflects what matters most for this role.",
  },
  {
    key: "team-members",
    label: "Team Members",
    description: "Add the people involved in hiring for this role.",
  },
  {
    key: "workflow",
    label: "Workflow",
    description: "Configure the pipeline stages candidates will move through.",
  },
]

/**
 * Job setup wizard — shown instead of the pipeline workspace while a job is
 * still in "draft" status. Step content is a placeholder for now; each
 * step's actual fields will be defined later.
 */
export function JobDraftSpace({ job }: { job: MockJob }) {
  const [stepIndex, setStepIndex] = React.useState(0)
  const [competencies, setCompetencies] = React.useState(INITIAL_COMPETENCIES)
  const [members, setMembers] = React.useState<Member[]>(INITIAL_MEMBERS)
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

            <h2 className="text-lg font-semibold tracking-tight">
              {STEPS[stepIndex].label}
            </h2>
            <p className="mt-1 mb-4 text-sm text-muted-foreground">
              {STEPS[stepIndex].description}
            </p>
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
              <TeamMembersStep members={members} setMembers={setMembers} />
            ) : STEPS[stepIndex].key === "workflow" ? (
              <WorkflowStep competencies={competencies} members={members} />
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
