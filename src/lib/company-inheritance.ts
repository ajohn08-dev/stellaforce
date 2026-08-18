import { findQuestion, GLOBAL_QUESTIONS, type Question } from "@/lib/question-catalog"
import type { VisibilityBlock } from "@/lib/company-visibility"
import type { Company, CompanyJob, Team } from "@/lib/mock-companies"

/**
 * **One question. Many answers. The narrowest one wins.**
 *
 * The question is global (`question-catalog.ts`) — you write it once, ever.
 * Only *answers* carry a scope, which is what keeps this simple: nobody ever
 * files a question at a level, and *"Who would I report to?"* is never
 * duplicated four times.
 *
 * The ladder is the same cascade `src/lib/workflow-settings.ts` already resolves
 * for workflow settings (`global → client → workflow → job`, most-specific
 * wins), applied to knowledge:
 *
 *     global (catalog)  →  company  →  team … team  →  job
 *
 * Note there are **three entity types, not four levels**: `Team` nests in itself
 * via `parentTeamId`, so Go-to-Market → Channel Growth is two teams rather than
 * a department and a team. Depth is data. A customer with four org tiers needs
 * no schema change, and nobody has to decide at creation time whether the thing
 * they're making is a department or a team — a question they can't get right and
 * whose answer has no visible consequence.
 *
 * **Two rules, and they differ on purpose:**
 *
 *  1. *Answers override.* Nearest scope wins.
 *  2. *Prohibitions accumulate.* Every scope in the chain contributes, and
 *     nothing removes. A role may add "never mention the Newark closure"; no
 *     scope can drop "never guarantee sponsorship". If safety inherited like
 *     everything else, a job-level answer could quietly delete a constraint.
 *
 * Everything on screen and the agent compile call this module, so the badge
 * saying where an answer comes from and the answer the agent actually uses
 * cannot diverge.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ScopeKind = "company" | "team" | "job"

export type AnswerScope = { kind: ScopeKind; refId: string | null }

export const COMPANY_SCOPE: AnswerScope = { kind: "company", refId: null }

export type Answer = {
  id: string
  scope: AnswerScope
  /** What the agent says. Empty means this row isn't an answer yet. */
  body: string
  expandedAnswer: string | null
  escalationInstructions: string | null
  /** Added to — never replacing — the catalog's prohibitions and any wider scope's. */
  prohibitedClaims: string[]
  visibility: VisibilityBlock
}

/**
 * A catalog question as it stands at one company: how often candidates asked it
 * here, and the answers written for it at any scope.
 */
export type CompanyQuestion = {
  questionId: string
  askedCount: number
  lastAskedAt: string | null
  /** Set when we're waiting on the client for the answer. See COMPANY.md § D.6. */
  askedClientAt: string | null
  answers: Answer[]
}

/** A scope that applies to some context, with the words the UI shows for it. */
export type ResolvedScope = {
  kind: ScopeKind
  refId: string | null
  /** Short name for the answer stack: "Everywhere", "Channel Growth", the job title. */
  label: string
  /** Sentence form for a job's resolved view: "From company", "Set for this role". */
  badge: string
}

export type ResolvedAnswer = { answer: Answer; scope: ResolvedScope }

export type ResolveContext = { teamId?: string | null; jobId?: string | null }

// ---------------------------------------------------------------------------
// The scope tree
// ---------------------------------------------------------------------------

/** A team and its ancestors, nearest first. Cycle-safe. */
export function teamPath(company: Company, teamId: string | null | undefined): Team[] {
  const path: Team[] = []
  const seen = new Set<string>()
  let current = teamId ? company.teams.find((t) => t.id === teamId) : undefined

  while (current && !seen.has(current.id)) {
    seen.add(current.id)
    path.push(current)
    current = current.parentTeamId
      ? company.teams.find((t) => t.id === current!.parentTeamId)
      : undefined
  }
  return path
}

/** Direct children of a team, or the roots when `parentId` is null. */
export function childTeams(company: Company, parentId: string | null): Team[] {
  return company.teams.filter((t) => t.parentTeamId === parentId)
}

/**
 * Every scope that applies to a context, **narrowest first** — the order the
 * resolver walks and the reverse of the order the UI stacks them in.
 */
export function scopeChain(company: Company, ctx: ResolveContext = {}): ResolvedScope[] {
  const chain: ResolvedScope[] = []
  const job = ctx.jobId ? company.jobs.find((j) => j.id === ctx.jobId) : null

  if (job) {
    chain.push({
      kind: "job",
      refId: job.id,
      label: job.title,
      badge: "Set for this role",
    })
  }

  for (const team of teamPath(company, job?.teamId ?? ctx.teamId)) {
    chain.push({
      kind: "team",
      refId: team.id,
      label: team.name,
      badge: `From ${team.name}`,
    })
  }

  chain.push({
    kind: "company",
    refId: null,
    label: "Everywhere",
    badge: "From company",
  })
  return chain
}

