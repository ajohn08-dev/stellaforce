import { AUTOMATION_RUN_STATE_LABEL } from "@/lib/automation-rules"
import type { ResolvedAutomation } from "@/lib/automation-resolve"

/**
 * State and where it was decided, in one read — *"Active · Workflow"*, *"Off ·
 * Acme Robotics"*, *"Paused · Job override"*.
 *
 * Subtext under the rule name rather than a badge in its own column: it belongs
 * to the rule, so it reads as a caption; in a column of its own it competed with
 * the control beside it and pushed the names into a narrow, ragged strip.
 *
 * The source label is the layer's own name, not the word "Company" — the point
 * of naming where a setting came from is that you can go there and change it,
 * and "Company" doesn't tell you which one when you're looking at a job.
 */
export function AutomationStateSubtext({
  automation,
}: {
  automation: ResolvedAutomation
}) {
  const { effectiveState, stateSource } = automation
  const state = AUTOMATION_RUN_STATE_LABEL[effectiveState]

  return (
    <span
      className="truncate text-xs text-muted-foreground"
      title={
        stateSource.scope === "job"
          ? `${state}, set for this job`
          : `${state}, set at ${stateSource.label}`
      }
    >
      {state} · {stateSource.label}
    </span>
  )
}
