import {
  AUTOMATION_EVENT_GROUPS,
  type AutomationMode,
} from "@/lib/automation-events"

/**
 * What one automation actually does — the preview behind each trigger in the
 * rule library.
 *
 * A rule is one thing, not four: the trigger it hangs off, the actions it
 * takes, the work it creates for a person and the nudges that follow, the SLA
 * it's measured against, and what happens when it can't finish. Those last
 * three were briefly their own sections; that split one automation across three
 * destinations and made "what happens when a candidate withdraws?" unanswerable
 * in one place.
 *
 * ⚠️ **Preview content.** There is no `automation_rules` UI and nothing runs
 * these yet (see DB_Schema.md). These describe the intended behaviour so the
 * library reads as something real rather than a list of trigger names; they are
 * not a specification, and nothing executes from this file.
 */

export type AutomationRule = {
  /** Matches an `AutomationEvent.id` in `src/lib/automation-events.ts`. */
  eventId: string
  /** What has to be true when the trigger fires, or the rule doesn't run. */
  condition: string
  mode: AutomationMode
  /** What the rule does when the trigger fires. */
  actions: string[]
  /** Work it opens for a person, and the nudges that follow. */
  tasksAndReminders: string[]
  /** What happens when it can't complete, and who hears about it. */
  exceptions: string[]
  /** The SLA clock this rule starts or stops, if any. */
  sla?: string
}

const RULES: AutomationRule[] = [
  // Candidate lifecycle
  {
    eventId: "candidate_added_to_stage",
    condition: "The stage has an owner and the role's agent context compiles.",
    mode: "auto",
    actions: [
      "Send the stage's candidate-facing message, if it has one",
      "Assign the stage owner and start the stage's SLA clock",
      "Compile the screening agent's context for this role",
    ],
    tasksAndReminders: [
      "Task for the stage owner when entry needs a manual action",
      "Reminder to the owner at half the stage SLA",
    ],
    exceptions: [
      "Company knowledge is missing a sensitive answer — hand the topic to the recruiter",
      "No stage owner set — escalate to the job's account owner",
    ],
    sla: "Needs Scheduling",
  },
  {
    eventId: "candidate_data_updated",
    condition: "A field that feeds search or fit changed — not a note or a tag.",
    mode: "auto",
    actions: [
      "Re-generate the candidate's embedding so search stays current",
      "Refresh fit scores for this company's open roles",
    ],
    tasksAndReminders: [
      "Flag the recruiter when a change contradicts a confirmed screening answer",
    ],
    exceptions: ["Embeddings provider unavailable — retry, then alert the recruiter"],
  },
  {
    eventId: "candidate_leaves_stage",
    condition: "A decision is recorded on the stage.",
    mode: "manual",
    actions: [
      "Close the stage's open tasks and stop its SLA clock",
      "Advance to the next sub-stage, or record the outcome",
      "Send the stage's outcome message",
    ],
    tasksAndReminders: ["Task for the recruiter to approve rejection wording before it sends"],
    exceptions: ["No decision recorded after the interview — hold and notify the stage owner"],
    sla: "Needs Decision",
  },
  {
    eventId: "candidate_withdraws",
    condition: "Always — a withdrawal is never conditional.",
    mode: "auto",
    actions: [
      "Mark the application withdrawn and release the pipeline slot",
      "Cancel any booked interview and give the interviewer their time back",
    ],
    tasksAndReminders: ["Task for the recruiter to log the reason"],
    exceptions: ["Calendar event couldn't be cancelled — alert the coordinator"],
  },
  {
    eventId: "candidate_fast_tracked",
    condition: "None of the skipped stages is marked required for the role.",
    mode: "manual",
    actions: [
      "Skip the intervening sub-stages and record why",
      "Compile the agent context for the stage they land in",
    ],
    tasksAndReminders: ["Task for the hiring manager to confirm the skip"],
    exceptions: ["A stage the role requires was skipped — escalate to the account owner"],
  },

  // Scheduling & interviews
  {
    eventId: "interview_scheduled",
    condition: "The stage is a booked interview, not an async or external one.",
    mode: "auto",
    actions: [
      "Send the confirmation the communication policy specifies",
      "Write the calendar event and attach the interviewer briefing package",
    ],
    tasksAndReminders: [
      "Candidate and interviewer reminders on the schedule the policy sets",
    ],
    exceptions: ["Calendar write failed — follow the calendar write failure policy"],
  },
  {
    eventId: "interview_rescheduled",
    condition: "The candidate has reschedules left under the stage's policy.",
    mode: "auto",
    actions: [
      "Update the calendar event and re-send both confirmations",
      "Reset the reminder schedule to the new time",
    ],
    tasksAndReminders: [
      "Task for the coordinator once the candidate has used their last reschedule",
    ],
    exceptions: ["No slot inside the booking horizon — follow the no-slot fallback"],
  },
  {
    eventId: "interview_completed",
    condition: "The interview ran to completion — not cancelled, not a no-show.",
    mode: "auto",
    actions: [
      "Open the scorecard for every required interviewer",
      "Attach the recording and transcript to the evaluation",
    ],
    tasksAndReminders: ["Feedback reminders on the policy's escalating sequence"],
    exceptions: ["Recording never arrived — mark the evaluation incomplete for review"],
    sla: "Needs Feedback",
  },
  {
    eventId: "interview_canceled",
    condition: "Cancelled before it started, by either side.",
    mode: "manual",
    actions: [
      "Release the slot and cancel the calendar event",
      "Tell the candidate, using the stage's cancellation wording",
    ],
    tasksAndReminders: ["Task for the coordinator to rebook"],
    exceptions: ["Cancelled inside the cutoff — notify the stage owner"],
  },
  {
    eventId: "interview_no_show_candidate",
    condition: "No candidate join after the grace period, and the interviewer waited.",
    mode: "manual",
    actions: [
      "Record the no-show on the application",
      "Send the follow-up the policy specifies",
    ],
    tasksAndReminders: ["Task for the recruiter: rebook or close"],
    exceptions: ["Second no-show — escalate to the account owner"],
  },
  {
    eventId: "interview_no_show_interviewer",
    condition: "The candidate joined and no required interviewer did.",
    mode: "auto",
    actions: [
      "Record the no-show and apologise to the candidate",
      "Offer the candidate a new slot straight away",
    ],
    tasksAndReminders: ["Task for the coordinator to rebook with an approved backup"],
    exceptions: ["No backup interviewer approved — escalate to the hiring manager"],
  },

  // Evaluation & decision
  {
    eventId: "evaluations_completed",
    condition: "Every required rater has submitted a scorecard.",
    mode: "auto",
    actions: [
      "Compute the application scorecard from the submitted evaluations",
      "Tell the decision owner it's ready",
    ],
    tasksAndReminders: ["Reminder to the decision owner after 24 hours"],
    exceptions: ["Raters disagree beyond the threshold — hold for the hiring manager"],
    sla: "Needs Decision",
  },
  {
    eventId: "evaluation_overdue",
    condition: "No scorecard 24 hours after the interview ended.",
    mode: "auto",
    actions: ["Chase the interviewer on the reminder channel"],
    tasksAndReminders: ["Escalating sequence: 2 hours, then 24 hours"],
    exceptions: ["Still missing after the sequence — reassign to the stage owner"],
    sla: "Needs Feedback",
  },
  {
    eventId: "decision_made",
    condition: "The decision owner recorded an outcome.",
    mode: "manual",
    actions: [
      "Advance, reject, or create the offer",
      "Send the stage's decision message",
      "Close the stage's tasks and stop its SLA clock",
    ],
    tasksAndReminders: ["Task for the recruiter to create the offer when the decision is Offer"],
    exceptions: ["Decision overridden — record who overrode it and why"],
    sla: "Needs Offer Creation",
  },
]