/** Scopes a new answer could be written at, narrowest first. */
export function availableScopes(company: Company, ctx: ResolveContext = {}): ResolvedScope[] {
  if (ctx.jobId || ctx.teamId) return scopeChain(company, ctx)

  // Standing in the company workspace with no job in hand: every team and every
  // active job is a legal target, so the "answer differently" menu can offer
  // them with their consequences rather than making someone guess a level.
  return [
    ...company.jobs
      .filter((j) => j.status === "open" || j.status === "draft")
      .map((j) => ({
        kind: "job" as const,
        refId: j.id,
        label: j.title,
        badge: `Only for ${j.title}`,
      })),
    ...company.teams.map((t) => ({
      kind: "team" as const,
      refId: t.id,
      label: t.name,
      badge: `For everyone in ${t.name}`,
    })),
    { kind: "company", refId: null, label: "Everywhere", badge: "For every job here" },
  ]
}

/**
 * How many jobs a scope reaches — the consequence line on the "answer
 * differently" menu.
 *
 * Choosing a scope is the one genuinely consequential decision in this model,
 * and it's only answerable if you can see its blast radius at the moment you
 * choose. "For everyone in Go-to-Market — 3 jobs" is a decision; "department
 * level" is a guess.
 */
export function jobsInScope(company: Company, scope: AnswerScope): CompanyJob[] {
  switch (scope.kind) {
    case "job":
      return company.jobs.filter((j) => j.id === scope.refId)
    case "team":
      return company.jobs.filter((j) =>
        teamPath(company, j.teamId).some((t) => t.id === scope.refId)
      )
    case "company":
      return company.jobs
  }
}

// ---------------------------------------------------------------------------
// Resolution
// ---------------------------------------------------------------------------

function sameScope(a: AnswerScope, b: { kind: ScopeKind; refId: string | null }): boolean {
  return a.kind === b.kind && a.refId === b.refId
}

function isWritten(answer: Answer): boolean {
  return Boolean(answer.body.trim())
}

/**
 * The answer that wins for a context, and where it came from.
 *
 * `publishedOnly` is what the agent compile passes: an unpublished draft at a
 * narrow scope must not shadow a published answer at a wider one, or editing a
 * role would silently take the agent's answer away.
 */
export function resolveAnswer(
  company: Company,
  question: CompanyQuestion,
  ctx: ResolveContext = {},
  opts: { publishedOnly?: boolean } = {}
): ResolvedAnswer | null {
  for (const scope of scopeChain(company, ctx)) {
    const answer = question.answers.find(
      (a) =>
        sameScope(a.scope, scope) &&
        isWritten(a) &&
        (!opts.publishedOnly || a.visibility.state === "published")
    )
    if (answer) return { answer, scope }
  }
  return null
}

/**
 * Every answer written for a question, **widest first** — the reading order of
 * the stack on screen, where indentation carries the whole explanation and the
 * last row is the one that wins.
 */
export function answerStack(company: Company, question: CompanyQuestion): ResolvedAnswer[] {
  const order: ResolvedAnswer[] = []

  const companyAnswer = question.answers.find((a) => a.scope.kind === "company")
  if (companyAnswer) {
    order.push({
      answer: companyAnswer,
      scope: { kind: "company", refId: null, label: "Everywhere", badge: "From company" },
    })
  }

  // Teams by depth, so a nested team always reads below its parent.
  const teamAnswers = question.answers.filter((a) => a.scope.kind === "team")
  teamAnswers.sort(
    (a, b) => teamPath(company, a.scope.refId).length - teamPath(company, b.scope.refId).length
  )
  for (const answer of teamAnswers) {
    const team = company.teams.find((t) => t.id === answer.scope.refId)
    order.push({
      answer,
      scope: {
        kind: "team",
        refId: answer.scope.refId,
        label: team?.name ?? "Unknown team",
        badge: `From ${team?.name ?? "a team"}`,
      },
    })
  }

  for (const answer of question.answers.filter((a) => a.scope.kind === "job")) {
    const job = company.jobs.find((j) => j.id === answer.scope.refId)
    order.push({
      answer,
      scope: {
        kind: "job",
        refId: answer.scope.refId,
        label: job?.title ?? "Unknown role",
        badge: "Set for this role",
      },
    })
  }

  return order
}

/** Indent depth for a stack row — 0 for company, then one step per team hop. */
export function stackDepth(company: Company, scope: ResolvedScope): number {
  if (scope.kind === "company") return 0
  if (scope.kind === "team") return teamPath(company, scope.refId).length
  const job = company.jobs.find((j) => j.id === scope.refId)
  return teamPath(company, job?.teamId).length + 1
}

