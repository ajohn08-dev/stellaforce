/**
 * Dry run: publish a job through the wizard's fields, then watch the knowledge
 * instance appear and respond to edits. Uses the exact functions the UI renders
 * from — no mocks of our own logic.
 */
import { getMockCompany, type Company, type CompanyJob } from "@/lib/mock-companies"
import {
  companyQuestions,
  questionOf,
  resolveAnswer,
  withDerived,
  unansweredItems,
  appliesToJob,
  type Answer,
} from "@/lib/company-inheritance"
import { compileAgentContext } from "@/lib/company-agent-context"
import {
  jobCoverage,
  jobAnswerGaps,
  faqSection,
  questionsForSection,
} from "@/lib/company-readiness"
import { ALL_SECTIONS } from "@/components/companies/workspace/company-sections"

const rule = (s: string) => console.log(`\n${"─".repeat(78)}\n${s}\n${"─".repeat(78)}`)
const sectionName = (k: string) => ALL_SECTIONS.find((s) => s.key === k)?.label ?? k

const company: Company = structuredClone(getMockCompany("lumagrid-security")!)

// ── STEP 1 — the wizard ────────────────────────────────────────────────────
// Exactly the fields the draft wizard collects: role definition, the team it
// sits under, and the workflow template snapshot.
const NEW_JOB: CompanyJob = {
  id: "job-lg-02",
  title: "Enterprise Account Executive, Northeast",
  teamId: "team-lg-gtm", // Go-to-Market, one tier up from Channel Growth
  location: "Boston preferred; remote within the Northeast",
  travel: "30–40%",
  reportsTo: "VP of Channel Growth",
  rolePurpose:
    "Open the Northeast enterprise territory, which has never had dedicated coverage.",
  compensation: "$130K base; $260K OTE",
  sponsorshipPolicy: "case_by_case",
  typicalWeek: null, // the wizard didn't ask
  first90DayOutcomes: [],
  roleRisks: null,
  overrides: [],
  status: "open",
  interviewStages: [
    "Recruiter screen",
    "Hiring manager interview",
    "Territory plan review",
    "Offer",
  ],
}

rule("STEP 1 — Publish the job. Nothing else is done by hand.")
company.jobs.push(NEW_JOB)
console.log(`Created: ${NEW_JOB.title}`)
console.log(`  team: Go-to-Market · ${NEW_JOB.interviewStages.length}-stage pipeline`)
console.log(`  company.questions rows added for this job: 0  ← nothing is seeded`)

// ── STEP 2 — the instance ──────────────────────────────────────────────────
function instance(job: CompanyJob) {
  return companyQuestions(company)
    .map((raw) => {
      const entry = withDerived(company, raw, job)
      return {
        entry,
        catalog: questionOf(company, entry)!,
        hit: resolveAnswer(company, entry, { jobId: job.id }),
      }
    })
    .filter((r) => r.catalog && appliesToJob(r.catalog, job))
}

function report(job: CompanyJob, label: string) {
  const rows = instance(job)
  const needs = rows.filter((r) => !r.hit)
  const own = rows.filter((r) => r.hit?.scope.kind === "job")
  const inherited = rows.filter((r) => r.hit && r.hit.scope.kind !== "job")

  console.log(`\n${label}`)
  console.log(`  Needs an answer (${needs.length}):`)
  for (const r of needs) console.log(`      ${r.catalog.intent}`)
  console.log(`  Set for this role (${own.length}):`)
  for (const r of own)
    console.log(
      `      ${r.catalog.intent}  ←  ${r.hit!.answer.derivedFrom ?? "written for this role"}`
    )
  console.log(`  Inherited (${inherited.length}):`)
  for (const r of inherited.slice(0, 4))
    console.log(`      ${r.catalog.intent}  ←  ${r.hit!.scope.badge}`)
  if (inherited.length > 4) console.log(`      …and ${inherited.length - 4} more`)
  return { needs, own, inherited }
}

rule("STEP 2 — The instance exists immediately. No setup, no assignment.")
const before = report(NEW_JOB, "Enterprise Account Executive, Northeast")

rule("STEP 3 — Routing: every question has exactly one home")
for (const { catalog } of instance(NEW_JOB)) {
  const home =
    catalog.answerableAt === "job"
      ? "→ on the role"
      : `→ ${sectionName(faqSection(catalog.category))}`
  console.log(`  ${catalog.intent.padEnd(60)} ${home}`)
}
console.log(
  `\n  Sanity: job-only questions appearing in any company section: ` +
    ALL_SECTIONS.filter((s) =>
      questionsForSection(company, s.key).some(
        (q) => questionOf(company, q)?.answerableAt === "job"
      )
    ).length
)

