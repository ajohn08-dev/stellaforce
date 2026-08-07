"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { StepProgressBar, type Step } from "@/components/jobs/draft/step-progress-bar"
import {
  RoleDefinitionStep,
  type RoleFormValues,
  type RoleInitialValues,
} from "@/components/jobs/draft/steps/role-definition-step"
import { EvaluationCriteriaStep } from "@/components/jobs/draft/steps/evaluation-criteria-step"
import { ScoreCardStep } from "@/components/jobs/draft/steps/score-card-step"
import { TeamMembersStep } from "@/components/jobs/draft/steps/team-members-step"
import { WorkflowStep } from "@/components/jobs/draft/steps/workflow-step"
import type { Competency } from "@/components/jobs/draft/steps/competency-data"
import { type Member } from "@/components/jobs/draft/steps/team-member-data"
import { useSidebarDefaultCollapsed } from "@/lib/sidebar-context"
import {
  generateScorecard,
  publishJob,
  saveRoleAndGenerateCompetencies,
} from "@/app/(app)/jobs/actions"
import type { ScoreCardCategory } from "@/components/jobs/draft/steps/score-card-step"
import type { MockJob } from "@/lib/mock-jobs"
import type { JobWorkflowSubStageWithLinks } from "@/lib/data"

export type WorkflowTemplateOption = { id: string; name: string; status: string }

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
export function JobDraftSpace({
  job,
  templates,
  roleInitial,
  competenciesInitial,
  scorecardInitial,
  membersInitial,
  workflowTemplateIdInitial,
  workflowSubStagesInitial,
  isPublished = false,
  hasCandidates = false,
}: {
  job: MockJob
  templates: WorkflowTemplateOption[]
  roleInitial?: RoleInitialValues
  competenciesInitial?: Competency[]
  scorecardInitial?: ScoreCardCategory[]
  membersInitial?: Member[]
  workflowTemplateIdInitial?: string | null
  workflowSubStagesInitial?: JobWorkflowSubStageWithLinks[]
  /** True when re-entering this same wizard to edit an already-published job
   * (via "Edit job" → ?edit=1) rather than setting one up for the first time. */
  isPublished?: boolean
  /** Locks the Workflow step's template picker — replacing the template would
   * delete job_workflow_sub_stages rows a candidate's application already
   * points at. */
  hasCandidates?: boolean
}) {
  const router = useRouter()
  const [stepIndex, setStepIndex] = React.useState(0)
  const [competencies, setCompetencies] = React.useState<Competency[]>(
    competenciesInitial ?? []
  )
  const [scorecard, setScorecard] = React.useState<ScoreCardCategory[]>(
    scorecardInitial ?? []
  )
  const [members, setMembers] = React.useState<Member[]>(membersInitial ?? [])
  const [templateId, setTemplateId] = React.useState<string | undefined>(
    workflowTemplateIdInitial ?? undefined
  )
  const [publishing, setPublishing] = React.useState(false)
  const [roleValues, setRoleValues] = React.useState<RoleFormValues>()
  const [generating, setGenerating] = React.useState(false)
  const isLastStep = stepIndex === STEPS.length - 1

  // Which steps already have data (rendered black + freely clickable). Role
  // Definition always has data (title/description come from job creation).
  const dataKeys = [
    "role-definition",
    ...(competencies.length > 0 ? ["evaluation-criteria"] : []),
    ...(scorecard.length > 0 ? ["score-card"] : []),
    ...(members.length > 0 ? ["team-members"] : []),
    ...(templateId ? ["workflow"] : []),
  ]

  useSidebarDefaultCollapsed(true)

  async function handleNext() {
    const key = STEPS[stepIndex].key

    // Leaving Role Definition → save values + generate Evaluation Criteria (once).
    if (key === "role-definition" && roleValues) {
      setGenerating(true)
      const res = await saveRoleAndGenerateCompetencies(job.job_id, roleValues)
      setGenerating(false)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      setCompetencies(res.competencies)
    }

    // Leaving Evaluation Criteria → generate the Scorecard from competencies (once).
    if (key === "evaluation-criteria") {
      setGenerating(true)
      const res = await generateScorecard(job.job_id)
      setGenerating(false)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      setScorecard(res.scorecard)
    }

    setStepIndex((i) => Math.min(STEPS.length - 1, i + 1))
  }

  async function handlePublish() {
    // Editing an already-published job: every step already auto-saves as
    // you go (role fields on Next, team members/workflow per-interaction) —
    // there's nothing left to do here but leave the wizard.
    if (isPublished) {
      router.push(`/jobs/${job.job_id}`)
      return
    }
    if (!templateId) {
      toast.error("Select a workflow template on the Workflow step before publishing.")
      return
    }
    setPublishing(true)
    const res = await publishJob(job.job_id, {
      workflow_template_id: templateId,
    })
    setPublishing(false)
    if (!res.ok) {
      toast.error(res.error)
      return
    }
    toast.success("Job published — you can now add candidates.")
    router.refresh()
  }

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
            dataKeys={dataKeys}
            onStepClick={setStepIndex}
            orientation="vertical"
          />
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="shrink-0">
            {isPublished && (
              <button
                type="button"
                onClick={() => router.push(`/jobs/${job.job_id}`)}
                className="mb-3 text-sm text-muted-foreground hover:text-foreground"
              >
                ← Back to pipeline
              </button>
            )}
            <div className="flex items-center justify-between pb-6">
              <Button
                variant="outline"
                disabled={stepIndex === 0}
                onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
              >
                Back
              </Button>
              <Button
                disabled={publishing || generating}
                onClick={() => (isLastStep ? handlePublish() : handleNext())}
              >
                {isLastStep
                  ? isPublished
                    ? "Done"
                    : publishing
                      ? "Publishing…"
                      : "Publish job"
                  : generating
                    ? (STEPS[stepIndex].key === "role-definition"
                        ? competencies.length > 0
                        : scorecard.length > 0)
                      ? "Saving…"
                      : "Generating…"
                    : "Next"}
              </Button>
            </div>

            {STEPS[stepIndex].key !== "workflow" && (
              <>
                <h2 className="text-lg font-semibold tracking-tight">
                  {STEPS[stepIndex].label}
                </h2>
                <p className="mt-1 mb-4 text-sm text-muted-foreground">
                  {STEPS[stepIndex].description}
                </p>
              </>
            )}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {STEPS[stepIndex].key === "role-definition" ? (
              <RoleDefinitionStep initial={roleInitial} onChange={setRoleValues} />
            ) : STEPS[stepIndex].key === "evaluation-criteria" ? (
              <EvaluationCriteriaStep
                competencies={competencies}
                setCompetencies={setCompetencies}
              />
            ) : STEPS[stepIndex].key === "score-card" ? (
              <ScoreCardStep
                competencies={competencies}
                categories={scorecard}
                setCategories={setScorecard}
              />
            ) : STEPS[stepIndex].key === "team-members" ? (
              <TeamMembersStep
                jobId={job.job_id}
                members={members}
                setMembers={setMembers}
                sendInviteImmediately={isPublished}
              />
            ) : STEPS[stepIndex].key === "workflow" ? (
              <WorkflowStep
                jobId={job.job_id}
                label={STEPS[stepIndex].label}
                description={STEPS[stepIndex].description ?? ""}
                competencies={competencies}
                members={members}
                templates={templates}
                selectedTemplateId={templateId}
                onSelectTemplate={setTemplateId}
                subStagesInitial={workflowSubStagesInitial ?? []}
                templateLocked={hasCandidates}
              />
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
