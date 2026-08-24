/**
 * How the Automations page divides its rules — by the part of the process a
 * rule acts on, not by trigger type, so "what runs when a candidate is
 * rejected" is one place to look rather than three.
 *
 * The first three draw their triggers from `AUTOMATION_EVENT_GROUPS`, which
 * the workflow settings tab and the job automation menu already render — one
 * vocabulary, so a rule described here and a trigger picked there can't drift
 * apart. `runs` is different in kind (a log of executions, not a set of rules).
 *
 * Tasks, reminders, SLAs, exceptions and escalations are deliberately **not**
 * sections. Every one of them belongs to a rule — the task a rule opens, the
 * SLA it's measured against, what happens when it can't complete — so they
 * render inside a rule's preview (`src/lib/automation-rules.ts`). As sections
 * they'd have split one automation across three destinations.
 */
export type AutomationSectionKey = "lifecycle" | "scheduling" | "evaluation" | "runs"

export type AutomationSectionDef = {
  key: AutomationSectionKey
  label: string
  purpose: string
  /** Title of the matching `AUTOMATION_EVENT_GROUPS` entry, when one exists. */
  eventGroup?: string
}

export const AUTOMATION_SECTIONS: AutomationSectionDef[] = [
  {
    key: "lifecycle",
    label: "Candidate lifecycle",
    purpose: "Rules that fire as a candidate enters, moves through, or leaves a stage.",
    eventGroup: "Candidate Events",
  },
  {
    key: "scheduling",
    label: "Scheduling & interviews",
    purpose: "Rules around booking, rescheduling, and what happens when an interview doesn't go ahead.",
    eventGroup: "Interview & Scheduling",
  },
  {
    key: "evaluation",
    label: "Evaluation & decision",
    purpose: "Rules that fire on scorecards, missing feedback, and stage decisions.",
    eventGroup: "Evaluation & Decision Events",
  },
  {
    key: "runs",
    label: "Automation runs",
    purpose: "Every execution — what fired, on which application, and whether it succeeded.",
  },
]

export function findAutomationSection(param?: string): AutomationSectionDef {
  return AUTOMATION_SECTIONS.find((s) => s.key === param) ?? AUTOMATION_SECTIONS[0]
}
