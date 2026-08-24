import {
  companyQuestions,
  effectiveProhibitions,
  questionOf,
  resolveAnswer,
  withDerived,
  type ResolvedAnswer,
} from "@/lib/company-inheritance"
import { agentCanUse, type AgentAudience } from "@/lib/company-visibility"
import { resolveFallbacks, type FallbackDef } from "@/lib/fallbacks"
import type { Question } from "@/lib/question-catalog"
import type { Company } from "@/lib/mock-companies"

/**
 * **What a candidate would actually hear, right now.**
 *
 * The knowledge base is otherwise entirely *asserted*: the cascade, the audience
 * split, the four fallbacks and the prohibitions are all described on screen and
 * none of them can be observed. This answers a typed question the way the agent
 * would, so the model can be watched instead of believed.
 *
 * **It is deliberately published-only.** `resolveAnswer(..., { publishedOnly:
 * true })`, and nothing here reads the draft buffer. A preview that included
 * unpublished edits would answer the question *"what will candidates hear after I
 * publish?"* — useful, but not the one people actually have, which is **"what are
 * candidates being told right now?"** Those diverge precisely when it matters:
 * mid-edit, when you're least sure what's live. The panel says which one it's
 * showing and how many changes are excluded.
 *
 * ## The matching is a stub, and says so
 *
 * Intent matching here is token overlap against the question's `intent`, its
 * catalog `variants`, and the company's `extraVariants`. A real deployment
 * retrieves over embeddings. What this *does* faithfully reproduce is everything
 * downstream of the match — which scope wins, whether the audience is cleared for
 * it, which fallback fires and why, and which prohibitions apply — because it
 * calls the same functions the compile does.
 */

const STOPWORDS = new Set([
  "a", "an", "the", "is", "are", "do", "does", "did", "you", "your", "i", "me",
  "my", "we", "what", "whats", "how", "when", "who", "will", "would", "can",
  "could", "there", "this", "that", "it", "of", "to", "for", "in", "on", "at",
  "be", "have", "has", "any", "much", "many", "like", "and", "or", "if", "with",
])

function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t))
}

function score(asked: string[], candidate: string): number {
  const set = new Set(tokens(candidate))
  if (set.size === 0) return 0
  const hits = asked.filter((t) => set.has(t)).length
  // Normalised by the shorter side so a long answer phrasing doesn't dilute a
  // short, exact question.
  return hits / Math.max(1, Math.min(asked.length, set.size))
}

export type PreviewReason =
  | "answered"
  | "escalated"
  | "unanswered"
  | "no_match"
  | "withheld_from_audience"

export type PreviewTurn = {
  id: string
  asked: string
  matched: Question | null
  resolved: ResolvedAnswer | null
  reason: PreviewReason
  /** What the agent says — either the answer body or the fallback wording. */
  says: string
  fallback: FallbackDef | null
  prohibitions: string[]
}

const MATCH_THRESHOLD = 0.34

export function previewAsk(
  company: Company,
  asked: string,
  ctx: { jobId?: string | null; audience: AgentAudience },
  id: string
): PreviewTurn {
  const askedTokens = tokens(asked)
  const fallbacks = resolveFallbacks(company.fallbacks)
  const fallbackFor = (kind: FallbackDef["kind"]) =>
    fallbacks.find((f) => f.kind === kind)!

  const job = ctx.jobId ? company.jobs.find((j) => j.id === ctx.jobId) ?? null : null

  let best: { question: Question; entry: ReturnType<typeof withDerived>; s: number } | null =
    null

  for (const raw of companyQuestions(company)) {
    const catalog = questionOf(company, raw)
    if (!catalog) continue
    if (catalog.onlyForJobId && catalog.onlyForJobId !== job?.id) continue

    const phrasings = [catalog.intent, ...catalog.variants, ...(raw.extraVariants ?? [])]
    const s = Math.max(...phrasings.map((p) => score(askedTokens, p)))
    if (s > (best?.s ?? 0)) best = { question: catalog, entry: withDerived(company, raw, job), s }
  }

  if (!best || best.s < MATCH_THRESHOLD) {
    const fb = fallbackFor("unknown")
    return {
      id,
      asked,
      matched: null,
      resolved: null,
      reason: "no_match",
      says: fb.text,
      fallback: fb,
      prohibitions: [],
    }
  }

  const { question, entry } = best
  const prohibitions = effectiveProhibitions(company, entry, question, {
    jobId: job?.id,
  })

  const resolved = resolveAnswer(
    company,
    entry,
    { jobId: job?.id },
    { publishedOnly: true }
  )

  if (!resolved) {
    // A sensitive topic with no approved answer isn't "we don't know" — the
    // catalog already decided it routes to a person. Same rule the compile uses.
    const fb = fallbackFor(question.sensitive ? "withheld" : "unknown")
    return {
      id,
      asked,
      matched: question,
      resolved: null,
      reason: "unanswered",
      says: fb.text,
      fallback: fb,
      prohibitions,
    }
  }

  if (!agentCanUse(resolved.answer, ctx.audience)) {
    // An answer exists and this audience isn't cleared for it. That is exactly
    // "we know, and it isn't mine to share" — not "we haven't confirmed that",
    // which would be a lie the candidate could later catch us in.
    const fb = fallbackFor("withheld")
    return {
      id,
      asked,
      matched: question,
      resolved,
      reason:
        resolved.answer.visibility.agentUse === "escalate"
          ? "escalated"
          : "withheld_from_audience",
      says: fb.text,
      fallback: fb,
      prohibitions,
    }
  }

  return {
    id,
    asked,
    matched: question,
    resolved,
    reason: "answered",
    says: resolved.answer.body,
    fallback: null,
    prohibitions,
  }
}

/**
 * Four questions that between them exercise every path — answered at the role,
 * answered at the company, a sensitive topic with no answer, and something
 * nobody has been asked.
 *
 * Generated from the company's own data rather than hardcoded, so the panel
 * opens with prompts that are actually interesting for *this* company instead of
 * a generic list that mostly returns "no match".
 */
export function previewSuggestions(
  company: Company,
  jobId?: string | null
): string[] {
  const job = jobId ? company.jobs.find((j) => j.id === jobId) ?? null : null
  const out: string[] = []

  const rows = companyQuestions(company).map((raw) => ({
    catalog: questionOf(company, raw),
    entry: withDerived(company, raw, job),
  }))

  const atScope = (kind: "job" | "team" | "company") =>
    rows.find(({ catalog, entry }) => {
      if (!catalog || catalog.onlyForJobId) return false
      const hit = resolveAnswer(company, entry, { jobId: job?.id }, { publishedOnly: true })
      return hit?.scope.kind === kind && !out.includes(catalog.intent)
    })?.catalog?.intent

  const unanswered = rows.find(({ catalog, entry }) => {
    if (!catalog?.sensitive) return false
    return !resolveAnswer(company, entry, { jobId: job?.id }, { publishedOnly: true })
  })?.catalog?.intent

  for (const candidate of [atScope("job"), atScope("team"), atScope("company"), unanswered])
    if (candidate) out.push(candidate)

  out.push("Who else is interviewing for this?")
  return out.slice(0, 4)
}
