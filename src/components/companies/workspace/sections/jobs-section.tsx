import Link from "next/link"
import { ArrowLeft, ArrowRight, Briefcase, Plus } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  InheritanceBadge,
  OverrideRow,
} from "@/components/companies/shared/inheritance-badge"
import {
  SectionEmpty,
  SectionShell,
} from "@/components/companies/workspace/section-shell"
import type { SectionDef } from "@/components/companies/workspace/company-sections"
import { SectionQuestions } from "@/components/companies/shared/section-questions"
import { faqSection, type CompanyReadiness } from "@/lib/company-readiness"
import {
  allTeams,
  IMMIGRATION_VALUE_LABELS,
  type Company,
  type CompanyJob,
} from "@/lib/mock-companies"

/**
 * The jobs attached to this company, and — on drilldown — exactly what each one
 * inherits from the company/department/team and what it overrides.
 *
 * This is where precedence becomes visible. An inherited value that a role has
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
          {company.jobs.map((job) => (
            <li key={job.id}>
              <Link
                href={`/companies/${company.id}?section=jobs&job=${job.id}`}
                className="flex items-start gap-3 rounded-lg border border-border p-4 transition-colors hover:border-foreground/20 hover:bg-muted/40"
              >
                <Briefcase className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{job.title}</span>
                    <Badge variant="outline">{job.status}</Badge>
                    {job.overrides.length > 0 && (
                      <span className="text-xs text-muted-foreground">
                        {job.overrides.length} override
                        {job.overrides.length === 1 ? "" : "s"}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{job.location}</p>
                  <p className="text-xs text-muted-foreground">
                    {job.candidatesInPipeline} in pipeline
                    {job.reportsTo ? ` · reports to ${job.reportsTo}` : ""}
                  </p>
                </div>
                <ArrowRight className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              </Link>
            </li>
          ))}
        </ul>
      )}

      <SectionQuestions
        today={today}
        entries={company.faq.filter((f) => faqSection(f.category) === section.key)}
        emptyPrompt="Nothing recorded yet. Questions about what a typical day or week looks like belong here."
      />
    </SectionShell>
  )
}

function JobDetail({ company, job }: { company: Company; job: CompanyJob }) {
  const department = job.departmentId
    ? company.departments.find((d) => d.id === job.departmentId)
    : null
  const team = job.teamId ? allTeams(company).find((t) => t.id === job.teamId) : null

  const inherited = [
    {
      label: "Company narrative",
      level: "company" as const,
      source: company.preferredName,
      detail: `${company.knowledge.filter((k) => k.kind !== "brief_note" && k.body.trim()).length} blocks`,
    },
    {
      label: "Benefits",
      level: "company" as const,
      source: company.preferredName,
      detail: `${company.policies.filter((p) => p.group === "benefits" && p.value).length} items`,
    },
    {
      label: "Work authorization",
      level: "company" as const,
      source: company.preferredName,
      detail: `${company.policies.filter((p) => p.group === "immigration" && p.immigrationValue === "unknown").length} unconfirmed`,
    },
    {
      label: "Candidate FAQ",
      level: "company" as const,
      source: company.preferredName,
      detail: `${company.faq.filter((f) => f.level === "company").length} answers`,
    },
    ...(department
      ? [
          {
            label: "Department mission",
            level: "department" as const,
            source: department.name,
            detail: department.mission,
          },
        ]
      : []),
    ...(team
      ? [
          {
            label: "Team context",
            level: "team" as const,
            source: team.name,
            detail: team.dayInTheLife ? "Day-in-the-life published" : "No day-in-the-life",
          },
        ]
      : []),
  ]

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

      <section className="space-y-2">
        <h4 className="text-sm font-medium">Inherited from this company</h4>
        <ul className="divide-y divide-border rounded-lg border border-border">
          {inherited.map((row) => (
            <li
              key={row.label}
              className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5"
            >
              <div className="min-w-0">
                <p className="text-sm">{row.label}</p>
                <p className="text-xs text-muted-foreground">{row.detail}</p>
              </div>
              <InheritanceBadge level={row.level} sourceName={row.source} />
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground">
          Precedence, highest first: role override → team → department → company →
          safe fallback and recruiter escalation.
        </p>
      </section>

      {job.overrides.length > 0 && (
        <section className="space-y-2">
          <h4 className="text-sm font-medium">Overridden at role level</h4>
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
