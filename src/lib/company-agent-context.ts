import {
  agentCanUse,
  agentMustEscalate,
  type AgentAudience,
  type VisibilityBearing,
} from "@/lib/company-visibility"
import {
  allTeams,
  narrativeItems,
  STANDING_PROHIBITIONS,
  UNKNOWN_FALLBACK,
  type Company,
  type CompanyJob,
  type KnowledgeLevel,
} from "@/lib/mock-companies"
import {
  allAnswers,
  companyQuestions,
  effectiveProhibitions,
  questionOf,
  resolveAnswer,
  teamPath,
  withDerived,
} from "@/lib/company-inheritance"

/**
 * The compile step — COMPANY.md § E.
 *
 * An agent never queries the knowledge base directly. This function produces the
 * frozen bundle it receives, which makes the agent's knowledge reviewable before
 * it runs and reproducible afterward.
 *
 * **It compiles per audience.** The same company and job produce a different
 * bundle for a candidate-facing screening agent than for an agent working
 * alongside a recruiter, and the *only* thing that differs is the
 * `agentCanUse(item, audience)` gate — there is no second code path, no
 * summarization channel, and no "context for reasoning only" back door.
 * Restricted items are dropped for both.
 *
 * Escalate-marked items contribute their *topic and handoff instruction*, never
 * their body, to a candidate bundle — the agent knows a subject requires a
 * recruiter without learning the answer. An internal bundle carries them in
 * full, because "don't answer this to a candidate" says nothing about what your
 * own assistant may know.
 */

export type ContextBlock = {
  id: string
  level: KnowledgeLevel
  sourceName: string
  heading: string
  body: string
}

export type ContextAnswer = {
  id: string
  level: KnowledgeLevel
  question: string
  variants: string[]
  answer: string
  expanded: string | null
}

export type ContextEscalation = {
  id: string
  topic: string
  instruction: string
}

export type CompiledAgentContext = {
  audience: AgentAudience
  companyName: string
  jobTitle: string | null
  blocks: ContextBlock[]
  answers: ContextAnswer[]
  policies: { id: string; label: string; text: string }[]
  escalations: ContextEscalation[]
  fallback: string
  prohibitedClaims: string[]
  excluded: { internal: number; restricted: number; unpublished: number }
}

/** Precedence, highest first. Used to sort and to resolve duplicate fact keys. */
const LEVEL_RANK: Record<KnowledgeLevel, number> = {
  job: 0,
  team: 1,
  company: 2,
}

function sortByPrecedence<T extends { level: KnowledgeLevel }>(items: T[]): T[] {
  return [...items].sort((a, b) => LEVEL_RANK[a.level] - LEVEL_RANK[b.level])
}

