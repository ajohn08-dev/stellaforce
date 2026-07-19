"use client"

import * as React from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { StepProgressBar, type Step } from "@/components/jobs/draft/step-progress-bar"
import type { MockJob } from "@/lib/mock-jobs"

const STEPS: Step[] = [
  { key: "role-definition", label: "Role Definition" },
  { key: "evaluation-criteria", label: "Evaluation Criteria" },
  { key: "workflow", label: "Workflow" },
]

/**
 * Job setup wizard — shown instead of the pipeline workspace while a job is
 * still in "draft" status. Step content is a placeholder for now; each
 * step's actual fields will be defined later.
 */
export function JobDraftSpace({ job }: { job: MockJob }) {
  const [stepIndex, setStepIndex] = React.useState(0)
  const isLastStep = stepIndex === STEPS.length - 1

  return (
    <div
      className="flex flex-col overflow-hidden p-4"
      // Inline style, not an arbitrary Tailwind class: <main> has no padding
      // of its own, so only the app header (h-14 = 3.5rem) needs
      // subtracting — this div's own p-4 is included via border-box.
      style={{ height: "calc(100vh - 3.5rem)" }}
    >
      <div className="shrink-0 space-y-4 pb-4">
        <h1 className="text-xl font-semibold tracking-tight">{job.title}</h1>
        <StepProgressBar
          steps={STEPS}
          currentIndex={stepIndex}
          onStepClick={setStepIndex}
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pt-6">
        <h2 className="text-lg font-semibold tracking-tight">
          {STEPS[stepIndex].label}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Setup for this step is coming soon.
        </p>
      </div>

      <div className="flex shrink-0 items-center justify-between border-t border-border pt-4">
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
    </div>
  )
}
