/**
 * The disclosure model for company knowledge — see COMPANY.md § D.0.
 *
 * Visibility is **two orthogonal axes plus a separate publication state**, not one
 * flat list:
 *
 *  - `Clearance` is the hard permission wall — a **clearance level** deciding how
 *    far an item may travel: cleared for candidates, recruiters only, or
 *    restricted. Note it is not "who can see this": candidates have no login,
 *    and the only thing that ever speaks to them is a screening agent.
 *  - `AgentUse` is a softer dial that exists only once an item is cleared for
 *    candidates. It decides *how* the agent may use one — volunteer it, answer
 *    only when asked, reason from it silently, or refuse and hand off.
 *  - `PublishState` is independent of both. An item can be cleared in intent and
 *    still be a draft.
 *
 * Keeping these apart is what makes "the agent knows this topic is in scope but
 * must not answer it" expressible, which is the only safe way to handle
 * sponsorship and compensation questions.
 *
 * This module is deliberately free of `server-only` and of any Supabase import so
 * it can drive client-side rendering (badges, popovers, bulk menus) as well as the
 * server-side context compile.
 */

/** How far an item may travel. The hard permission wall. */
export type Clearance =
  | "cleared_for_candidates"
  | "recruiters_only"
  | "restricted"

/** How the screening agent may use an item cleared for candidates. */
export type AgentUse = "proactive" | "on_request" | "reference_only" | "escalate"

/** Publication lifecycle, independent of clearance. */
export type PublishState =
  | "draft"
  | "in_review"
  | "published"
  | "needs_reverification"
  | "archived"

/** How much we trust the item's accuracy right now. */
export type VerificationStatus = "verified" | "needs_review" | "unverified" | "stale"

/**
 * The metadata block every knowledge-bearing entity embeds. Field names are chosen
 * to survive into Postgres unchanged when the DB pass happens.
 */
export type VisibilityBlock = {
  clearance: Clearance
  /** Null unless `clearance === "cleared_for_candidates"` — the axis doesn't apply otherwise. */
  agentUse: AgentUse | null
  state: PublishState
  /** Free text: where this came from. "Client intake call, 4 Aug 2026". */
  source: string
  verification: VerificationStatus
  /** ISO date, or null if never verified. */
  lastVerifiedAt: string | null
  verifiedBy: string | null
  owner: string
  reviewCadenceDays: number | null
  /** ISO date, or null if no cadence is set. */
  nextReviewAt: string | null
  /**
   * False once a human has touched this item's visibility. Drives the "N items
   * have their own settings" count in the section bulk menu, so a bulk change
   * can offer to preserve deliberate overrides.
   */
  isPresetDefault: boolean
}

/** Anything carrying a visibility block. */
export type VisibilityBearing = { visibility: VisibilityBlock }

// ---------------------------------------------------------------------------
// Labels
// ---------------------------------------------------------------------------

/**
 * Clearance is a **ladder**, not a statement about "who can see this".
 *
 * Candidates have no login and never see this workspace — the only thing that
 * ever speaks to them is a screening agent. So the question this axis answers is
 * *how far a piece of knowledge is cleared to travel*, and the labels say that
 * rather than describing a screen nobody looks at.
 */
export const CLEARANCE_LABELS: Record<Clearance, string> = {
  cleared_for_candidates: "Cleared for candidates",
  recruiters_only: "Recruiters only",
  restricted: "Restricted — named staff only",
}

/** Short form for badges and dense rows, where the full label won't fit. */
export const CLEARANCE_SHORT_LABELS: Record<Clearance, string> = {
  cleared_for_candidates: "Cleared",
  recruiters_only: "Recruiters only",
  restricted: "Restricted",
}

export const CLEARANCE_HELP: Record<Clearance, string> = {
  cleared_for_candidates: "A screening agent can use this in candidate conversations.",
  // Was "the agent never receives it", which stopped being true the moment
  // agents started working alongside recruiters rather than only calling
  // candidates. The wall is around the candidate, not around every machine.
  recruiters_only:
    "Never reaches a candidate. Agents working alongside you can still use it.",
  restricted: "Named staff only. No agent of any kind receives it.",
}

