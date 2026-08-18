import {
  agentCanUse,
  agentMustEscalate,
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

/**
 * The compile step — COMPANY.md § E.
 *
 * A candidate-facing agent never queries the knowledge base directly. This
 * function produces the frozen bundle it receives, which makes the agent's
 * knowledge reviewable before deployment and reproducible afterward.
 *
 * The filter is `agentCanUse()` and nothing else. Internal and restricted items
 * are dropped here and have no other pathway in — there is no summarization
 * channel and no "context for reasoning only" back door. Escalate-marked items
 * contribute their *topic and handoff instruction*, never their body, so the
 * agent knows a subject requires a recruiter without learning the answer.
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
  department: 2,
  company: 3,
}

function sortByPrecedence<T extends { level: KnowledgeLevel }>(items: T[]): T[] {
  return [...items].sort((a, b) => LEVEL_RANK[a.level] - LEVEL_RANK[b.level])
}

export function compileAgentContext(
  company: Company,
  job?: CompanyJob | null
): CompiledAgentContext {
  const department = job?.departmentId
    ? company.departments.find((d) => d.id === job.departmentId)
    : null
  const team = job?.teamId ? allTeams(company).find((t) => t.id === job.teamId) : null

  // --- 1. Narrative blocks -------------------------------------------------
  const blocks: ContextBlock[] = narrativeItems(company)
    .filter((k) => k.body.trim() && agentCanUse(k))
    .map((k) => ({
      id: k.id,
      level: k.level,
      sourceName: company.preferredName,
      heading: k.title,
      body: k.body,
    }))

  if (department && agentCanUse(department) && department.candidateFacingDescription) {
    blocks.push({
      id: department.id,
      level: "department",
      sourceName: department.name,
      heading: `About ${department.name}`,
      body: department.candidateFacingDescription,
    })
  }

  if (team && agentCanUse(team)) {
    if (team.dayInTheLife) {
      blocks.push({
        id: `${team.id}-day`,
        level: "team",
        sourceName: team.name,
        heading: `A typical week on ${team.name}`,
        body: team.dayInTheLife,
      })
    }
    if (team.workingStyle) {
      blocks.push({
        id: `${team.id}-style`,
        level: "team",
        sourceName: team.name,
        heading: `How ${team.name} works`,
        body: team.workingStyle,
      })
    }
  }

  const hiringManager = team?.hiringManagerId
    ? company.stakeholders.find((s) => s.id === team.hiringManagerId)
    : null
  if (hiringManager && agentCanUse(hiringManager) && hiringManager.candidateFacingBio) {
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

  // --- 3. FAQ answers ------------------------------------------------------
  const scopedFaq = company.faq.filter((f) => {
    if (f.level === "company") return true
    if (f.level === "department") return f.levelRefId === department?.id
    if (f.level === "team") return f.levelRefId === team?.id
    return f.levelRefId === job?.id
  })

  const answers: ContextAnswer[] = sortByPrecedence(
    scopedFaq.filter(agentCanUse)
  ).map((f) => ({
    id: f.id,
    level: f.level,
    question: f.questionIntent,
    variants: f.questionVariants,
    answer: f.approvedAnswer,
    expanded: f.expandedAnswer,
  }))

  // --- 4. Policies ---------------------------------------------------------
  const policies = company.policies
    .filter((p) => agentCanUse(p) && p.candidateFacingText)
    .map((p) => ({ id: p.id, label: p.label, text: p.candidateFacingText! }))

  // --- 5. Escalation rules — topic and instruction only, never the body ----
  const escalations: ContextEscalation[] = [
    ...scopedFaq.filter(agentMustEscalate).map((f) => ({
      id: f.id,
      topic: f.questionIntent,
      instruction:
        f.escalationInstructions ??
        "Hand this topic to the recruiter instead of answering.",
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
    ...scopedFaq
      .filter((f) => agentCanUse(f) && f.escalationInstructions)
      .map((f) => ({
        id: `${f.id}-followup`,
        topic: `${f.questionIntent} (follow-up)`,
        instruction: f.escalationInstructions!,
      })),
  ]

  // --- 6. Prohibited claims — the union, plus the standing set -------------
  const prohibitedClaims = Array.from(
    new Set([...scopedFaq.flatMap((f) => f.prohibitedClaims), ...STANDING_PROHIBITIONS])
  )

  // --- 7. Excluded counts, for the recruiter's benefit ---------------------
  const everything: (VisibilityBearing & { id: string })[] = [
    ...company.knowledge,
    ...company.policies,
    ...company.faq,
    ...company.departments,
    ...allTeams(company),
    ...company.stakeholders,
  ]

  return {
    companyName: company.preferredName,
    jobTitle: job?.title ?? null,
    blocks: sortByPrecedence(blocks),
    answers,
    policies,
    escalations,
    fallback: UNKNOWN_FALLBACK,
    prohibitedClaims,
    excluded: {
      internal: everything.filter((i) => i.visibility.clearance === "recruiters_only").length,
      restricted: everything.filter((i) => i.visibility.clearance === "restricted").length,
      unpublished: everything.filter(
        (i) =>
          i.visibility.clearance === "cleared_for_candidates" &&
          i.visibility.state !== "published"
      ).length,
    },
  }
}
