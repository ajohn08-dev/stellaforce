/**
 * **What the agent says when it can't answer.**
 *
 * There used to be exactly one sentence for this — *"I don't have a confirmed
 * answer for this role"* — used for every situation, which made the agent
 * sound evasive in the cases where it mattered most. That sentence is true when
 * nobody has written the answer yet. It is a lie when we know the salary band
 * perfectly well and won't quote it, and it's cold when the candidate isn't
 * asking a question at all but saying they're worried.
 *
 * So there are **four**, by *why* the agent can't answer:
 *
 *  - `unknown` — nobody has confirmed it yet. Don't guess, promise a follow-up.
 *  - `withheld` — we know, and it isn't the agent's to share. Decline warmly and
 *    hand it to a person. This is the one that pairs with every prohibition:
 *    a "never say X" without a "say this instead" leaves the agent improvising
 *    at exactly the moment it must not.
 *  - `out_of_scope` — not something we discuss at all. Decline and offer what we
 *    *can* help with, so the conversation has somewhere to go.
 *  - `reassure` — not a question, a worry. Acknowledge it and give the next
 *    concrete step.
 *
 * **Four, and deliberately not per section or per question.** A fallback per
 * topic is a hundred sentences nobody maintains and an agent whose voice changes
 * depending on what it was asked. These are how it speaks when it can't answer —
 * a property of the agent, not of a benefit or a policy.
 *
 * They cascade `global → company` and no further. A company may reword them to
 * fit its voice; a team or a role may not, because an agent that declines
 * differently on two roles at the same company reads as two different companies.
 */

export type FallbackKind = "unknown" | "withheld" | "out_of_scope" | "reassure"

export type FallbackDef = {
  kind: FallbackKind
  /** What a recruiter calls it. */
  label: string
  /** When the agent reaches for it — the trigger, in plain words. */
  when: string
  /** What it says. Editable per company. */
  text: string
}

export const FALLBACK_ORDER: FallbackKind[] = [
  "unknown",
  "withheld",
  "out_of_scope",
  "reassure",
]

/**
 * Stellaforce-wide defaults. Every company starts with these, so a customer
 * nobody has configured still declines like a person rather than a form.
 */
export const GLOBAL_FALLBACKS: Record<FallbackKind, FallbackDef> = {
  unknown: {
    kind: "unknown",
    label: "We haven't confirmed that yet",
    when: "No approved answer exists at any level for the question asked.",
    text: "I don't have a confirmed answer for that one, and I'd rather not guess at something you might make a decision on. I'll flag it for the recruiting team so you get a proper answer.",
  },
  withheld: {
    kind: "withheld",
    label: "We know, but it's not mine to share",
    when: "The topic is marked escalate, or a standing rule forbids the specific claim — compensation figures, sponsorship outcomes, anything the agent must never state.",
    text: "That's one I'll leave to the recruiter rather than get wrong — they can talk it through with you properly. I'll make sure they know you asked.",
  },
  out_of_scope: {
    kind: "out_of_scope",
    label: "Not something we discuss",
    when: "The question is about other candidates, personal characteristics, or anything outside the role and the company.",
    text: "That's not something I can get into, I'm afraid. Happy to keep going on the role itself, though — anything else you'd like to know about it?",
  },
  reassure: {
    kind: "reassure",
    label: "The candidate is worried, not asking",
    when: "The candidate expresses anxiety about timing, competition, or their chances rather than asking for a fact.",
    text: "That's a fair thing to be thinking about. What I can tell you is where things stand right now and what happens next — and anything the team needs to confirm, I'll pass straight on.",
  },
}

/** A company's rewording of any of them. Absent means "use the global". */
export type CompanyFallbacks = Partial<Record<FallbackKind, string>>

/**
 * The wording that applies at one company — global defaults with the company's
 * overrides on top. Same cascade shape as everything else, one level shorter.
 */
export function resolveFallbacks(
  overrides: CompanyFallbacks | undefined
): FallbackDef[] {
  return FALLBACK_ORDER.map((kind) => {
    const base = GLOBAL_FALLBACKS[kind]
    const text = overrides?.[kind]?.trim()
    return text ? { ...base, text } : base
  })
}

/** True when a company has reworded this one — for the "customised" marker. */
export function isCustomised(
  kind: FallbackKind,
  overrides: CompanyFallbacks | undefined
): boolean {
  const text = overrides?.[kind]?.trim()
  return Boolean(text && text !== GLOBAL_FALLBACKS[kind].text)
}