/** The heading above the clearance choices. */
export const CLEARANCE_QUESTION = "How far this travels"

export const AGENT_USE_LABELS: Record<AgentUse, string> = {
  proactive: "State proactively",
  on_request: "Answer only if asked",
  reference_only: "Reference only",
  escalate: "Always escalate",
}

export const AGENT_USE_HELP: Record<AgentUse, string> = {
  proactive: "The agent may bring this up without being asked.",
  on_request: "The agent uses this only when a candidate asks.",
  reference_only: "The agent may use this to reason, but must not quote it.",
  escalate: "The agent hands this topic to a recruiter instead of answering.",
}

export const PUBLISH_STATE_LABELS: Record<PublishState, string> = {
  draft: "Draft",
  in_review: "In review",
  published: "Published",
  needs_reverification: "Needs re-verification",
  archived: "Archived",
}

export const VERIFICATION_LABELS: Record<VerificationStatus, string> = {
  verified: "Verified",
  needs_review: "Needs review",
  unverified: "Unverified",
  stale: "Stale",
}

export const CLEARANCE_ORDER: Clearance[] = [
  "cleared_for_candidates",
  "recruiters_only",
  "restricted",
]
export const AGENT_USE_ORDER: AgentUse[] = [
  "proactive",
  "on_request",
  "reference_only",
  "escalate",
]

// ---------------------------------------------------------------------------
// The agent gate
// ---------------------------------------------------------------------------

/**
 * Who is asking. **Not every agent is a candidate-facing agent.**
 *
 * The knowledge base also feeds agents that work *with* the platform — a
 * recruiter's assistant drafting a submission, a sourcing agent ranking a
 * shortlist, whatever runs on `/chat`. Those are on our side of the wall, and
 * the recruiter brief, the hiring manager's quirks, and the sponsorship budget
 * are exactly what they need.
 */
export type AgentAudience = "candidate" | "internal"

export const AGENT_AUDIENCE_LABELS: Record<AgentAudience, string> = {
  candidate: "Candidate-facing",
  internal: "Internal",
}

export const AGENT_AUDIENCE_HELP: Record<AgentAudience, string> = {
  candidate: "What a screening agent may say to a candidate.",
  internal: "What an agent working alongside you may use. Never reaches a candidate.",
}

/**
 * **The single place the disclosure decision is made.** Every surface that asks
 * "will the agent say this?" — the knowledge panel, the readiness checks, the
 * context compile — calls this and nothing else.
 *
 * It takes an **audience** because the clearance ladder was being read as a
 * boolean. `recruiters_only` never meant "no agent, ever" — it meant "not to a
 * candidate". Reading it as the former is what made the internal agents
 * invisible in this model:
 *
 * | Clearance | Candidate-facing | Internal |
 * |---|---|---|
 * | `cleared_for_candidates` | ✅ | ✅ |
 * | `recruiters_only` | ❌ | ✅ |
 * | `restricted` | ❌ | ❌ |
 *
 * `restricted` bars both, which is the point of having a third rung: some
 * things go to named people and to no machine at all.
 *
 * The `agentUse` dial is **candidate-only** by construction — "state
 * proactively", "answer only if asked", and "always escalate" are all
 * descriptions of a candidate conversation. An internal agent ignores it, so an
 * `escalate` item (sponsorship, say) still reaches your assistant in full while
 * a candidate agent gets only the topic and the handoff instruction.
 */
export function agentCanUse(
  item: VisibilityBearing,
  audience: AgentAudience = "candidate"
): boolean {
  const v = item.visibility
  if (v.state !== "published" || v.verification === "stale") return false
  if (v.clearance === "restricted") return false

  if (audience === "internal") return true

  return v.clearance === "cleared_for_candidates" && v.agentUse !== "escalate"
}