/**
 * Every constraint that applies, from the catalog and from every scope in the
 * chain — **unioned, never overridden** (rule 2). Deduped, because the same
 * sentence written globally and again at a company should appear once.
 */
export function effectiveProhibitions(
  company: Company,
  question: CompanyQuestion,
  catalogQuestion: Question | undefined,
  ctx: ResolveContext = {}
): string[] {
  const out = new Set<string>(catalogQuestion?.prohibitions ?? [])
  const chain = scopeChain(company, ctx)
  for (const answer of question.answers) {
    if (!chain.some((s) => sameScope(answer.scope, s))) continue
    for (const claim of answer.prohibitedClaims) out.add(claim)
  }
  return [...out]
}

// ---------------------------------------------------------------------------
// Unanswered
// ---------------------------------------------------------------------------

/**
 * **The catalog, projected onto one company.**
 *
 * Every global question plus the company's own, each carrying whatever answers
 * and activity that company has — and an empty row where it has none. Stored
 * rows only exist once a company has *something* to record, so this is what
 * makes a brand-new customer's Unanswered inbox the intake checklist on day one
 * rather than a blank page: the questions are already there, because they belong
 * to Stellaforce rather than to the company.
 *
 * The DB equivalent is a left join from the catalog, which is why nothing needs
 * seeding per customer.
 */
export function companyQuestions(company: Company): CompanyQuestion[] {
  const stored = new Map(company.questions.map((q) => [q.questionId, q]))
  const catalog = [...GLOBAL_QUESTIONS, ...company.customQuestions]

  const projected = catalog.map(
    (q) =>
      stored.get(q.id) ?? {
        questionId: q.id,
        askedCount: 0,
        lastAskedAt: null,
        askedClientAt: null,
        answers: [],
      }
  )

  // Never drop a stored row whose catalog entry has gone missing — that would
  // silently delete a written answer.
  const known = new Set(catalog.map((q) => q.id))
  return [...projected, ...company.questions.filter((q) => !known.has(q.questionId))]
}

/**
 * Unanswered means **no written answer at any scope** — not "no answer here".
 * A question answered only for one role is still unanswered for every other job
 * at that company, which is exactly what the inbox should be saying.
 */
export function isUnanswered(question: CompanyQuestion): boolean {
  return !question.answers.some(isWritten)
}

/**
 * The inbox: unanswered questions, most-asked first, then sensitive topics.
 *
 * The secondary sort is what makes a brand-new company useful rather than
 * daunting — nobody has asked it anything yet, so `askedCount` is 0 across the
 * board and the risky topics float to the top of the intake list.
 */
export function unansweredQuestions(company: Company): CompanyQuestion[] {
  return companyQuestions(company)
    .filter(isUnanswered)
    .sort((a, b) => {
      if (b.askedCount !== a.askedCount) return b.askedCount - a.askedCount
      const aq = findQuestion(a.questionId, company.customQuestions)
      const bq = findQuestion(b.questionId, company.customQuestions)
      return Number(bq?.sensitive ?? false) - Number(aq?.sensitive ?? false)
    })
}

/** The catalog entry for a company question, global or company-specific. */
export function questionOf(
  company: Company,
  question: CompanyQuestion
): Question | undefined {
  return findQuestion(question.questionId, company.customQuestions)
}

/**
 * Every written answer at a company, with the question it answers.
 *
 * The visibility block moved from the question to the **answer**, which is where
 * it belonged all along: clearance, verification, and review cadence describe a
 * claim, and only an answer makes one. Sweeps that used to walk `company.faq`
 * walk this instead.
 */
export function allAnswers(company: Company): {
  answer: Answer
  question: CompanyQuestion
  catalog: Question | undefined
}[] {
  return company.questions.flatMap((question) =>
    question.answers.filter(isWritten).map((answer) => ({
      answer,
      question,
      catalog: questionOf(company, question),
    }))
  )
}

/**
 * Every written answer belonging to a set of questions — for the section-wide
 * visibility bar, which acts on answers because answers are what carry a
 * visibility block.
 */
export function questionAnswers(
  company: Company,
  questions: CompanyQuestion[]
): Answer[] {
  const ids = new Set(questions.map((q) => q.questionId))
  return allAnswers(company)
    .filter(({ question }) => ids.has(question.questionId))
    .map(({ answer }) => answer)
}

/** The company-wide answer to a question, if one has been written. */
export function companyAnswer(
  company: Company,
  questionId: string
): Answer | undefined {
  return company.questions
    .find((q) => q.questionId === questionId)
    ?.answers.find((a) => a.scope.kind === "company" && isWritten(a))
}
