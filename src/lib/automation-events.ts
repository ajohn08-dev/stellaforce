/**
 * The pipeline events an automation can hang off, grouped and ordered as
 * they're presented to users.
 *
 * These ids are now **the keys of real rows** in `automation_definitions`, not
 * a private list: `npm run automation-check` asserts the two stay 1:1 in both
 * directions. The list survives the move to the database because it still owns
 * two things the schema deliberately doesn't — the display order (there is no
 * `display_order` column) and the grouping headings.
 */

export type AutomationEvent = { id: string; label: string }
export type AutomationEventGroup = { title: string; events: AutomationEvent[] }

export const AUTOMATION_EVENT_GROUPS: AutomationEventGroup[] = [
  {
    title: "Candidate Events",
    events: [
      { id: "candidate_added_to_stage", label: "Candidate added to stage" },
      // "Candidate data is updated" used to sit here. It named no field group
      // and no action beyond "re-embed", so it was never a contract a rule
      // could be written against -- it is not seeded, and a row the resolver
      // can't explain is worse than an absent one. It returns with a condition.
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
      // Two rules share the `candidate_added_to_stage` trigger: the broad
      // lifecycle rule of the same name, and this one, which fires only on a
      // self-scheduling agent stage. That is exactly what
      // `automation_definitions.key` being separate from `trigger_event_type`
      // was for, and this is the first case of it.
      { id: "send_booking_link", label: "Send interview booking link" },
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
      // Matches the `activity_event_type` member exactly. The id was shorthand
      // while the label already spelled the real name; adding a synonym to a
      // 39-value enum would have bought a permanent `if (a || b)` downstream.
      {
        id: "all_required_evaluations_completed",
        label: "All required evaluations completed",
      },
      {
        id: "evaluation_overdue",
        label: "Evaluation overdue (no scorecard after 24 hours)",
      },
      { id: "decision_made", label: "Decision made (advance / reject / offer created)" },
    ],
  },
]

/**
 * How much rope a rule gets before a human has to look at it — the authored
 * posture of a rule *version* (`automation_definition_versions.default_mode`).
 *
 * Two values, not three. `off` used to be one of them, which meant an
 * automation could be disabled on two different axes at once and a screen
 * holding both had to answer "what does Active + Off mean?". Disabling is
 * exclusively `automation_state = 'off'`; this axis is only ever about whether
 * a person signs off first. `manual` became `approval_required` for the same
 * reason — it says who does what, rather than describing the machine.
 */
export type AutomationMode = "auto" | "approval_required"

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
  {
    value: "approval_required",
    label: "Approval required",
    description: "Ask a person before anything leaves the building",
  },
]

/**
 * A new rule is written to ask first. Which of the seeded thirteen are `auto`
 * is a per-rule product decision recorded on each version, not a blanket
 * default — the five that require approval are the externally consequential
 * ones (rejection wording, a cancellation to a candidate, a no-show follow-up,
 * a fast-track past required stages, creating an offer).
 */
export const DEFAULT_AUTOMATION_MODE: AutomationMode = "approval_required"

export function automationModeLabel(mode: AutomationMode): string {
  return AUTOMATION_MODES.find((m) => m.value === mode)?.label ?? "Approval required"
}