/**
 * Where a rule's on/off state was decided. Deliberately the three scopes a
 * person can point at and go change — the global library, this company, or the
 * workflow the job runs — rather than the full `POLICY_SCOPES` ladder, because
 * "why is this off?" is only useful if the answer names somewhere you can act.
 */
export type AutomationScope = "global" | "company" | "workflow" | "job"

export const AUTOMATION_SCOPE_LABEL: Record<AutomationScope, string> = {
  global: "Global library",
  company: "Company",
  workflow: "Workflow",
  job: "This job",
}

/**
 * Three states, not a boolean. **Paused** is the one that earns its place: an
 * automation you've switched off for a fortnight while a hiring manager is away
 * is a different thing from one this company never runs, and collapsing them
 * loses the only bit of information anyone needs later — whether it's coming
 * back.
 */
export type AutomationRunState = "active" | "paused" | "stopped"

export const AUTOMATION_RUN_STATE_LABEL: Record<AutomationRunState, string> = {
  active: "Active",
  paused: "Paused",
  stopped: "Stopped",
}

export type AutomationState = { state: AutomationRunState; source: AutomationScope }

/**
 * ⚠️ **Fixture.** How each rule currently resolves for a job — nothing reads a
 * real setting, because none is stored yet. It exists so the automations dialog
 * can show the states that matter, and where each was decided, rather than a
 * list where every row looks the same.
 */
const STATE: Record<string, AutomationState> = {
  candidate_added_to_stage: { state: "active", source: "global" },
  candidate_data_updated: { state: "active", source: "global" },
  candidate_leaves_stage: { state: "active", source: "workflow" },
  candidate_withdraws: { state: "active", source: "global" },
  candidate_fast_tracked: { state: "stopped", source: "company" },
  interview_scheduled: { state: "active", source: "workflow" },
  interview_rescheduled: { state: "active", source: "workflow" },
  interview_completed: { state: "active", source: "global" },
  interview_canceled: { state: "paused", source: "job" },
  interview_no_show_candidate: { state: "paused", source: "workflow" },
  interview_no_show_interviewer: { state: "active", source: "global" },
  evaluations_completed: { state: "active", source: "global" },
  evaluation_overdue: { state: "stopped", source: "global" },
  decision_made: { state: "active", source: "workflow" },
}

export function automationState(eventId: string): AutomationState {
  return STATE[eventId] ?? { state: "stopped", source: "global" }
}

/**
 * A rule the global library has stopped can't be started on one job — the rule
 * doesn't exist to run. It shows as stopped here and points at where that was
 * decided, rather than offering a control that would silently do nothing.
 */
export function isLockedByGlobal(state: AutomationState): boolean {
  return state.state === "stopped" && state.source === "global"
}

const BY_EVENT = new Map(RULES.map((r) => [r.eventId, r]))

export function automationRule(eventId: string): AutomationRule | null {
  return BY_EVENT.get(eventId) ?? null
}

/** The event's own wording — the rule's Trigger line, so it can't be paraphrased twice. */
export function automationTriggerLabel(eventId: string): string {
  return (
    AUTOMATION_EVENT_GROUPS.flatMap((g) => g.events).find((e) => e.id === eventId)?.label ??
    eventId
  )
}

/** Every event that has a rule described for it, in `AUTOMATION_EVENT_GROUPS` order. */
export function rulesForEventGroup(
  groupTitle: string
): { id: string; label: string; rule: AutomationRule | null }[] {
  const group = AUTOMATION_EVENT_GROUPS.find((g) => g.title === groupTitle)
  if (!group) return []
  return group.events.map((e) => ({ id: e.id, label: e.label, rule: automationRule(e.id) }))
}
