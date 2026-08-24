/**
 * Why a scheduling attempt didn't do what it was supposed to.
 *
 * Every one of these travels as `payload.reason_code` on a single
 * `scheduling_failed` activity event — not as thirteen enum values. Thirteen
 * would put thirteen rows in the automation trigger list that
 * `scripts/automation-seed-check.ts` asserts is 1:1 with the seeded library, and
 * thirteen things nobody ever filters on separately.
 *
 * The codes are the stable part. The message a recruiter reads and the sentence
 * a candidate sees are both derived from the code, so re-wording either never
 * changes what a query matches.
 */

/** Codes the agent-interview flow can actually produce today. */
export const SCHEDULING_REASON_CODES = [
  // Policy — the gate said no. Not failures; the system worked as configured.
  "AUTOMATION_OFF_BY_POLICY",
  "AUTOMATION_PAUSED_FOR_JOB",
  "AUTOMATION_LOCKED",
  // The candidate's link
  "CANDIDATE_BOOKING_TOKEN_INVALID",
  "CANDIDATE_BOOKING_TOKEN_EXPIRED",
  "CANDIDATE_ALREADY_BOOKED",
  "CANDIDATE_LEFT_STAGE",
  // Capacity and slots
  "AGENT_CAPACITY_UNAVAILABLE",
  "NO_BOOKABLE_AGENT_SLOT",
  "SLOT_HOLD_EXPIRED",
  "SLOT_ALREADY_TAKEN",
  // The call itself
  "AGENT_CALL_START_FAILED",
  "SCHEDULED_AGENT_CALL_TRIGGER_FAILED",
  // Setup
  "SCHEDULING_CONFIGURATION_INVALID",
] as const

export type SchedulingReasonCode = (typeof SCHEDULING_REASON_CODES)[number]

/**
 * Reserved for human-interviewer scheduling, which this pass does not build.
 *
 * Declared here rather than invented later so the vocabulary is decided once —
 * a code that appears in a dashboard six months from now should not have been
 * named in a hurry by whoever wrote the calendar integration.
 *
 * **Nothing emits these.** They are deliberately not in `SchedulingReasonCode`,
 * so emitting one is a type error until human scheduling exists.
 */
export const RESERVED_HUMAN_SCHEDULING_REASON_CODES = [
  "INTERVIEWER_CALENDAR_NOT_CONNECTED",
  "INTERVIEWER_AVAILABILITY_INCOMPLETE",
  "NO_ELIGIBLE_INTERVIEWER",
  "NO_MATCHING_AVAILABILITY",
  "CALENDAR_EVENT_CREATION_FAILED",
  "VIDEO_LINK_CREATION_FAILED",
] as const

const REASON_CODE_SET: ReadonlySet<string> = new Set(SCHEDULING_REASON_CODES)

/** Narrows a string that came back from Postgres or n8n. */
export function isSchedulingReasonCode(value: unknown): value is SchedulingReasonCode {
  return typeof value === "string" && REASON_CODE_SET.has(value)
}

type ReasonMeta = {
  /** What a recruiter reads in the activity feed and Pulse Actions. */
  message: string
  /** What they should do about it. Null when there is nothing to do. */
  recommendedAction: string | null
  /** Whether retrying the same thing could plausibly work. */
  retryable: boolean
  /**
   * What the candidate sees, when they are the one who hits it.
   *
   * Null means the candidate must never see this code — either because it
   * describes internal configuration, or because telling them would leak
   * whether a token exists. Those cases fall back to one generic page.
   */
  candidateMessage: string | null
}

