import Link from "next/link"
import { AlertTriangle, ArrowLeft, ArrowRight, ExternalLink, Plus } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { OverrideRow } from "@/components/companies/shared/inheritance-badge"
import {
  SectionEmpty,
  SectionShell,
} from "@/components/companies/workspace/section-shell"
import { JobStatusBadge } from "@/components/jobs/job-status-badge"
import type { SectionDef } from "@/components/companies/workspace/company-sections"
import { JobAnswers, SectionQuestions } from "@/components/companies/shared/section-questions"
import {
  questionsForSection,
  jobCoverage,
  type CompanyReadiness,
  type JobCoverage,
} from "@/lib/company-readiness"
import { AgentKnowledgePanel } from "@/components/companies/shared/agent-knowledge-panel"
import { compileAgentContext } from "@/lib/company-agent-context"
import { teamPath } from "@/lib/company-inheritance"
import {
  allTeams,
  IMMIGRATION_VALUE_LABELS,
  type Company,
  type CompanyJob,
} from "@/lib/mock-companies"

/**
 * The jobs this company's knowledge feeds — **what each one is still missing**,
 * and, on drilldown, exactly what it inherits and what it overrides.
 *
 * Deliberately not a directory. A title, a location, and "7 in pipeline" is a
 * jobs dashboard, which `/jobs` already is and owns the data for; rendering it
 * again here made the section a duplicate that would drift the moment both were
 * real. What a knowledge base can answer that `/jobs` can't is *which roles an
 * agent still can't screen for, and why* — so that's the row.
 *
 * The title links out to the job workspace. Two screens about the same job that
 * didn't know about each other left the drilldown a dead end.
 *
 * On drilldown, precedence becomes visible: an inherited value a role has
 * replaced shows both, struck through, because an override with the original
 * hidden is indistinguishable from a plain edit.
 */
export function JobsSection({
  company,
  section,
  readiness,
  today,
  jobId,
}: {
  company: Company
  section: SectionDef
  readiness: CompanyReadiness
  today: Date
  jobId?: string
}) {
  const job = jobId ? company.jobs.find((j) => j.id === jobId) : null

  if (job) {
    return (
      <SectionShell section={section} readiness={readiness}>
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2 gap-1.5 text-muted-foreground"
          render={<Link href={`/companies/${company.id}?section=jobs`} />}
        >
          <ArrowLeft className="size-3.5" />
          All jobs
        </Button>
        <JobDetail company={company} job={job} />
      </SectionShell>
    )
  }

  return (
    <SectionShell
      section={section}
      readiness={readiness}
      actions={
        <Button variant="outline" size="sm" className="gap-1.5" render={<Link href="/jobs" />}>
          <Plus className="size-3.5" />
          Create job
        </Button>
      }
    >
      {company.jobs.length === 0 ? (
        <SectionEmpty
          title="No jobs yet"
          prompt="Everything on this company profile is reused by every job you create here — you won't re-enter any of it."
          actionLabel="Create the first job"
          href="/jobs"
        />
      ) : (
        <ul className="space-y-3">
          {jobCoverage(company).map((coverage) => (
            <li key={coverage.job.id}>
              <JobRow company={company} coverage={coverage} />
            </li>
          ))}
        </ul>
      )}

      <SectionQuestions
        company={company}
        today={today}
        entries={questionsForSection(company, section.key)}
        emptyPrompt="Nothing recorded yet. Questions about what a typical day or week looks like belong here."
      />
    </SectionShell>
  )
}

/**
 * One job as a coverage row.
 *
 * Two destinations, deliberately: the **title** goes to the job workspace (the
 * pipeline, the candidates — the things this domain doesn't own), and **"What
 * it inherits"** goes to the drilldown here. A single card-wide link would have
 * to pick one, and picking the drilldown is what made this a cul-de-sac.
 */
