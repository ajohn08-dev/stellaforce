import {
  agentCanUse,
  agentMustEscalate,
  isCleared,
  isPublishedCleared,
  isStale,
  percent,
  staleState,
  type VisibilityBearing,
} from "@/lib/company-visibility"
import {
  allTeams,
  briefItems,
  narrativeItems,
  type Company,
  type CompanyJob,
  type KnowledgeItem,
  type FaqCategory,
  type KnowledgeKind,
  type PolicyGroup,
} from "@/lib/mock-companies"
import {
  allAnswers,
  appliesToJob,
  companyQuestions,
  isUnanswered,
  questionOf,
  resolveAnswer,
  withDerived,
  unansweredItems,
  type CompanyQuestion,
} from "@/lib/company-inheritance"

/**
 * Knowledge health and agent-readiness evaluation — see COMPANY.md § B.10.
 *
 * Computed server-side and handed to components as data, following the same
 * split as `src/lib/job-pulse.ts`: all the judgement lives here, the components
 * only render.
 *
 * Every check carries a written `explanation`. Status color is a secondary cue —
 * a recruiter must be able to read what is wrong without interpreting a dot.
 */

export type ReadinessStatus =
  | "ready"
  | "ready_with_caveats"
  | "review_required"
  | "blocked"

export const READINESS_LABELS: Record<ReadinessStatus, string> = {
  ready: "Ready to deploy",
  ready_with_caveats: "Ready with caveats",
  review_required: "Recruiter review required",
  blocked: "Blocked",
}

export const READINESS_SUMMARY: Record<ReadinessStatus, string> = {
  ready: "Every critical check passes and nothing has gone stale.",
  ready_with_caveats:
    "Critical checks pass, but some topics route back to you instead of being answered.",
  review_required:
    "Verified knowledge has gone stale, or candidate-facing claims are unverified.",
  blocked: "A critical check fails. Candidate agents can't be deployed for this company.",
}

export type CheckStatus = "pass" | "caveat" | "fail" | "n_a"

export type ReadinessCheck = {
  key: string
  label: string
  scope: "company" | "job"
  /** Set when `scope === "job"`. */
  jobId?: string
  jobTitle?: string
  severity: "critical" | "advisory"
  status: CheckStatus
  /** Plain-language sentence. Always populated, including on a pass. */
  explanation: string
  /** Where the recruiter goes to fix it. */
  fixLabel: string | null
  fixSection: CompanySection | null
}

/**
 * The left-rail sections. These are URL values (`?section=benefits`), so the
 * keys are the plain-language names a recruiter would use rather than the
 * internal groupings the data happens to be stored in.
 */
export type CompanySection =
  // Company
  | "profile"
  | "what-they-do"
  | "culture"
  | "why-join"
  // Working here
  | "locations"
  | "benefits"
  | "work-authorization"
  | "compensation"
  // Teams & roles
  | "teams"
  | "jobs"
  // Candidate questions — there is no FAQ destination; questions live inside
  // the section that answers them (see `faqSection`). This is the inbox only.
  | "unanswered"
  // Internal only
  | "brief"
  | "activity"

export type IssueQueue = {
  key: string
  label: string
  emptyLabel: string
  items: { id: string; label: string; detail: string | null; section: CompanySection }[]
}

