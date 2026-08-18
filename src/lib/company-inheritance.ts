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
  /**
   * Set when this answer was synthesised from a field the recruiter already
   * filled in on the job — "this role's reporting line". Never stored; see
   * `derivedAnswers`.
   */
  derivedFrom?: string
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

/**
 * Scopes a new answer could be written at, narrowest first.
 *
 * `question` narrows the list: a job-only question (`answerableAt: "job"`) never
 * offers a company or team scope, because there is no truthful answer at those
 * levels and an empty box is an invitation to invent one.
 */
export function availableScopes(
  company: Company,
  ctx: ResolveContext = {},
  question?: Question
): ResolvedScope[] {
  const jobOnly = question?.answerableAt === "job"

  if (ctx.jobId || ctx.teamId) {
    const chain = scopeChain(company, ctx)
    return jobOnly ? chain.filter((s) => s.kind === "job") : chain
  }

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
    ...(jobOnly
      ? []
      : [
          ...company.teams.map((t) => ({
            kind: "team" as const,
            refId: t.id,
            label: t.name,
            badge: `For everyone in ${t.name}`,
          })),
          {
            kind: "company" as const,
            refId: null,
            label: "Everywhere",
            badge: "For every job here",
          },
        ]),
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
// Derived answers
// ---------------------------------------------------------------------------

/**
 * **Answers the recruiter already wrote, without knowing they were writing
 * them.**
 *
 * A job's reporting line, travel, location and pipeline are typed into the job
 * itself — and they are also, word for word, the answers to four catalog
 * questions. Asking someone to type the reporting line in the wizard and then
 * write "Who would I report to?" separately guarantees two things: they won't,
 * and if they do, the two will disagree within a month.
 *
 * So these are **derived, never stored**: synthesised at job scope, marked with
 * where they came from, and beaten by any answer a recruiter actually writes for
 * that job. Change the field, the answer changes with it.
 *
 * The interview process is the important one. The company section holds prose
 * ("three stages: a recruiter screen, an on-site…") while the job holds the
 * stages it will genuinely run. Nothing reconciled them, so an agent could
 * confidently describe a process the pipeline doesn't perform — the kind of
 * error a candidate discovers, not a recruiter. Deriving it means the sentence
 * can't be wrong.
 */
export function derivedAnswers(company: Company, job: CompanyJob): Answer[] {
  const scope: AnswerScope = { kind: "job", refId: job.id }

  const derive = (
    questionId: string,
    body: string | null,
    derivedFrom: string
  ): (Answer & { questionId: string }) | null => {
    if (!body?.trim()) return null
    return {
      id: `derived-${job.id}-${questionId}`,
      questionId,
      scope,
      body,
      expandedAnswer: null,
      escalationInstructions: null,
      prohibitedClaims: [],
      derivedFrom,
      // Derived answers are as published as the field they mirror: the recruiter
      // already committed to it on the job. Marking them draft would hide them
      // from the very agent that needs them.
      visibility: {
        clearance: "cleared_for_candidates",
        agentUse: "on_request",
        state: "published",
        source: `Derived from ${derivedFrom}`,
        verification: "verified",
        lastVerifiedAt: null,
        verifiedBy: null,
        owner: "",
        reviewCadenceDays: null,
        nextReviewAt: null,
        isPresetDefault: true,
      },
    }
  }

  // Phrased as sentences, not pasted as field values. `reportsTo` holds "VP of
  // Channel Growth"; an agent that answers "Who would I report to?" with that
  // bare fragment sounds like a form, and the recruiter has no way to tell from
  // the field alone that it will be spoken aloud.
  return [
    derive(
      "q-reporting-line",
      job.reportsTo ? `You'd report to the ${job.reportsTo}.` : null,
      "this role's reporting line"
    ),
    derive(
      "q-travel",
      job.travel ? `Travel runs about ${job.travel} for this role.` : null,
      "this role's travel requirement"
    ),
    derive(
      "q-remote",
      job.location ? `For this role: ${job.location}.` : null,
      "this role's location"
    ),
    derive("q-typical-week", job.typicalWeek, "this role's typical week"),
    derive("q-why-role-open", job.rolePurpose, "why this role exists"),
    derive(
      "q-interview-process",
      job.interviewStages.length > 0
        ? `${job.interviewStages.length} stages: ${job.interviewStages.join(", ")}.`
        : null,
      "this role's pipeline"
    ),
  ].filter(Boolean) as Answer[]
}

/**
 * A question with its derived job answers folded in — what every surface
 * standing on a job should resolve against.
 *
 * A written job-scoped answer always beats the derived one: deriving is a
 * default, not a lock. Nothing else in the chain is touched.
 */
export function withDerived(
  company: Company,
  question: CompanyQuestion,
  job: CompanyJob | null | undefined
): CompanyQuestion {
  if (!job) return question

  const hasWrittenJobAnswer = question.answers.some(
    (a) => a.scope.kind === "job" && a.scope.refId === job.id && isWritten(a)
  )
  if (hasWrittenJobAnswer) return question

  const derived = derivedAnswers(company, job).filter(
    (a) => (a as Answer & { questionId?: string }).questionId === question.questionId
  )
  if (derived.length === 0) return question

  return { ...question, answers: [...question.answers, ...derived] }
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

/** True when a question applies to a given role at all. */
export function appliesToJob(question: Question, job: CompanyJob): boolean {
  return !question.onlyForJobId || question.onlyForJobId === job.id
}

/** Roles a question can still be unanswered *for*. Active jobs only — a closed req isn't work. */
export function activeJobs(company: Company): CompanyJob[] {
  return company.jobs.filter((j) => j.status === "open" || j.status === "draft")
}

export type UnansweredItem = {
  question: CompanyQuestion
  /** Set for job-only questions: which role is still missing an answer. */
  job: CompanyJob | null
}

/**
 * **The inbox, counted the way the work actually divides.**
 *
 * A company-answerable question is one item: answer it once and every role is
 * covered. A job-only question is one item *per active role*, because answering
 * "how long will this take?" for the Central AE says nothing about the Data
 * Engineer — and a single row claiming otherwise is how a recruiter ticks
 * something off and leaves two roles uncovered.
 *
 * Closed and filled roles are excluded everywhere: nothing is screening for
 * them, so their gaps aren't work.
 */
export function unansweredItems(company: Company): UnansweredItem[] {
  const items: UnansweredItem[] = []

  for (const question of companyQuestions(company)) {
    const catalog = questionOf(company, question)

    if (catalog?.answerableAt === "job") {
      for (const job of activeJobs(company)) {
        if (!appliesToJob(catalog, job)) continue
        const withJobFields = withDerived(company, question, job)
        if (!resolveAnswer(company, withJobFields, { jobId: job.id })) {
          items.push({ question, job })
        }
      }
      continue
    }

    if (isUnanswered(question)) items.push({ question, job: null })
  }

  return items.sort((a, b) => {
    if (b.question.askedCount !== a.question.askedCount)
      return b.question.askedCount - a.question.askedCount
    const aq = questionOf(company, a.question)
    const bq = questionOf(company, b.question)
    return Number(bq?.sensitive ?? false) - Number(aq?.sensitive ?? false)
  })
}

/**
 * Company-answerable questions with no answer anywhere.
 *
 * `unansweredItems` is what the inbox renders — it also splits job-only
 * questions per role. This one stays for counts that are genuinely company-wide.
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
