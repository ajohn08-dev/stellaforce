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
  | "why-hiring"
  // Working here
  | "locations"
  | "benefits"
  | "work-authorization"
  | "compensation"
  // Teams & roles
  | "teams"
  | "jobs"
  | "interview-process"
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
  const hasEscalation = company.faq.some((f) => f.escalationInstructions)
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

  // 6. Interview-process baseline
  const interviewFaq = company.faq.find(
    (f) => f.category === "interview_process" && isPublishedCleared(f)
  )
  checks.push(
    interviewFaq
      ? pass(
          "interview_baseline",
          "Interview-process baseline",
          "A published answer describes the interview process."
        )
      : problem(
          "interview_baseline",
          "Interview-process baseline",
          "fail",
          "No published answer for the interview process. Candidates ask this in nearly every screen.",
          "Add an interview-process answer",
          "interview-process"
        )
  )

  // 7. Company-size answer
  const sizeFaq = company.faq.find((f) => f.category === "size_growth" && isPublishedCleared(f))
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
  const cultureFaq = company.faq.find((f) => f.category === "culture" && isPublishedCleared(f))
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
  fix: string
}[] = [
  {
    key: "role_comp",
    label: "Role compensation policy",
    get: (j) => j.compensation,
    missing: "has no compensation policy or approved fallback",
    fix: "Add compensation",
  },
  {
    key: "role_reporting",
    label: "Role reporting line",
    get: (j) => j.reportsTo,
    missing: "has no reporting line",
    fix: "Add a reporting line",
  },
  {
    key: "role_purpose",
    label: "Why this role exists",
    get: (j) => j.rolePurpose,
    missing: "doesn't explain why the role exists",
    fix: "Add the role purpose",
  },
  {
    key: "role_travel",
    label: "Travel and location requirements",
    get: (j) => j.travel ?? j.location,
    missing: "has no travel or location requirement",
    fix: "Add travel and location",
  },
]

function jobLevelChecks(company: Company): ReadinessCheck[] {
  const active = company.jobs.filter((j) => j.status === "open" || j.status === "draft")

  return active.flatMap((job) =>
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
    case "evp":
    case "culture":
    case "leadership_principles":
    case "career_growth":
      return "culture"
    case "why_hiring":
    case "differentiators":
    case "market_positioning":
    case "why_join_now":
    case "role_family_context":
      return "why-hiring"
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
    case "why_role_open":
      return "why-hiring"
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
      return "teams"
    case "typical_day":
      return "jobs"
    case "interview_process":
    case "hiring_timeline":
      return "interview-process"
  }
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
    ...company.faq.map((f) => ({
      ...f,
      label: `Question — ${f.questionIntent}`,
      section: faqSection(f.category),
    })),
    ...company.departments.map((d) => ({
      ...d,
      label: `Department — ${d.name}`,
      section: "teams" as CompanySection,
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

  const missingAnswers = company.gaps
    .filter((g) => g.status !== "resolved" && g.status !== "wont_answer")
    .map((g) => ({
      id: g.id,
      label: g.sourceQuestion,
      detail: `Asked ${g.occurrenceCount}× · ${g.assignedOwner ? `assigned to ${g.assignedOwner}` : "unassigned"}`,
      section: "faq" as CompanySection,
    }))

  const contextlessGroups = [
    ...company.departments
      .filter((d) => !d.candidateFacingDescription || !isPublishedCleared(d))
      .map((d) => ({
        id: d.id,
        label: `Department — ${d.name}`,
        detail: "No approved candidate-facing description",
        section: "teams" as CompanySection,
      })),
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

  const escalatedUnresolved = company.gaps
    .filter((g) => g.status === "open" && g.occurrenceCount >= 3)
    .map((g) => ({
      id: `esc-${g.id}`,
      label: g.sourceQuestion,
      detail: `Escalated ${g.occurrenceCount}× and still unanswered`,
      section: "faq" as CompanySection,
    }))

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
      label: "Missing FAQ answers",
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
    {
      key: "escalated",
      label: "Escalated questions not yet resolved",
      emptyLabel: "No outstanding escalations.",
      items: escalatedUnresolved,
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

  const overallDone = narrativeFilled + policiesFilled + identityFilled + company.faq.length
  const overallTotal =
    narrative.length +
    Math.max(company.policies.length, 12) +
    identityFields.length +
    Math.max(company.faq.length, 8)

  const candidateFacing = [
    ...narrative,
    ...company.policies,
    ...company.faq,
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
  const all = [...narrative, ...company.policies, ...company.faq]

  return {
    narrativeBlocks: narrative.filter(agentCanUse).length,
    faqAnswers: company.faq.filter(agentCanUse).length,
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

  // Unanswered candidate questions are their own section, and they're a count
  // of real questions rather than of failed checks.
  const unanswered = readiness.queues.find((q) => q.key === "missing_answers")
  if (unanswered && unanswered.items.length > 0) {
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
