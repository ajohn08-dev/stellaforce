import Link from "next/link"
import { ArrowLeft, Plus, Users } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ClearanceBadge } from "@/components/companies/shared/clearance-badge"
import { ItemVisibility } from "@/components/companies/shared/item-visibility"
import {
  SectionEmpty,
  SectionShell,
} from "@/components/companies/workspace/section-shell"
import type { SectionDef } from "@/components/companies/workspace/company-sections"
import { SectionQuestions } from "@/components/companies/shared/section-questions"
import { questionsForSection, type CompanyReadiness } from "@/lib/company-readiness"
import { childTeams, teamPath } from "@/lib/company-inheritance"
import { type Company, type Team } from "@/lib/mock-companies"

/**
 * Teams — the one section whose **empty state is the correct state**. Most
 * companies never need one, so the copy frames having none as fine rather than
 * as a gap, and creation is always tied to a job that needed it.
 *
 * **There is no separate "department" any more.** A team nests in a team
 * (`parentTeamId`), so Go-to-Market → Channel Growth is two rows of one tree
 * rather than two entity types. That removes the decision nobody could make
 * correctly — *"is this a department or a team?"* — and lets a company have one
 * tier or four without a schema change. The tree renders as the org chart.
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
  const team = teamId ? company.teams.find((t) => t.id === teamId) : null

  if (team) {
    return (
      <SectionShell section={section} readiness={readiness}>
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2 gap-1.5 text-muted-foreground"
          render={<Link href={`/companies/${company.id}?section=teams`} />}
        >
          <ArrowLeft className="size-3.5" />
          All teams
        </Button>
        <TeamDetail company={company} team={team} />
      </SectionShell>
    )
  }

  const roots = childTeams(company, null)

  return (
    <SectionShell
      section={section}
      readiness={readiness}
      bulkItems={company.teams.map((t) => ({ key: `team-${t.id}`, label: t.name, visibility: t.visibility }))}
      actions={
        <Button variant="outline" size="sm" className="gap-1.5">
          <Plus className="size-3.5" />
          Create team
        </Button>
      }
    >
      {company.teams.length === 0 ? (
        <SectionEmpty
          title="No teams yet — that's fine"
          prompt="Company-level knowledge covers most roles. Create a team when a job needs context this company profile can't provide, and nest it under another team if that's how the org actually looks."
          actionLabel="Create team"
        />
      ) : (
        <div className="space-y-2">
          {roots.map((root) => (
            <TeamBranch key={root.id} company={company} team={root} />
          ))}
        </div>
      )}

      <SectionQuestions
        company={company}
        today={today}
        entries={questionsForSection(company, section.key)}
        emptyPrompt="Nothing recorded yet. Questions about reporting lines and who you'd work with belong here."
      />
    </SectionShell>
  )
}

/**
 * A team and everything under it, recursively.
 *
 * One component for every tier, because there is only one kind of thing now. The
 * indent is `teamPath().length`, so a four-deep org draws itself with no new
 * code.
 */
function TeamBranch({ company, team }: { company: Company; team: Team }) {
  const children = childTeams(company, team.id)
  const depth = teamPath(company, team.id).length - 1
  const because = team.createdBecauseJobId
    ? company.jobs.find((j) => j.id === team.createdBecauseJobId)
    : null

  // The inverse of "Created for X". A team exists because a job needed context
  // the company profile couldn't give, so the count of jobs still inheriting
  // from it is what says whether it's still earning its place — and an orphaned
  // team becomes visible instead of quietly accumulating.
  const usedBy = company.jobs.filter((j) =>
    teamPath(company, j.teamId).some((t) => t.id === team.id)
  ).length

  return (
    <div style={{ paddingLeft: depth > 0 ? "1.5rem" : undefined }}>
      <section className="rounded-lg border border-border p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Users className="size-4 shrink-0 text-muted-foreground" />
              <Link
                href={`/companies/${company.id}?section=teams&team=${team.id}`}
                className="font-medium hover:underline"
              >
                {team.name}
              </Link>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{team.mission}</p>
            <ItemVisibility
              idPrefix={`team-${team.id}`}
              visibility={team.visibility}
              label={team.name}
            />
          </div>

          <span className="shrink-0 text-xs text-muted-foreground">
            {usedBy === 0
              ? "No jobs use this"
              : `${usedBy} job${usedBy === 1 ? "" : "s"} inherit${usedBy === 1 ? "s" : ""} from this`}
          </span>
        </div>

        {team.description && <p className="mt-2 text-sm">{team.description}</p>}

        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {team.sizeRange && <span>{team.sizeRange} people</span>}
          {team.operatingModel && <span>{team.operatingModel}</span>}
          {because && <span>Created for {because.title}</span>}
        </div>

        {team.commonRoleFamilies.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {team.commonRoleFamilies.map((r) => (
              <Badge key={r} variant="secondary">
                {r}
              </Badge>
            ))}
          </div>
        )}

        <div className="mt-3 border-t border-border pt-2">
          <Button variant="ghost" size="sm" className="gap-1.5 text-xs">
            <Plus className="size-3" />
            Create a team inside {team.name}
          </Button>
        </div>
      </section>

      {children.length > 0 && (
        <div className="mt-2 space-y-2">
          {children.map((child) => (
            <TeamBranch key={child.id} company={company} team={child} />
          ))}
        </div>
      )}
    </div>
  )
}

function TeamDetail({ company, team }: { company: Company; team: Team }) {
  const ancestors = teamPath(company, team.id).slice(1)
  const manager = team.leaderId
    ? company.stakeholders.find((s) => s.id === team.leaderId)
    : null

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-lg font-semibold">{team.name}</h3>
        </div>
        <ItemVisibility
          idPrefix={`team-${team.id}`}
          visibility={team.visibility}
          label={team.name}
        />
        {ancestors.length > 0 && (
          <p className="text-sm text-muted-foreground">
            In {ancestors.map((a) => a.name).join(" › ")}
          </p>
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

      <DetailBlock title="What an agent may say about this team" body={team.description} />
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