export function compileAgentContext(
  company: Company,
  job?: CompanyJob | null,
  audience: AgentAudience = "candidate"
): CompiledAgentContext {
  const usable = (item: Parameters<typeof agentCanUse>[0]) => agentCanUse(item, audience)

  // Every team from the job's own up to the root — Channel Growth *and*
  // Go-to-Market, nearest first. What used to be "the department and the team"
  // is now however many hops the org actually has.
  const teams = teamPath(company, job?.teamId)
  const team = teams[0] ?? null

  // --- 1. Narrative blocks -------------------------------------------------
  // An internal bundle includes the recruiter brief; a candidate one can't, and
  // the gate below already enforces that — the brief's clearance is
  // recruiters_only. Selecting the wider set here and letting `usable()` decide
  // keeps one filter rather than two lists that could disagree.
  const sourceBlocks =
    audience === "internal" ? company.knowledge : narrativeItems(company)

  const blocks: ContextBlock[] = sourceBlocks
    .filter((k) => k.body.trim() && usable(k))
    .map((k) => ({
      id: k.id,
      level: k.level,
      sourceName: company.preferredName,
      heading: k.title,
      body: k.body,
    }))

  for (const t of teams) {
    if (!usable(t)) continue
    if (t.description) {
      blocks.push({
        id: `${t.id}-about`,
        level: "team",
        sourceName: t.name,
        heading: `About ${t.name}`,
        body: t.description,
      })
    }
    if (t.dayInTheLife) {
      blocks.push({
        id: `${t.id}-day`,
        level: "team",
        sourceName: t.name,
        heading: `A typical week on ${t.name}`,
        body: t.dayInTheLife,
      })
    }
    if (t.workingStyle) {
      blocks.push({
        id: `${t.id}-style`,
        level: "team",
        sourceName: t.name,
        heading: `How ${t.name} works`,
        body: t.workingStyle,
      })
    }
  }

  const hiringManager = team?.leaderId
    ? company.stakeholders.find((s) => s.id === team.leaderId)
    : null
  if (hiringManager && usable(hiringManager) && hiringManager.candidateFacingBio) {
    blocks.push({
      id: hiringManager.id,
      level: "team",
      sourceName: hiringManager.name,
      heading: `${hiringManager.name}, ${hiringManager.title}`,
      body: hiringManager.candidateFacingBio,
    })
  }

  // --- 2. Role-level context ----------------------------------------------
  if (job) {
    if (job.rolePurpose) {
      blocks.push({
        id: `${job.id}-purpose`,
        level: "job",
        sourceName: job.title,
        heading: "Why this role exists",
        body: job.rolePurpose,
      })
    }
    if (job.typicalWeek) {
      blocks.push({
        id: `${job.id}-week`,
        level: "job",
        sourceName: job.title,
        heading: "A typical week in this role",
        body: job.typicalWeek,
      })
    }
  }

  // --- 3. Answers, resolved per job ---------------------------------------
  // The compile is where the cascade actually pays: every question is resolved
  // once for this job, so the agent receives one answer per question with no
  // notion of scope at all. `publishedOnly` stops an unpublished draft at a
  // narrow scope from shadowing a published answer at a wider one — editing a
  // role must never silently take the agent's answer away.
  const resolved = companyQuestions(company).map((raw) => {
    // Fold in the answers derived from this job's own fields before resolving,
    // so the agent describes the pipeline the job will actually run rather than
    // company prose written months ago.
    const q = withDerived(company, raw, job)
    return {
      q,
      catalog: questionOf(company, q),
      hit: resolveAnswer(company, q, { jobId: job?.id }, { publishedOnly: true }),
    }
  })

  const answers: ContextAnswer[] = sortByPrecedence(
    resolved
      .filter((r) => r.hit && usable(r.hit.answer))
      .map((r) => ({
        id: r.hit!.answer.id,
        level: r.hit!.scope.kind,
        question: r.catalog?.intent ?? r.q.questionId,
        variants: r.catalog?.variants ?? [],
        answer: r.hit!.answer.body,
        expanded: r.hit!.answer.expandedAnswer,
      }))
  )

  // --- 4. Policies ---------------------------------------------------------
  const policies = company.policies
    .filter((p) => usable(p) && p.candidateFacingText)
    .map((p) => ({ id: p.id, label: p.label, text: p.candidateFacingText! }))

  // --- 5. Escalation rules — topic and instruction only, never the body ----
  const escalations: ContextEscalation[] = [
    ...resolved
      .filter((r) => r.hit && agentMustEscalate(r.hit.answer))
      .map((r) => ({
        id: r.hit!.answer.id,
        topic: r.catalog?.intent ?? r.q.questionId,
        instruction:
          r.hit!.answer.escalationInstructions ??
          "Hand this topic to the recruiter instead of answering.",
      })),
    // A sensitive catalog question nobody has answered yet becomes an explicit
    // escalation rather than silence. This is the catalog's whole promise: a
    // company that has configured nothing is still safe on immigration and pay,
    // because the *question* arrived carrying that posture.
    ...resolved
      .filter((r) => !r.hit && r.catalog?.sensitive)
      .map((r) => ({
        id: `${r.q.questionId}-unanswered`,
        topic: r.catalog!.intent,
        instruction:
          "No approved answer for this company. Use the fallback and route the candidate to the recruiter.",
      })),
    ...company.policies.filter(agentMustEscalate).map((p) => ({
      id: p.id,
      topic: p.label,
      instruction:
        p.immigrationValue === "unknown"
          ? "No confirmed policy. Use the fallback and route the candidate to the recruiter."
          : "Hand this topic to the recruiter instead of answering.",
    })),
    // An answered FAQ can still carry escalation instructions for follow-ups.
    ...resolved
      .filter((r) => r.hit && usable(r.hit.answer) && r.hit.answer.escalationInstructions)
      .map((r) => ({
        id: `${r.hit!.answer.id}-followup`,
        topic: `${r.catalog?.intent ?? r.q.questionId} (follow-up)`,
        instruction: r.hit!.answer.escalationInstructions!,
      })),
  ]

  // --- 6. Prohibited claims — the union, plus the standing set -------------
  // Rule 2: prohibitions accumulate. Every scope in the chain contributes and
  // nothing removes — including the catalog's, which is why a company that has
  // written no compensation answer still can't have an agent quote a figure.
  const prohibitedClaims = Array.from(
    new Set([
      ...companyQuestions(company).flatMap((q) =>
        effectiveProhibitions(company, q, questionOf(company, q), { jobId: job?.id })
      ),
      ...STANDING_PROHIBITIONS,
    ])
  )

  // --- 7. Excluded counts, for the recruiter's benefit ---------------------
  const everything: (VisibilityBearing & { id: string })[] = [
    ...company.knowledge,
    ...company.policies,
    ...allAnswers(company).map((a) => a.answer),
    ...allTeams(company),
    ...company.stakeholders,
  ]

  return {
    audience,
    companyName: company.preferredName,
    jobTitle: job?.title ?? null,
    blocks: sortByPrecedence(blocks),
    answers,
    policies,
    escalations,
    fallback: UNKNOWN_FALLBACK,
    prohibitedClaims,
    excluded: {
      // Counted against *this* audience: an internal bundle isn't missing the
      // recruiters-only items, it contains them, and reporting them as withheld
      // is the sort of stale caption that makes people stop trusting a screen.
      internal:
        audience === "internal"
          ? 0
          : everything.filter((i) => i.visibility.clearance === "recruiters_only").length,
      restricted: everything.filter((i) => i.visibility.clearance === "restricted").length,
      unpublished: everything.filter(
        (i) =>
          i.visibility.clearance === "cleared_for_candidates" &&
          i.visibility.state !== "published"
      ).length,
    },
  }
}
