/**
 * The communication policy a workflow template carries — what a candidate and
 * an interviewer are sent around an interview, and when. Same shape and same
 * cascade as `src/lib/scheduling-policy.ts` (both build on
 * `src/lib/policy-settings.ts`), and the seed for **every new workflow**: a
 * template that has stored nothing resolves to
 * `DEFAULT_COMMUNICATION_POLICY` in full, so the Communication tab opens with
 * every option already at its recommended value.
 *
 * Nothing here is written to the DB yet (see CLAUDE.md build order); when it
 * is, these belong in the `createWorkflowTemplate` insert alongside the
 * scheduling defaults.
 */

import {
  defaultsOf,
  defineSetting as setting,
  resolveSettingValue,
  subsetOf,
  type PolicyLayers,
  type PolicySettingDef,
  type Resolved,
} from "@/lib/policy-settings"

export type CommunicationSettingDef = PolicySettingDef

export const INVITE_SETTINGS: CommunicationSettingDef[] = [
  setting(
    "invite_channel",
    "Scheduling invite channel",
    "How candidates receive the booking request",
    ["Email", "SMS", "Email + SMS", "Recruiter sends manually", "In-app only"],
    "Email"
  ),
  setting(
    "invite_timing",
    "Scheduling invite timing",
    "When the link is sent after stage entry",
    [
      "Immediately",
      "After recruiter review",
      "After hiring manager approval",
      "At scheduled time",
      "Manual send only",
    ],
    "Immediately"
  ),
  setting(
    "candidate_confirmation",
    "Candidate confirmation",
    "What happens immediately after booking",
    [
      "Confirmation page only",
      "Email confirmation",
      "Email + calendar invite",
      "Email + SMS",
      "All enabled channels",
    ],
    "Email + calendar invite"
  ),
  setting(
    "alternative_time_option",
    "Candidate alternative-time option",
    "Whether candidate can say the offered slots do not work",
    [
      "Disabled",
      "Enabled with free text",
      "Enabled with structured date/time windows",
      "Route directly to recruiter",
    ],
    "Enabled with structured date/time windows"
  ),
  setting(
    "alternative_time_limit",
    "Candidate alternative-time limit",
    "Number of alternative windows candidate can submit",
    ["1", "3", "5", "Unlimited"],
    "3"
  ),
  setting(
    "candidate_language",
    "Candidate language",
    "Default language for booking experience",
    [
      "Organization default",
      "Candidate profile language",
      "Candidate browser language",
      "Candidate chooses",
    ],
    "Candidate profile language"
  ),
]

export const REMINDER_SETTINGS: CommunicationSettingDef[] = [
  setting(
    "invite_reminder_policy",
    "Invite reminder policy",
    "Follow-up when candidate has not booked",
    ["No reminder", "After 24 hours", "After 48 hours", "After 3 days", "Custom sequence"],
    "Custom sequence"
  ),
  setting(
    "max_invite_reminders",
    "Maximum invite reminders",
    "Number of unbooked-link reminders",
    ["0", "1", "2", "3", "Custom"],
    "2"
  ),
  setting(
    "candidate_interview_reminders",
    "Candidate interview reminders",
    "Reminder schedule before interview",
    ["None", "24 hours before", "1 hour before", "24 hours + 1 hour", "Custom"],
    "24 hours + 1 hour"
  ),
  setting(
    "interviewer_interview_reminders",
    "Interviewer interview reminders",
    "Reminder schedule for interviewers",
    [
      "None",
      "24 hours before",
      "2 hours before",
      "1 hour before",
      "24 hours + 1 hour",
      "Custom",
    ],
    "24 hours + 1 hour"
  ),
  setting(
    "reminder_channels",
    "Reminder channels",
    "Where reminders are sent",
    ["Email", "SMS", "Slack/Teams", "Email + Slack/Teams", "Custom"],
    "Email"
  ),
]

export const INTERVIEWER_PREP_SETTINGS: CommunicationSettingDef[] = [
  setting(
    "interviewer_briefing",
    "Interviewer briefing package",
    "What is sent before interview",
    [
      "Calendar invite only",
      "Candidate resume",
      "Resume + job description",
      "Resume + scorecard",
      "Full interviewer packet",
    ],
    "Resume + scorecard"
  ),
  setting(
    "feedback_reminder_policy",
    "Feedback reminder policy",
    "When interviewers are reminded to submit feedback",
    [
      "No reminder",
      "Immediately after interview",
      "2 hours after",
      "24 hours after",
      "Escalating sequence",
    ],
    "Escalating sequence"
  ),
]

export const ALL_COMMUNICATION_SETTINGS: CommunicationSettingDef[] = [
  ...INVITE_SETTINGS,
  ...REMINDER_SETTINGS,
  ...INTERVIEWER_PREP_SETTINGS,
]

export type CommunicationPolicy = {
  /** Keyed by `CommunicationSettingDef.key`. */
  settings: Record<string, string>
}

/** What a workflow that has never been edited starts with — every option at its recommended value. */
export const DEFAULT_COMMUNICATION_POLICY: CommunicationPolicy = {
  settings: defaultsOf(ALL_COMMUNICATION_SETTINGS),
}

/** A partially-stored policy — anything absent falls back to the scope above it. */
export type StoredCommunicationPolicy = {
  settings?: Record<string, string>
}

/** Layers of the shared cascade (`POLICY_SCOPES`), carrying communication policies. */
export type CommunicationLayers = PolicyLayers<StoredCommunicationPolicy>

export function resolveCommunicationSetting(
  key: string,
  layers: CommunicationLayers
): Resolved<string> {
  return resolveSettingValue(key, layers, DEFAULT_COMMUNICATION_POLICY.settings)
}

export function communicationPolicyWithDefaults(
  stored?: StoredCommunicationPolicy
): CommunicationPolicy {
  return { settings: { ...DEFAULT_COMMUNICATION_POLICY.settings, ...stored?.settings } }
}

/**
 * The settings a single sub-stage may override. Deliberately a subset — the
 * rest are properties of the *account* or of the candidate rather than of a
 * stage: which channel reaches someone, what language they read, and what
 * lands the moment they book don't become different facts because this is the
 * panel rather than the screen. What's here does vary by stage — a recruiter
 * screen's link can go out on stage entry while an onsite waits for hiring
 * manager approval, and a panel interviewer needs a fuller briefing and a
 * harder feedback nudge than a phone screener.
 */
export const SUB_STAGE_COMMUNICATION_KEYS = [
  "invite_timing",
  "invite_reminder_policy",
  "max_invite_reminders",
  "candidate_interview_reminders",
  "interviewer_interview_reminders",
  "interviewer_briefing",
  "feedback_reminder_policy",
] as const

/** The same defs the workflow tab renders, narrowed and ordered for a sub-stage. */
export const SUB_STAGE_COMMUNICATION_SETTINGS: CommunicationSettingDef[] = subsetOf(
  ALL_COMMUNICATION_SETTINGS,
  SUB_STAGE_COMMUNICATION_KEYS
)