/**
 * True when the item is candidate-safe but routes to a recruiter instead of
 * answering. These still enter the compiled bundle — as escalation rules.
 */
export function agentMustEscalate(item: VisibilityBearing): boolean {
  const v = item.visibility
  return v.clearance === "cleared_for_candidates" && v.agentUse === "escalate"
}

/** True when nothing about this item ever reaches a candidate-facing agent. */
export function isWithheldFromAgent(item: VisibilityBearing): boolean {
  return item.visibility.clearance !== "cleared_for_candidates"
}

/**
 * "Has someone written this down and approved it for candidates?" — **without**
 * the staleness term.
 *
 * This is the existence test, and it is deliberately not `agentCanUse()`. The
 * two answer different questions: *did you record this* versus *may the agent
 * say it right now*. Conflating them makes a company whose knowledge merely
 * expired look identical to one that never had any, which would report a
 * six-month-old profile as `blocked` instead of `review_required` — the
 * difference between "go re-confirm this" and "you have nothing".
 */
export function isPublishedCleared(item: VisibilityBearing): boolean {
  const v = item.visibility
  return (
    v.clearance === "cleared_for_candidates" &&
    v.state === "published" &&
    v.agentUse !== "escalate"
  )
}

// ---------------------------------------------------------------------------
// Staleness
// ---------------------------------------------------------------------------

/** Days before `nextReviewAt` at which we start warning. */
export const STALE_WARNING_DAYS = 30

export type StaleState = "fresh" | "approaching" | "overdue" | "never_verified"

/**
 * Staleness is computed against `today` rather than the wall clock so the mock
 * data renders deterministically and so tests can pin a date.
 */
export function staleState(item: VisibilityBearing, today: Date): StaleState {
  const v = item.visibility
  if (!v.lastVerifiedAt) return "never_verified"
  if (!v.nextReviewAt) return "fresh"

  const due = new Date(v.nextReviewAt).getTime()
  const now = today.getTime()
  if (now > due) return "overdue"

  const daysLeft = (due - now) / 86_400_000
  return daysLeft <= STALE_WARNING_DAYS ? "approaching" : "fresh"
}

/**
 * Stale means **a promise was made and missed** — a review cadence was set and
 * its date has passed.
 *
 * "Never verified" is deliberately not stale. An intake note written yesterday
 * with no cadence hasn't gone off; it simply hasn't been confirmed, which the
 * unverified-claims queue reports separately. Folding the two together makes
 * every brand-new company look neglected on the day it was created.
 */
export function isStale(item: VisibilityBearing, today: Date): boolean {
  return staleState(item, today) === "overdue"
}

/** Whole months since last verification — for "Last verified 8 months ago" copy. */
export function monthsSinceVerified(
  item: VisibilityBearing,
  today: Date
): number | null {
  const at = item.visibility.lastVerifiedAt
  if (!at) return null
  return Math.floor((today.getTime() - new Date(at).getTime()) / (86_400_000 * 30.4))
}

// ---------------------------------------------------------------------------
// Disclosure presets
// ---------------------------------------------------------------------------

export type DisclosurePreset = "conservative" | "standard" | "open"

/**
 * Field groups a preset can set a default for. Compensation, sponsorship, and
 * financial-stability items are deliberately **absent** — no preset ever defaults
 * those to candidate-safe. They are always an explicit recruiter decision.
 */
export type PresetFieldGroup =
  | "identity"
  | "narrative"
  | "culture"
  | "benefits"
  | "work_model"
  | "interview_process"

export type PresetDefault = { clearance: Clearance; agentUse: AgentUse | null }

export type DisclosurePresetDef = {
  key: DisclosurePreset
  label: string
  summary: string
  bestFor: string
  defaults: Record<PresetFieldGroup, PresetDefault>
}

const CANDIDATE_ON_REQUEST: PresetDefault = {
  clearance: "cleared_for_candidates",
  agentUse: "on_request",
}
const CANDIDATE_PROACTIVE: PresetDefault = {
  clearance: "cleared_for_candidates",
  agentUse: "proactive",
}
const INTERNAL: PresetDefault = { clearance: "recruiters_only", agentUse: null }
const ESCALATE: PresetDefault = { clearance: "cleared_for_candidates", agentUse: "escalate" }

