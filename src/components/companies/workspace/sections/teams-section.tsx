import Link from "next/link"
import { ArrowLeft, Building2, Plus, Users } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ClearanceBadge } from "@/components/companies/shared/clearance-badge"
import {
  SectionEmpty,
  SectionShell,
} from "@/components/companies/workspace/section-shell"
import type { SectionDef } from "@/components/companies/workspace/company-sections"
import { SectionQuestions } from "@/components/companies/shared/section-questions"
import { faqSection, type CompanyReadiness } from "@/lib/company-readiness"
import { allTeams, type Company, type Department, type Team } from "@/lib/mock-companies"

/**
 * Departments and teams — the one section whose **empty state is the correct
 * state**. Most companies never need either, so the copy frames having none as
 * fine rather than as a gap, and creation is always tied to a job that needed it.
 *
 * `?team=<id>` drills into a single team.
 */
export function TeamsSection({
  company,
  section,
  readiness,
  today,
  teamId,
}: {
  company: Company
  section: SectionDef
  readiness: CompanyReadiness
  today: Date
  teamId?: string
}) {
  const team = teamId ? allTeams(company).find((t) => t.id === teamId) : null

  if (team) {
    const department = company.departments.find((d) => d.id === team.departmentId)
    return (
      <SectionShell section={section} readiness={readiness}>
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2 gap-1.5 text-muted-foreground"
          render={<Link href={`/companies/${company.id}?section=teams`} />}
        >
          <ArrowLeft className="size-3.5" />
          All departments
        </Button>
        <TeamDetail company={company} team={team} departmentName={department?.name} />
      </SectionShell>
    )
  }

  return (
    <SectionShell
      section={section}
      readiness={readiness}
      bulkItems={company.departments}
      actions={
        <Button variant="outline" size="sm" className="gap-1.5">
          <Plus className="size-3.5" />
          Create department
        </Button>
      }
    >
      {company.departments.length === 0 ? (
        <SectionEmpty
          title="No departments yet — that's fine"
          prompt="Company-level knowledge covers most roles. Create a department when a job needs context this company profile can't provide."
          actionLabel="Create department"
        />
      ) : (
        <div className="space-y-3">
          {company.departments.map((department) => (
            <DepartmentCard
              key={department.id}
              company={company}
              department={department}
            />
          ))}
        </div>
      )}

      <SectionQuestions
        today={today}
        entries={company.faq.filter((f) => faqSection(f.category) === section.key)}
        emptyPrompt="Nothing recorded yet. Questions about reporting lines and who you'd work with belong here."
      />
    </SectionShell>
  )
}

function DepartmentCard({
  company,
  department,
}: {
  company: Company
  department: Department
}) {
  const because = department.createdBecauseJobId
    ? company.jobs.find((j) => j.id === department.createdBecauseJobId)
    : null

  return (
    <section className="rounded-lg border border-border">
      <div className="space-y-2 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <Building2 className="size-4 shrink-0 text-muted-foreground" />
            <h3 className="font-medium">{department.name}</h3>
          </div>
          <ClearanceBadge clearance={department.visibility.clearance} />
        </div>

        <p className="text-sm text-muted-foreground">{department.mission}</p>

        {department.candidateFacingDescription && (
          <p className="text-sm">{department.candidateFacingDescription}</p>
        )}

        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {department.sizeRange && <span>{department.sizeRange} people</span>}
          {department.operatingModel && <span>{department.operatingModel}</span>}
          {because && <span>Created for {because.title}</span>}
        </div>

        {department.commonRoleFamilies.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {department.commonRoleFamilies.map((r) => (
              <Badge key={r} variant="secondary">
                {r}
              </Badge>
            ))}
          </div>
        )}

      </div>

      <div className="border-t border-border bg-muted/30 p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-medium text-muted-foreground">
            {department.teams.length} team{department.teams.length === 1 ? "" : "s"}
          </p>
          <Button variant="ghost" size="sm" className="gap-1.5 text-xs">
            <Plus className="size-3" />
            Create team
          </Button>
        </div>

        {department.teams.length === 0 ? (
          <p className="mt-1.5 text-xs text-muted-foreground">
            No teams here yet. Add one when a role needs a hiring manager, a
            day-in-the-life, or team-specific answers.
          </p>
        ) : (
          <ul className="mt-2 space-y-1">
            {department.teams.map((team) => (
              <li key={team.id}>
                <Link
                  href={`/companies/${company.id}?section=teams&team=${team.id}`}
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted"
                >
                  <Users className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="font-medium">{team.name}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {team.sizeRange ? `${team.sizeRange} people` : ""}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

function TeamDetail({
  company,
  team,
  departmentName,
}: {
  company: Company
  team: Team
  departmentName?: string
}) {
  const manager = team.hiringManagerId
    ? company.stakeholders.find((s) => s.id === team.hiringManagerId)
    : null

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-lg font-semibold">{team.name}</h3>
          <ClearanceBadge clearance={team.visibility.clearance} />
        </div>
        {departmentName && (
          <p className="text-sm text-muted-foreground">In {departmentName}</p>
        )}
        <p className="text-sm">{team.mission}</p>
      </div>

      {manager && (
        <section className="space-y-1.5 rounded-lg border border-border p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-sm font-medium">
              {manager.name} · {manager.title}
            </h4>
            <ClearanceBadge clearance={manager.visibility.clearance} />
          </div>
          {manager.candidateFacingBio && (
            <p className="text-sm text-muted-foreground">{manager.candidateFacingBio}</p>
          )}
          {manager.internalNotes && (
            <p className="mt-2 rounded-md bg-muted p-2.5 text-xs text-muted-foreground">
              <span className="font-medium">Internal:</span> {manager.internalNotes}
            </p>
          )}
        </section>
      )}

      <DetailBlock title="A typical week" body={team.dayInTheLife} />
      <DetailBlock title="How they work" body={team.workingStyle} />
      <DetailBlock title="Collaboration cadence" body={team.collaborationCadence} />
      <DetailBlock title="Culture notes" body={team.cultureNotes} />

      {team.goals.length > 0 && (
        <section className="space-y-2 rounded-lg border border-border p-4">
          <h4 className="text-sm font-medium">Team goals</h4>
          <ul className="space-y-1">
            {team.goals.map((g) => (
              <li key={g} className="text-sm text-muted-foreground">
                — {g}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {team.sizeRange && <span>{team.sizeRange} people</span>}
        {team.locations.length > 0 && <span>{team.locations.join(" · ")}</span>}
        {team.timezoneSpread && <span>{team.timezoneSpread}</span>}
      </div>

      {team.internalNotes && (
        <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
          <span className="font-medium">Recruiters only:</span> {team.internalNotes}
        </p>
      )}

    </div>
  )
}

function DetailBlock({ title, body }: { title: string; body: string | null }) {
  if (!body) return null
  return (
    <section className="space-y-1.5 rounded-lg border border-border p-4">
      <h4 className="text-sm font-medium">{title}</h4>
      <p className="text-sm text-muted-foreground">{body}</p>
    </section>
  )
}