export type CompanyReadiness = {
  status: ReadinessStatus
  /** The one sentence shown in the header tooltip and the deploy dialog. */
  headline: string
  completeness: {
    overall: number
    cleared: number
    internalBrief: number
    criticalPolicy: number
  }
  checks: ReadinessCheck[]
  companyChecks: ReadinessCheck[]
  jobChecks: ReadinessCheck[]
  queues: IssueQueue[]
  /** Counts for the agent-preview and deploy dialogs. */
  agentContext: {
    narrativeBlocks: number
    faqAnswers: number
    policies: number
    escalationRules: number
    excludedInternal: number
    excludedRestricted: number
  }
  openIssueCount: number
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Existence tests below use `isPublishedCleared` rather than
 * `agentCanUse`, so stale-but-present knowledge reports as "needs review" rather
 * than as "missing". Staleness is caught once, by the freshness check.
 */
function hasPublishedBody(item: KnowledgeItem | undefined): boolean {
  return Boolean(item && item.body.trim() && isPublishedCleared(item))
}

function findKnowledge(company: Company, kind: string): KnowledgeItem | undefined {
  return company.knowledge.find((k) => k.kind === kind)
}

function findPolicy(company: Company, key: string) {
  return company.policies.find((p) => p.key === key)
}

function pass(
  key: string,
  label: string,
  explanation: string,
  severity: ReadinessCheck["severity"] = "critical"
): ReadinessCheck {
  return {
    key,
    label,
    scope: "company",
    severity,
    status: "pass",
    explanation,
    fixLabel: null,
    fixSection: null,
  }
}

function problem(
  key: string,
  label: string,
  status: Exclude<CheckStatus, "pass">,
  explanation: string,
  fixLabel: string,
  fixSection: CompanySection,
  severity: ReadinessCheck["severity"] = "critical"
): ReadinessCheck {
  return {
    key,
    label,
    scope: "company",
    severity,
    status,
    explanation,
    fixLabel,
    fixSection,
  }
}

// ---------------------------------------------------------------------------
// Company-level critical checks
// ---------------------------------------------------------------------------

function companyLevelChecks(company: Company, today: Date): ReadinessCheck[] {
  const checks: ReadinessCheck[] = []

  // 1. Company description
  const oneLiner = findKnowledge(company, "one_liner")
  checks.push(
    hasPublishedBody(oneLiner)
      ? pass(
          "company_description",
          "Company description",
          "A published one-sentence description is available for agents to open with."
        )
      : problem(
          "company_description",
          "Company description",
          "fail",
          "There's no published company description. Agents can't introduce this company to a candidate.",
          "Write a company description",
          "what-they-do"
        )
  )

  // 2. Location and operating model
  const workModel = findPolicy(company, "work_model")
  checks.push(
    workModel && workModel.value && isPublishedCleared(workModel)
      ? pass(
          "operating_model",
          "Location and operating model",
          `Published: ${workModel.value}.`
        )
      : problem(
          "operating_model",
          "Location and operating model",
          "fail",
          "No published work-model policy. Remote and office questions are the most common thing candidates ask, and agents have nothing to answer with.",
          "Set the work model",
          "locations"
        )
  )

  // 3. Benefits or an approved fallback
  const benefits = company.policies.filter(
    (p) => p.group === "benefits" && p.value && isPublishedCleared(p)
  )
  checks.push(
    benefits.length > 0
      ? pass(
          "benefits",
          "Benefits or approved fallback",
          `${benefits.length} published benefit${benefits.length === 1 ? "" : "s"} available to agents.`
        )
      : problem(
          "benefits",
          "Benefits or approved fallback",
          "fail",
          "No published benefits and no approved fallback. Agents will escalate every benefits question.",
          "Add benefits",
          "benefits"
        )
  )

  // 4. Work authorization / visa policy — the highest-risk check
  const workAuth = findPolicy(company, "work_auth_requirement")
  const authKnown =
    workAuth?.immigrationValue && workAuth.immigrationValue !== "unknown"

  if (!authKnown) {
    checks.push(
      problem(
        "work_authorization",
        "Work authorization / visa policy",
        "fail",
        "This company has no confirmed work-authorization policy. Candidate agents may not answer sponsorship questions without a verified policy or an approved fallback.",
        "Set a work authorization policy",
        "work-authorization"
      )
    )
  } else {
    const unconfirmed = company.policies.filter(
      (p) => p.group === "immigration" && p.immigrationValue === "unknown"
    )
    checks.push(
      unconfirmed.length === 0
        ? pass(
            "work_authorization",
            "Work authorization / visa policy",
            "Every immigration policy has a confirmed value."
          )
        : problem(
            "work_authorization",
            "Work authorization / visa policy",
            "caveat",
            `${unconfirmed.length} immigration ${unconfirmed.length === 1 ? "policy is" : "policies are"} unconfirmed (${unconfirmed
              .map((p) => p.label)
              .join(", ")}). The agent will escalate those questions instead of answering them.`,
            "Confirm the remaining policies",
            "work-authorization"
          )
    )
  }

  // 5. Escalation path
  const hasEscalation = allAnswers(company).some((a) => a.answer.escalationInstructions)
  checks.push(
    hasEscalation
      ? pass(
          "escalation_path",
          "Candidate escalation path",
          "At least one topic has explicit escalation instructions, so the agent knows when to hand off."
        )
      : problem(
          "escalation_path",
          "Candidate escalation path",
          "fail",
          "No escalation instructions exist. When an agent can't answer, it has nowhere to route the candidate.",
          "Add escalation instructions",
          "profile"
        )
  )

  // 6. The interview-process baseline moved to a per-job check
  // (`role_process` in JOB_CHECKS). It used to look for a published *company*
  // answer describing the process, which can't exist: each job snapshots its own
  // pipeline, so the only truthful version of this check is "does this role have
  // stages". The check followed the question to the job.

  // 7. Company-size answer
  const sizeFaq = answeredInCategory(company, "size_growth")
  checks.push(
    sizeFaq
      ? pass("size_answer", "Approved answer for company size", "A published answer exists.")
      : problem(
          "size_answer",
          "Approved answer for company size",
          "fail",
          "No approved answer for company size.",
          "Add a company-size answer",
          "profile"
        )
  )

  // 8. Culture answer
  const cultureFaq = answeredInCategory(company, "culture")
  checks.push(
    cultureFaq
      ? pass(
          "culture_answer",
          "Approved answer for culture and working style",
          "A published answer exists."
        )
      : problem(
          "culture_answer",
          "Approved answer for culture and working style",
          "fail",
          "No approved answer for culture or working style.",
          "Add a culture answer",
          "culture"
        )
  )

  // 9. Staleness sweep — advisory, but drives "Recruiter review required"
  const staleItems = collectStale(company, today)
  checks.push(
    staleItems.length === 0
      ? pass(
          "freshness",
          "Knowledge freshness",
          "Nothing has passed its review date.",
          "advisory"
        )
      : problem(
          "freshness",
          "Knowledge freshness",
          "caveat",
          `${staleItems.length} item${staleItems.length === 1 ? " has" : "s have"} passed the review date. Re-confirm before using them in candidate conversations.`,
          "Review stale knowledge",
          "profile",
          "advisory"
        )
  )

  return checks
}

// ---------------------------------------------------------------------------
// Per-job checks
// ---------------------------------------------------------------------------

const JOB_CHECKS: {
  key: string
  label: string
  get: (j: CompanyJob) => unknown
  missing: string
  /** Row-sized phrase for the jobs list. Same source as the check, so they can't disagree. */
  short: string
  fix: string
}[] = [
  {
    key: "role_comp",
    label: "Role compensation policy",
    get: (j) => j.compensation,
    missing: "has no compensation policy or approved fallback",
    short: "No compensation policy",
    fix: "Add compensation",
  },
  {
    key: "role_reporting",
    label: "Role reporting line",
    get: (j) => j.reportsTo,
    missing: "has no reporting line",
    short: "No reporting line",
    fix: "Add a reporting line",
  },
  {
    key: "role_purpose",
    label: "Why this role exists",
    get: (j) => j.rolePurpose,
    missing: "doesn't explain why the role exists",
    short: "No role purpose",
    fix: "Add the role purpose",
  },
  {
    key: "role_process",
    label: "Interview process for this role",
    get: (j) => (j.interviewStages.length > 0 ? j.interviewStages : null),
    missing: "has no pipeline, so an agent can't describe its process",
    short: "No pipeline",
    fix: "Pick a workflow",
  },
  {
    key: "role_travel",
    label: "Travel and location requirements",
    get: (j) => j.travel ?? j.location,
    missing: "has no travel or location requirement",
    short: "No travel or location",
    fix: "Add travel and location",
  },
]

function jobLevelChecks(company: Company): ReadinessCheck[] {
  return company.jobs.filter(isActiveJob).flatMap((job) =>
    JOB_CHECKS.map((def): ReadinessCheck => {
      const value = def.get(job)
      const ok = Boolean(value)
      return {
        key: `${def.key}:${job.id}`,
        label: def.label,
        scope: "job",
        jobId: job.id,
        jobTitle: job.title,
        severity: "critical",
        status: ok ? "pass" : "fail",
        explanation: ok
          ? `Set for ${job.title}.`
          : `${job.title} ${def.missing}. Agents will escalate this question for candidates on that job.`,
        fixLabel: ok ? null : def.fix,
        fixSection: ok ? null : "jobs",
      }
    })
  )
}

/** A job is only worth grading while an agent could actually be running on it. */
function isActiveJob(job: CompanyJob): boolean {
  return job.status === "open" || job.status === "draft"
}

export type JobCoverage = {
  job: CompanyJob
  /** Row-sized problems, empty when the job is fully grounded. */
  problems: string[]
  /** False for closed and paused jobs — nothing is screening candidates on them. */
  active: boolean
}

/**
 * Per-job coverage for the Jobs section — *what is this role still missing
 * before an agent can screen for it*.
 *
 * This is the section's actual job (see COMPANY.md § B.8). It used to render a
 * directory — title, location, and "7 in pipeline" — which duplicated `/jobs`
 * with data this domain doesn't own, while the two questions that belong to a
 * knowledge base (what's missing, what's overridden) had no surface at all.
 *
 * Derived from the same `JOB_CHECKS` array that `jobLevelChecks()` renders as
 * readiness checks, so a row and the rail badge can never disagree.
 */
export function jobCoverage(company: Company): JobCoverage[] {
  return company.jobs.map((job) => {
    if (!isActiveJob(job)) return { job, problems: [], active: false }

    const problems = JOB_CHECKS.filter((def) => !def.get(job)).map((def) => def.short)

    // Not a JOB_CHECK: a job without a team isn't missing a *field*, it's
    // missing a level of the inheritance chain, so the fix is on the other
    // section.
    if (!job.teamId) problems.push("No team linked")

    const conflicts = job.overrides.filter((o) => o.conflictsWithVerified).length
    if (conflicts > 0) {
      problems.push(
        `${conflicts} override${conflicts === 1 ? "" : "s"} conflict${conflicts === 1 ? "s" : ""} with a verified company value`
      )
    }

    // Unanswered questions are a coverage problem, not just a publish-time
    // caveat: the agent escalates them. Without this the Jobs list read
    // "nothing missing" for a role whose publish dialog listed three
    // unanswered sensitive topics — two screens disagreeing about one job.
    // Same source as the publish warning, so they can't drift.
    const gaps = jobAnswerGaps(company, job)
    const sensitiveGaps = gaps.filter((g) => g.sensitive).length
    if (sensitiveGaps > 0) {
      problems.push(
        `${sensitiveGaps} sensitive question${sensitiveGaps === 1 ? "" : "s"} unanswered`
      )
    } else if (gaps.length > 0) {
      problems.push(`${gaps.length} question${gaps.length === 1 ? "" : "s"} unanswered`)
    }

    return { job, problems, active: true }
  })
}

/**
 * Per-job, what an agent screening for this role **still can't answer** — shown
 * at publish, as a warning rather than a block.
 *
 * Publishing is the moment company knowledge reaches every agent on every job
 * here, and it was the one moment that said nothing about whether those agents
 * could actually do their work. A blocking gate would be wrong — plenty of
 * companies run screens with gaps, and the agent escalating is a designed
 * outcome, not a failure — but silence is worse than either.
 *
 * Sensitive topics come first: an unanswered sponsorship question is a candidate
 * hearing "I'll have to check" on the thing that decides whether they apply.
 */
export function jobAnswerGaps(
  company: Company,
  job: CompanyJob
): { question: string; sensitive: boolean }[] {
  return companyQuestions(company)
    .filter((q) => {
      const catalog = questionOf(company, q)
      return catalog ? appliesToJob(catalog, job) : false
    })
    .map((raw) => withDerived(company, raw, job))
    .filter((q) => !resolveAnswer(company, q, { jobId: job.id }, { publishedOnly: true }))
    .map((q) => {
      const catalog = questionOf(company, q)
      return {
        question: catalog?.intent ?? q.questionId,
        sensitive: catalog?.sensitive ?? false,
        askedCount: q.askedCount,
      }
    })
    .sort((a, b) => {
      if (a.sensitive !== b.sensitive) return Number(b.sensitive) - Number(a.sensitive)
      return b.askedCount - a.askedCount
    })
    .map(({ question, sensitive }) => ({ question, sensitive }))
}

// ---------------------------------------------------------------------------
// Issue queues
// ---------------------------------------------------------------------------

type LabeledBearing = VisibilityBearing & {
  id: string
  label: string
  section: CompanySection
}

/**
 * Which left-rail section owns each knowledge kind. The three candidate-facing
 * groups line up with `NARRATIVE_GROUPS` in `mock-companies.ts`; this maps them
 * onto the plain-language section names the rail actually shows.
 */
export function knowledgeSection(kind: KnowledgeKind): CompanySection {
  switch (kind) {
    case "brief_note":
      return "brief"
    // Culture is *how people actually work*. The employer value proposition is
    // a pitch — the same kind of thing as "why join now", which sat in the other
    // section, so the boundary was already leaking.
    case "culture":
    case "leadership_principles":
    case "career_growth":
      return "culture"
    case "evp":
    case "why_hiring":
    case "differentiators":
    case "why_join_now":
      return "why-join"
    // Where the company sits in its market pairs with the competition question,
    // which routes to what-they-do.
    case "market_positioning":
      return "what-they-do"
    // "Context reusable across several roles of the same kind" — and
    // `Team.commonRoleFamilies` already exists as a field.
    case "role_family_context":
      return "teams"
    default:
      return "what-they-do"
  }
}

/**
 * Which section owns each candidate question.
 *
 * There is no FAQ library any more. Questions live inside the section that
 * answers them — sponsorship questions under Work authorization, size questions
 * under Profile — because a recruiter editing the fact and editing the answer to
 * the question about that fact is doing one job, not two.
 */
export function faqSection(category: FaqCategory): CompanySection {
  switch (category) {
    case "size_growth":
    case "financial_stability":
      return "profile"
    case "mission_story":
    case "products_customers":
    case "competition":
      return "what-they-do"
    case "culture":
    case "team_collaboration":
    case "career_progression":
    case "accessibility":
    case "objections":
      return "culture"
    // Job-only (see `questionsForSection`); this is only its topical home for
    // the inbox's "where would this land" label.
    case "why_role_open":
      return "jobs"
    case "remote_model":
    case "office_expectations":
    case "travel":
      return "locations"
    case "benefits":
    case "equity":
      return "benefits"
    case "work_authorization":
      return "work-authorization"
    case "comp_philosophy":
      return "compensation"
    case "leadership":
    // A typical week is a *team* fact — `Team.dayInTheLife` holds it — so the
    // question about it belongs beside it. Routing it to Jobs split the fact
    // and the answer across two sections, which is the exact thing this
    // function exists to prevent.
    case "typical_day":
      return "teams"
    // Job-only questions never reach a company section (see
    // `questionsForSection`); this is only their topical home for the inbox's
    // "where would this land" label.
    case "interview_process":
    case "hiring_timeline":
      return "jobs"
  }
}

/**
 * Re-exported so a component needs one import for "the question and whether it's
 * answered". The definitions live in `company-inheritance.ts`, next to the
 * resolver that decides what "answered" means across scopes.
 */
export { isUnanswered, unansweredItems } from "@/lib/company-inheritance"

/**
 * A published, candidate-cleared answer in a category — the existence test the
 * baseline checks use.
 *
 * Scope-agnostic on purpose: an interview-process answer written only for one
 * team still means the company has one. What it can't tell you is whether *this
 * job* has one, which is what `resolveAnswer` is for.
 */
function answeredInCategory(company: Company, category: FaqCategory) {
  return allAnswers(company).find(
    ({ answer, catalog }) => catalog?.category === category && isPublishedCleared(answer)
  )
}

/**
 * The questions a section owns — routed by the *catalog's* category, so a
 * question lands in the section that answers it without anyone filing it there.
 */
/**
 * The questions a section owns.
 *
 * **Job-only questions are excluded entirely.** They live on the role, next to
 * the pipeline and the overrides that decide their answer — one place per scope
 * rather than a topic scattered across two. A company section that listed them
 * would be a company section you can't answer anything in.
 */
export function questionsForSection(
  company: Company,
  section: CompanySection
): CompanyQuestion[] {
  return companyQuestions(company).filter((q) => {
    const catalog = questionOf(company, q)
    if (!catalog || catalog.answerableAt === "job") return false
    return faqSection(catalog.category) === section
  })
}

/**
 * The questions that belong to one role: everything answerable only per job,
 * plus every company question this role answers *itself* — whether someone wrote
 * an override or the answer is derived from the role's own fields.
 *
 * Every job gets this the moment it exists. The catalog is projected onto the
 * company and `withDerived` fills in what the job's own fields already answer,
 * so a new req arrives with its knowledge space populated: nothing to seed,
 * nothing to assign, and the gaps are real gaps rather than setup.
 */
export function questionsForJob(company: Company, job: CompanyJob): CompanyQuestion[] {
  return companyQuestions(company)
    .map((q) => withDerived(company, q, job))
    .filter((q) => {
      const catalog = questionOf(company, q)
      if (!catalog || !appliesToJob(catalog, job)) return false
      if (catalog.answerableAt === "job") return true
      return q.answers.some((a) => a.scope.kind === "job" && a.scope.refId === job.id)
    })
}

/** Which section owns each policy group. */
export function policySection(group: PolicyGroup): CompanySection {
  switch (group) {
    case "immigration":
      return "work-authorization"
    case "benefits":
      return "benefits"
    case "compensation":
      return "compensation"
    case "internal":
      return "brief"
    default:
      return "locations"
  }
}

function allBearings(company: Company): LabeledBearing[] {
  return [
    ...company.knowledge.map((k) => ({
      ...k,
      label: k.kind === "brief_note" ? `Brief — ${k.title}` : `${k.title}`,
      section: knowledgeSection(k.kind),
    })),
    ...company.policies.map((p) => ({
      ...p,
      label: `Policy — ${p.label}`,
      section: policySection(p.group),
    })),
    ...allAnswers(company).map(({ answer, catalog }) => ({
      ...answer,
      label: `Question — ${catalog?.intent ?? answer.id}`,
      section: catalog ? faqSection(catalog.category) : ("profile" as CompanySection),
    })),
    ...allTeams(company).map((t) => ({
      ...t,
      label: `Team — ${t.name}`,
      section: "teams" as CompanySection,
    })),
    ...company.stakeholders.map((s) => ({
      ...s,
      label: `Stakeholder — ${s.name}`,
      section: "teams" as CompanySection,
    })),
  ]
}

/**
 * Staleness applies to items that make a claim. An escalate-marked item makes
 * none — "we don't know, ask a recruiter" can't expire — so it's excluded here
 * and reported once, as a caveat on the work-authorization check, instead of
 * being counted twice and dragging the company into `review_required`.
 */
function collectStale(company: Company, today: Date) {
  return allBearings(company).filter(
    (b) =>
      b.visibility.state === "published" &&
      !agentMustEscalate(b) &&
      isStale(b, today)
  )
}

function buildQueues(company: Company, today: Date): IssueQueue[] {
  const bearings = allBearings(company)

  const stale = collectStale(company, today).map((b) => ({
    id: b.id,
    label: b.label,
    detail: b.visibility.lastVerifiedAt
      ? `Last verified ${b.visibility.lastVerifiedAt}`
      : "Never verified",
    section: b.section,
  }))

  const unverifiedClaims = bearings
    .filter(
      (b) =>
        b.visibility.clearance === "cleared_for_candidates" &&
        b.visibility.state === "published" &&
        // Same reasoning as the stale sweep: an escalate item asserts nothing,
        // so it can't be an unverified assertion.
        !agentMustEscalate(b) &&
        (b.visibility.verification === "unverified" ||
          b.visibility.verification === "needs_review")
    )
    .map((b) => ({
      id: b.id,
      label: b.label,
      detail: `Marked ${b.visibility.verification === "unverified" ? "unverified" : "needs review"} · ${b.visibility.source || "no source recorded"}`,
      section: b.section,
    }))

  // Routed to the section that will answer them. This used to be stamped
  // `"faq"` — a section that no longer exists, hidden by an `as` cast, so every
  // item in this queue linked nowhere.
  const missingAnswers = unansweredItems(company).map(({ question, job }) => {
    const catalog = questionOf(company, question)
    return {
      id: `${question.questionId}:${job?.id ?? "company"}`,
      label: catalog?.intent ?? question.questionId,
      // A job-only question is missing *for a role*. Reporting it once, without
      // saying which, is how two of three roles stay uncovered.
      detail: job
        ? `${job.title} · asked ${question.askedCount}×`
        : question.askedClientAt
          ? `Asked ${question.askedCount}× · waiting on the client since ${question.askedClientAt}`
          : `Asked ${question.askedCount}×`,
      section: catalog ? faqSection(catalog.category) : ("profile" as CompanySection),
    }
  })

  const contextlessGroups = [
    ...allTeams(company)
      .filter((t) => !t.dayInTheLife || !isPublishedCleared(t))
      .map((t) => ({
        id: t.id,
        label: `Team — ${t.name}`,
        detail: "No approved day-in-the-life context",
        section: "teams" as CompanySection,
      })),
  ]

  const jobsWithoutContext = company.jobs
    .filter((j) => (j.status === "open" || j.status === "draft") && (!j.teamId || !j.rolePurpose))
    .map((j) => ({
      id: j.id,
      label: j.title,
      detail: !j.teamId ? "No team assigned" : "No role narrative",
      section: "jobs" as CompanySection,
    }))

  const conflictingOverrides = company.jobs
    .flatMap((j) =>
      j.overrides
        .filter((o) => o.conflictsWithVerified)
        .map((o) => ({
          id: `${j.id}:${o.fieldKey}`,
          label: `${j.title} — ${o.label}`,
          detail: `Role says "${o.overrideValue}"; company says "${o.inheritedValue}"`,
          section: "jobs" as CompanySection,
        }))
    )

  return [
    {
      key: "stale",
      label: "Stale knowledge",
      emptyLabel: "Nothing has passed its review date.",
      items: stale,
    },
    {
      key: "unverified",
      label: "Unverified candidate-facing claims",
      emptyLabel: "Every published candidate-facing item is verified.",
      items: unverifiedClaims,
    },
    {
      key: "missing_answers",
      label: "Questions candidates asked that nobody has answered",
      emptyLabel: "No unanswered candidate questions.",
      items: missingAnswers,
    },
    {
      key: "contextless",
      label: "Departments and teams without approved context",
      emptyLabel: "Every department and team has approved context.",
      items: contextlessGroups,
    },
    {
      key: "jobs_without_context",
      label: "Active jobs lacking a team or role narrative",
      emptyLabel: "Every active job has team and role context.",
      items: jobsWithoutContext,
    },
    {
      key: "conflicts",
      label: "Job overrides that conflict with company data",
      emptyLabel: "No conflicting overrides.",
      items: conflictingOverrides,
    },
  ]
}

// ---------------------------------------------------------------------------
// Completeness
// ---------------------------------------------------------------------------

function computeCompleteness(company: Company) {
  const narrative = narrativeItems(company)
  const brief = briefItems(company)

  const narrativeFilled = narrative.filter((k) => k.body.trim()).length
  const policiesFilled = company.policies.filter(
    (p) => p.value || p.immigrationValue
  ).length
  const identityFields = [
    company.preferredName,
    company.website,
    company.headquarters,
    company.industry,
    company.stage,
    company.employeeRange,
    company.operatingModel,
  ]
  const identityFilled = identityFields.filter(Boolean).length

  // Only answered questions count as done. An unanswered one still raises the
  // denominator below, so a company that keeps collecting questions without
  // answering them reports as *less* complete, which is the truth.
  const faqAnswered = companyQuestions(company).filter((q) => !isUnanswered(q)).length

  const overallDone = narrativeFilled + policiesFilled + identityFilled + faqAnswered
  const overallTotal =
    narrative.length +
    Math.max(company.policies.length, 12) +
    identityFields.length +
    Math.max(companyQuestions(company).length, 8)

  const candidateFacing = [
    ...narrative,
    ...company.policies,
    ...allAnswers(company).map((a) => a.answer),
  ].filter((i) => i.visibility.clearance === "cleared_for_candidates")
  const candidateReady = candidateFacing.filter(isCleared).length

  const criticalPolicyKeys = [
    "work_model",
    "work_auth_requirement",
    "sponsorship_general",
    "health",
    "pto",
    "equity",
  ]
  const criticalCovered = criticalPolicyKeys.filter((key) => {
    const p = company.policies.find((x) => x.key === key)
    return Boolean(p && (p.value || (p.immigrationValue && p.immigrationValue !== "unknown")))
  }).length

  return {
    overall: percent(overallDone, overallTotal),
    cleared: percent(candidateReady, Math.max(candidateFacing.length, 1)),
    internalBrief: percent(brief.filter((k) => k.body.trim()).length, Math.max(brief.length, 6)),
    criticalPolicy: percent(criticalCovered, criticalPolicyKeys.length),
  }
}

// ---------------------------------------------------------------------------
// Agent context counts
// ---------------------------------------------------------------------------

function computeAgentContext(company: Company) {
  const narrative = narrativeItems(company).filter((k) => k.body.trim())
  const all = [...narrative, ...company.policies, ...allAnswers(company).map((a) => a.answer)]

  return {
    narrativeBlocks: narrative.filter((k) => agentCanUse(k)).length,
    faqAnswers: allAnswers(company).filter((a) => agentCanUse(a.answer)).length,
    policies: company.policies.filter((p) => agentCanUse(p) && p.candidateFacingText).length,
    escalationRules: all.filter(agentMustEscalate).length,
    excludedInternal: allBearings(company).filter((b) => b.visibility.clearance === "recruiters_only")
      .length,
    excludedRestricted: allBearings(company).filter(
      (b) => b.visibility.clearance === "restricted"
    ).length,
  }
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export function evaluateReadiness(company: Company, today: Date): CompanyReadiness {
  const companyChecks = companyLevelChecks(company, today)
  const jobChecks = jobLevelChecks(company)
  const checks = [...companyChecks, ...jobChecks]

  const criticalFails = checks.filter(
    (c) => c.severity === "critical" && c.status === "fail"
  )
  const caveats = checks.filter((c) => c.status === "caveat")
  const staleCheck = companyChecks.find((c) => c.key === "freshness")
  const queues = buildQueues(company, today)
  const unverified = queues.find((q) => q.key === "unverified")?.items.length ?? 0

  let status: ReadinessStatus
  let headline: string

  if (criticalFails.length > 0) {
    status = "blocked"
    // Lead with the most consequential failure — work authorization if present,
    // otherwise the first one, so the header tooltip says something specific.
    const lead =
      criticalFails.find((c) => c.key === "work_authorization") ?? criticalFails[0]
    headline = lead.explanation
  } else if (staleCheck?.status === "caveat" || unverified > 0) {
    status = "review_required"
    headline =
      staleCheck?.status === "caveat"
        ? staleCheck.explanation
        : `${unverified} published candidate-facing ${unverified === 1 ? "claim is" : "claims are"} unverified. Confirm them before candidate conversations begin.`
  } else if (caveats.length > 0) {
    status = "ready_with_caveats"
    headline = caveats[0].explanation
  } else {
    status = "ready"
    headline = READINESS_SUMMARY.ready
  }

  const openIssueCount =
    criticalFails.length + caveats.length + queues.reduce((n, q) => n + q.items.length, 0)

  return {
    status,
    headline,
    completeness: computeCompleteness(company),
    checks,
    companyChecks,
    jobChecks,
    queues,
    agentContext: computeAgentContext(company),
    openIssueCount,
  }
}

/** The top N open issues. */
export function topIssues(readiness: CompanyReadiness, n = 3) {
  const failing = readiness.checks.filter(
    (c) => c.status === "fail" || c.status === "caveat"
  )
  return failing.slice(0, n)
}

export type SectionGap = { count: number; blocking: boolean }

/**
 * Gap counts per section, for the left-rail badges.
 *
 * This is where the old Readiness tab went. Rather than a separate checklist
 * duplicating the completeness meter, the same signals ride along the navigation
 * a recruiter is already reading — you see *where* the problems are while
 * choosing where to go, and fix them in place.
 *
 * `blocking` marks a section holding a failed critical check, so the rail can
 * distinguish "incomplete" from "this is why agents can't deploy".
 */
export function gapCountsBySection(
  readiness: CompanyReadiness
): Partial<Record<CompanySection, SectionGap>> {
  const out: Partial<Record<CompanySection, SectionGap>> = {}

  const bump = (section: CompanySection, blocking: boolean) => {
    const prev = out[section] ?? { count: 0, blocking: false }
    out[section] = {
      count: prev.count + 1,
      blocking: prev.blocking || blocking,
    }
  }

  for (const check of readiness.checks) {
    if (check.status !== "fail" && check.status !== "caveat") continue
    if (!check.fixSection) continue
    // Advisory checks are company-wide statements (freshness is the only one
    // today), so they'd put a count on whichever section hosts their banner even
    // though nothing there is wrong. Staleness gets located precisely by
    // `staleSections()` instead.
    if (check.severity !== "critical") continue
    bump(check.fixSection, check.status === "fail")
  }

  // Unanswered candidate questions count twice on purpose: once on the section
  // that will answer them — that's the whole reason they're routed there — and
  // once as the inbox total, for the recruiter who doesn't yet know which
  // section owns the answer. They're counts of real questions rather than of
  // failed checks, and never blocking: an unanswered question means the agent
  // escalates, which is a designed outcome rather than a broken one.
  const unanswered = readiness.queues.find((q) => q.key === "missing_answers")
  if (unanswered && unanswered.items.length > 0) {
    for (const item of unanswered.items) bump(item.section, false)
    out.unanswered = { count: unanswered.items.length, blocking: false }
  }

  return out
}

/**
 * Sections holding items that need re-confirming, for the rail's attention dot.
 *
 * Stale and unverified are one signal here rather than two. They differ in cause
 * — a review date passed, versus nobody ever confirmed it — but the action is
 * identical: go check with the client. A rail carrying a separate dot per cause
 * would be more precise and less useful.
 */
export function attentionSections(
  readiness: CompanyReadiness
): Partial<Record<CompanySection, number>> {
  const out: Partial<Record<CompanySection, number>> = {}
  for (const key of ["stale", "unverified"]) {
    for (const item of readiness.queues.find((q) => q.key === key)?.items ?? []) {
      out[item.section] = (out[item.section] ?? 0) + 1
    }
  }
  return out
}

/** Re-exported so components don't need to import two modules for a stale badge. */
export { staleState }