rule("STEP 4 — What the agent knows, both audiences")
for (const audience of ["candidate", "internal"] as const) {
  const ctx = compileAgentContext(company, NEW_JOB, audience)
  console.log(
    `  ${audience.padEnd(10)} says ${ctx.blocks.length} · answers ${ctx.answers.length} · policies ${ctx.policies.length} · hands back ${ctx.escalations.length} · never says ${ctx.prohibitedClaims.length} · withheld ${ctx.excluded.internal + ctx.excluded.restricted}`
  )
}
const c0 = compileAgentContext(company, NEW_JOB, "candidate")
console.log("\n  Derived answers already reaching the agent:")
for (const a of c0.answers.filter((x) => x.level === "job"))
  console.log(`      ${a.question}\n        → ${a.answer.slice(0, 88)}…`)

rule("STEP 5 — Where it shows up elsewhere, unprompted")
const cov = jobCoverage(company).find((c) => c.job.id === NEW_JOB.id)!
console.log(`  Jobs list  → ${cov.problems.join(" · ") || "nothing missing"}`)
console.log(
  `  Inbox      → ${unansweredItems(company).filter((i) => i.job?.id === NEW_JOB.id).length} rows tagged with this role`
)
console.log(
  `  Publish    → ${jobAnswerGaps(company, NEW_JOB).slice(0, 3).map((g) => g.question + (g.sensitive ? " (sensitive)" : "")).join(" · ")}`
)

// ── STEP 6 — the recruiter edits ───────────────────────────────────────────
function writeJobAnswer(questionId: string, body: string) {
  const q = company.questions.find((x) => x.questionId === questionId)
  const answer: Answer = {
    id: `ans-${questionId}-${NEW_JOB.id}`,
    scope: { kind: "job", refId: NEW_JOB.id },
    body,
    expandedAnswer: null,
    escalationInstructions: null,
    prohibitedClaims: [],
    visibility: {
      clearance: "cleared_for_candidates",
      agentUse: "on_request",
      state: "published",
      source: "Recruiter, dry run",
      verification: "verified",
      lastVerifiedAt: "2026-08-18",
      verifiedBy: "Anna John",
      owner: "Anna John",
      reviewCadenceDays: null,
      nextReviewAt: null,
      isPresetDefault: false,
    },
  }
  if (q) q.answers.push(answer)
  else
    company.questions.push({
      questionId,
      askedCount: 0,
      lastAskedAt: null,
      askedClientAt: null,
      answers: [answer],
    })
}

rule("STEP 6 — Recruiter answers two things on the role, publishes")
writeJobAnswer(
  "q-hiring-timeline",
  "Four stages over about three weeks, with the territory plan review usually a week after the hiring manager conversation."
)
console.log('  ✎ "How long will the process take?" — answered for this role')

writeJobAnswer(
  "q-reporting-line",
  "You'd report to Marcus Ellery, VP of Channel Growth — the Northeast territory reports directly to him, with no regional lead in between."
)
console.log('  ✎ "Who would I report to?" — overridden for this role')

const after = report(NEW_JOB, "\nAfter publishing")

rule("STEP 7 — Did anything move that shouldn't have?")
const other = company.jobs.find((j) => j.id === "job-lg-01")!
const otherRl = resolveAnswer(
  company,
  withDerived(company, company.questions.find((q) => q.questionId === "q-reporting-line")!, other),
  { jobId: other.id }
)
console.log(`  The other role's reporting line is still: ${otherRl?.scope.badge}`)
console.log(`      "${otherRl?.answer.body.slice(0, 70)}…"`)

const companyRl = resolveAnswer(
  company,
  company.questions.find((q) => q.questionId === "q-reporting-line")!,
  {}
)
console.log(`  The company default is still: ${companyRl?.scope.badge}`)

console.log(
  `\n  Needs an answer: ${before.needs.length} → ${after.needs.length}` +
    `   ·   Set for this role: ${before.own.length} → ${after.own.length}`
)
const c1 = compileAgentContext(company, NEW_JOB, "candidate")
console.log(
  `  Agent answers: ${c0.answers.length} → ${c1.answers.length}   ·   hands back: ${c0.escalations.length} → ${c1.escalations.length}`
)
console.log(
  `  Inbox rows for this role: ${unansweredItems(company).filter((i) => i.job?.id === NEW_JOB.id).length}`
)