export const SCHEDULING_REASONS: Record<SchedulingReasonCode, ReasonMeta> = {
  AUTOMATION_OFF_BY_POLICY: {
    message: "Booking links are switched off for this job, so none was sent.",
    recommendedAction: "Turn the automation on for this job, or book the interview yourself.",
    retryable: false,
    candidateMessage: null,
  },
  AUTOMATION_PAUSED_FOR_JOB: {
    message: "Booking links are paused for this job, so none was sent.",
    recommendedAction: "Resume the automation for this job when you're ready for it to run again.",
    retryable: false,
    candidateMessage: null,
  },
  AUTOMATION_LOCKED: {
    message: "This automation is system-managed and can't be changed here.",
    recommendedAction: null,
    retryable: false,
    candidateMessage: null,
  },

  // The three token cases deliberately share one candidate-facing sentence. The
  // difference between "expired" and "never existed" is exactly what confirms to
  // someone guessing that a token existed.
  CANDIDATE_BOOKING_TOKEN_INVALID: {
    message: "Someone opened a booking link that doesn't match any request.",
    recommendedAction: "Usually harmless. Send a fresh link if the candidate says theirs won't open.",
    retryable: false,
    candidateMessage: "This booking link is no longer valid.",
  },
  CANDIDATE_BOOKING_TOKEN_EXPIRED: {
    message: "The candidate's booking link expired before they chose a time.",
    recommendedAction: "Send a new booking link, or reach out to schedule directly.",
    retryable: true,
    candidateMessage: "This booking link is no longer valid.",
  },
  CANDIDATE_ALREADY_BOOKED: {
    message: "The candidate already has an interview booked for this stage.",
    recommendedAction: null,
    retryable: false,
    candidateMessage: "This booking link is no longer valid.",
  },
  CANDIDATE_LEFT_STAGE: {
    message: "The candidate moved out of this stage, so their booking link was cancelled.",
    recommendedAction: null,
    retryable: false,
    // Same sentence as every other dead link. A candidate holding a link must
    // never learn from it that they were moved back a stage — that is a
    // conversation for a recruiter to have, not a page.
    candidateMessage: "This booking link is no longer valid.",
  },

  AGENT_CAPACITY_UNAVAILABLE: {
    message: "Every one of the interviewer agent's lines was busy at that moment.",
    recommendedAction: "Raise the agent's concurrent-call limit, or ask the candidate to pick a later time.",
    retryable: true,
    candidateMessage: "That time just filled up. Please choose another.",
  },
  NO_BOOKABLE_AGENT_SLOT: {
    message: "No slot fits inside the stage's booking horizon and minimum notice.",
    recommendedAction: "Widen the booking horizon, shorten the minimum notice, or extend the operating hours.",
    retryable: false,
    candidateMessage: "There are no times available right now. We'll be in touch.",
  },
  SLOT_HOLD_EXPIRED: {
    message: "The candidate's hold on a slot ran out before they confirmed.",
    recommendedAction: null,
    retryable: true,
    candidateMessage: "Your held time ran out. Please choose a time again.",
  },
  SLOT_ALREADY_TAKEN: {
    message: "Another candidate booked that slot first.",
    recommendedAction: null,
    retryable: true,
    candidateMessage: "That time was just taken. Please choose another.",
  },

  AGENT_CALL_START_FAILED: {
    message: "The interview was booked but the agent's call couldn't be started.",
    recommendedAction: "Check the calling service, then re-run the call or rebook the candidate.",
    retryable: true,
    candidateMessage: "We couldn't start your interview. Please pick another time.",
  },
  SCHEDULED_AGENT_CALL_TRIGGER_FAILED: {
    message: "A booked interview's call failed every retry and was given up on.",
    recommendedAction: "Call the candidate yourself, or rebook them once the calling service is healthy.",
    retryable: false,
    candidateMessage: null,
  },

  SCHEDULING_CONFIGURATION_INVALID: {
    message: "This stage is set to self-schedule but isn't configured to do it.",
    recommendedAction:
      "Check the stage has an agent assigned and valid booking settings, or switch it to recruiter-led.",
    retryable: false,
    candidateMessage: null,
  },
}

/**
 * The one sentence shown for any failure the candidate must not be told apart.
 * Used whenever `candidateMessage` is null — see the token codes above.
 */
export const GENERIC_CANDIDATE_MESSAGE = "This booking link is no longer valid."

export function candidateMessageFor(code: SchedulingReasonCode | null | undefined): string {
  if (!code) return GENERIC_CANDIDATE_MESSAGE
  return SCHEDULING_REASONS[code]?.candidateMessage ?? GENERIC_CANDIDATE_MESSAGE
}

/**
 * Codes that describe a deliberate policy decision rather than something going
 * wrong. These are logged as `automation_skipped_by_policy` at `info`, never as
 * a `scheduling_failed` alert — a paused automation is the system obeying, and
 * putting it in the recruiter's Actions list would train people to ignore it.
 */
export function isPolicySkip(code: SchedulingReasonCode): boolean {
  return (
    code === "AUTOMATION_OFF_BY_POLICY" ||
    code === "AUTOMATION_PAUSED_FOR_JOB" ||
    code === "AUTOMATION_LOCKED"
  )
}

/**
 * Codes the candidate causes by normal use, which must not raise an alert.
 * Refreshing a confirmation page is not an incident.
 */
export function isBenign(code: SchedulingReasonCode): boolean {
  return (
    code === "CANDIDATE_ALREADY_BOOKED" ||
    code === "CANDIDATE_BOOKING_TOKEN_INVALID" ||
    // A recruiter moved them; the cancelled link is the consequence, not an
    // incident. Raising it would put an alert in the Actions list for something
    // that recruiter did on purpose seconds earlier.
    code === "CANDIDATE_LEFT_STAGE"
  )
}