export const DISCLOSURE_PRESETS: Record<DisclosurePreset, DisclosurePresetDef> = {
  conservative: {
    key: "conservative",
    label: "Conservative",
    summary:
      "Agents share almost nothing without your review. Most topics route back to you.",
    bestFor: "Regulated clients, or a company you don't know well yet.",
    defaults: {
      identity: CANDIDATE_ON_REQUEST,
      narrative: INTERNAL,
      culture: INTERNAL,
      benefits: INTERNAL,
      work_model: CANDIDATE_ON_REQUEST,
      interview_process: ESCALATE,
    },
  },
  standard: {
    key: "standard",
    label: "Standard",
    summary:
      "Agents answer company, culture, and benefits questions when candidates ask, and stay quiet otherwise.",
    bestFor: "Most accounts.",
    defaults: {
      identity: CANDIDATE_ON_REQUEST,
      narrative: CANDIDATE_ON_REQUEST,
      culture: CANDIDATE_ON_REQUEST,
      benefits: CANDIDATE_ON_REQUEST,
      work_model: CANDIDATE_ON_REQUEST,
      interview_process: CANDIDATE_ON_REQUEST,
    },
  },
  open: {
    key: "open",
    label: "Open",
    summary:
      "Agents actively pitch the company story and value proposition, not just answer questions.",
    bestFor: "Companies with a strong public employer brand.",
    defaults: {
      identity: CANDIDATE_PROACTIVE,
      narrative: CANDIDATE_PROACTIVE,
      culture: CANDIDATE_PROACTIVE,
      benefits: CANDIDATE_ON_REQUEST,
      work_model: CANDIDATE_PROACTIVE,
      interview_process: CANDIDATE_ON_REQUEST,
    },
  },
}

export const DISCLOSURE_PRESET_ORDER: DisclosurePreset[] = [
  "conservative",
  "standard",
  "open",
]

// ---------------------------------------------------------------------------
// Bulk (section-level) visibility
// ---------------------------------------------------------------------------

export type SectionVisibilitySummary = {
  total: number
  /** The clearance shared by every item, or null when the section is mixed. */
  uniformClearance: Clearance | null
  /** Count per clearance, for the "12 cleared · 3 recruiters only" line. */
  byClearance: Record<Clearance, number>
  /** Items a human has deliberately set — a bulk change offers to preserve these. */
  overrideCount: number
  isMixed: boolean
}

export function summarizeSection(items: VisibilityBearing[]): SectionVisibilitySummary {
  const byClearance: Record<Clearance, number> = {
    cleared_for_candidates: 0,
    recruiters_only: 0,
    restricted: 0,
  }
  let overrideCount = 0

  for (const item of items) {
    byClearance[item.visibility.clearance] += 1
    if (!item.visibility.isPresetDefault) overrideCount += 1
  }

  const present = CLEARANCE_ORDER.filter((a) => byClearance[a] > 0)
  const uniformClearance = present.length === 1 ? present[0] : null

  return {
    total: items.length,
    uniformClearance,
    byClearance,
    overrideCount,
    isMixed: present.length > 1,
  }
}

// ---------------------------------------------------------------------------
// Completeness
// ---------------------------------------------------------------------------

/**
 * An item counts toward candidate-safe completeness once it has been written and
 * published — staleness is a freshness problem reported separately, not an
 * emptiness problem. An escalate-marked item counts too: deciding a topic must
 * route to a recruiter is a completed decision, not a gap.
 */
export function isCleared(item: VisibilityBearing): boolean {
  return isPublishedCleared(item) || agentMustEscalate(item)
}

/** Percentage helper — returns a whole number, and 0 rather than NaN for an empty set. */
export function percent(done: number, total: number): number {
  if (total <= 0) return 0
  return Math.round((done / total) * 100)
}
