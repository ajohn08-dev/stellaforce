/**
 * The pipeline events an automation can hang off, grouped as they're presented
 * to users.
 *
 * Shared by the workflow settings "Automation" tab
 * (src/components/workflows/workflow-ai-automation-tab.tsx) and the job
 * workspace's per-job automation menu, so the two can't drift apart on wording
 * or which events exist.
 */

export type AutomationEvent = { id: string; label: string }
export type AutomationEventGroup = { title: string; events: AutomationEvent[] }

export const AUTOMATION_EVENT_GROUPS: AutomationEventGroup[] = [
  {
    title: "Candidate Events",
    events: [
      { id: "candidate_added_to_stage", label: "Candidate added to stage" },
      { id: "candidate_data_updated", label: "Candidate data is updated" },
      {
        id: "candidate_leaves_stage",
        label: "Candidate leaves stage (qualified or disqualified)",
      },
      { id: "candidate_withdraws", label: "Candidate withdraws application" },
      {
        id: "candidate_fast_tracked",
        label: "Candidate skipped / fast-tracked to later stage",
      },
    ],
  },
  {
    title: "Interview & Scheduling",
    events: [
      { id: "interview_scheduled", label: "Interview scheduled" },
      { id: "interview_rescheduled", label: "Interview rescheduled" },
      { id: "interview_completed", label: "Interview completed" },
      { id: "interview_canceled", label: "Interview canceled" },
      { id: "interview_no_show_candidate", label: "Interview no-show – candidate" },
      { id: "interview_no_show_interviewer", label: "Interview no-show – interviewer" },
    ],
  },
  {
    title: "Evaluation & Decision Events",
    events: [
      { id: "evaluations_completed", label: "All required evaluations completed" },
      {
        id: "evaluation_overdue",
        label: "Evaluation overdue (no scorecard after 24 hours)",
      },
      { id: "decision_made", label: "Decision made (advance / reject / offer created)." },
    ],
  },
]

/** How much rope an automation gets before a human has to look at it. */
export type AutomationMode = "auto" | "manual" | "off"

export const AUTOMATION_MODES: {
  value: AutomationMode
  label: string
  description: string
}[] = [
  {
    value: "auto",
    label: "Auto",
    description:
      "Approve actions that pass the condition, check and pause for anything risky",
  },
  { value: "manual", label: "Manual", description: "Ask approval before making changes" },
  { value: "off", label: "Off", description: "Don't run this automation for this job" },
]

/**
 * Everything starts on Manual: an automation that acts on a live pipeline
 * without anyone opting in is the wrong default, so the safe end is the one
 * that ships.
 */
export const DEFAULT_AUTOMATION_MODE: AutomationMode = "manual"

export function automationModeLabel(mode: AutomationMode): string {
  return AUTOMATION_MODES.find((m) => m.value === mode)?.label ?? "Manual"
}