function JobRow({ company, coverage }: { company: Company; coverage: JobCoverage }) {
  const { job, problems, active } = coverage
  const team = job.teamId ? allTeams(company).find((t) => t.id === job.teamId) : null

  return (
    <div className="rounded-lg border border-border p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/jobs/${job.id}`}
              className="inline-flex items-center gap-1 font-medium hover:underline"
            >
              {job.title}
              <ExternalLink className="size-3 shrink-0 text-muted-foreground" />
            </Link>
            <JobStatusBadge status={job.status} />
          </div>
          <p className="text-sm text-muted-foreground">
            {[job.location, team?.name, job.reportsTo ? `Reports to ${job.reportsTo}` : null]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>

        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-muted-foreground"
          render={
            <Link href={`/companies/${company.id}?section=jobs&job=${job.id}`} />
          }
        >
          What it inherits
          <ArrowRight className="size-3.5" />
        </Button>
      </div>

      {!active ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Nothing is screening for this job, so its context isn&apos;t graded.
        </p>
      ) : problems.length === 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Nothing missing — an agent has everything it needs for this role.
        </p>
      ) : (
        <p className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-amber-700 dark:text-amber-300">
          <AlertTriangle className="size-3.5 shrink-0" />
          {problems.join(" · ")}
        </p>
      )}
    </div>
  )
}

function JobDetail({ company, job }: { company: Company; job: CompanyJob }) {
  const chain = teamPath(company, job.teamId)

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h3 className="text-lg font-semibold">{job.title}</h3>
        <p className="text-sm text-muted-foreground">
          {[
            job.location,
            job.travel ? `${job.travel} travel` : null,
            job.reportsTo ? `Reports to ${job.reportsTo}` : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>

      {job.rolePurpose && (
        <section className="space-y-1.5 rounded-lg border border-border p-4">
          <h4 className="text-sm font-medium">Why this role exists</h4>
          <p className="text-sm text-muted-foreground">{job.rolePurpose}</p>
        </section>
      )}

      <AgentKnowledgePanel
        bundles={{
          candidate: compileAgentContext(company, job, "candidate"),
          internal: compileAgentContext(company, job, "internal"),
        }}
      />

      <section className="space-y-2">
        <h4 className="text-sm font-medium">Every question, and where its answer comes from</h4>
        <p className="text-xs text-muted-foreground">
          Inherits from {[company.preferredName, ...chain.map((t) => t.name).reverse()].join(" › ")}.
          The most specific answer wins.
        </p>
        {/* Was a list of counts — "4 answers", "6 blocks" — which told you
            something was inherited without telling you *what*, and so couldn't
            answer the only question worth asking here: what will a candidate
            actually hear on this job. */}
        <JobAnswers company={company} jobId={job.id} />
      </section>

      {job.overrides.length > 0 && (
        <section className="space-y-2">
          <h4 className="text-sm font-medium">Fields overridden at role level</h4>
          <div className="space-y-2">
            {job.overrides.map((o) => (
              <OverrideRow
                key={o.fieldKey}
                label={o.label}
                inheritedValue={o.inheritedValue}
                inheritedFromLevel={o.inheritedFromLevel}
                overrideValue={o.overrideValue}
                reason={o.reason}
                conflicting={o.conflictsWithVerified}
              />
            ))}
          </div>
        </section>
      )}

      {job.sponsorshipPolicy && (
        <section className="space-y-1.5 rounded-lg border border-border p-4">
          <h4 className="text-sm font-medium">Sponsorship for this role</h4>
          <Badge variant="secondary">
            {IMMIGRATION_VALUE_LABELS[job.sponsorshipPolicy]}
          </Badge>
        </section>
      )}

      {job.first90DayOutcomes.length > 0 && (
        <section className="space-y-2 rounded-lg border border-border p-4">
          <h4 className="text-sm font-medium">First 90 days</h4>
          <ul className="space-y-1">
            {job.first90DayOutcomes.map((o) => (
              <li key={o} className="text-sm text-muted-foreground">
                — {o}
              </li>
            ))}
          </ul>
        </section>
      )}

      {job.roleRisks && (
        <section className="space-y-1.5 rounded-lg bg-muted p-4">
          <h4 className="text-sm font-medium">Internal — role risk</h4>
          <p className="text-sm text-muted-foreground">{job.roleRisks}</p>
        </section>
      )}
    </div>
  )
}
