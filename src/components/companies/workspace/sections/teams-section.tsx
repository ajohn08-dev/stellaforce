import Link from "next/link"
import { draftKey } from "@/lib/company-draft-keys"
import { ArrowLeft, Plus, Users } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ClearanceBadge } from "@/components/companies/shared/clearance-badge"
import { SectionNote } from "@/components/companies/shared/section-note"
import { ItemVisibility } from "@/components/companies/shared/item-visibility"
import {
  SectionEmpty,
  SectionShell,
} from "@/components/companies/workspace/section-shell"
import type { SectionDef } from "@/components/companies/workspace/company-sections"
import { SectionQuestions } from "@/components/companies/shared/section-questions"
import { questionsForSection, type CompanyReadiness } from "@/lib/company-readiness"
import { cn } from "@/lib/utils"
import { childTeams, jobsUnderTeam, teamPath } from "@/lib/company-inheritance"
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
      {company.teams.length > 0 && (
        <SectionNote kind="rule">
          A candidate only ever hears about the teams their own role sits under.
          Knowledge on a team never reaches a candidate screening for a role
          somewhere else in the org.
        </SectionNote>
      )}

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
 * **Four lines, in the order someone reads them:** who it is and who hears it,
 * what an agent says about it, the facts, then the setting. The previous card
 * stacked seven competing rows — title, mission, a loud green visibility
 * sentence, a reach stat, a second paragraph that restated the mission in
 * candidate words, a meta line, role-family pills, and a full-width "create a
 * team inside" divider — so nothing led and the two paragraphs read as
 * duplication.
 *
 * The mission and the candidate-facing description are genuinely two things (one
 * internal, one spoken), but a list is the wrong place to show both unlabelled.
 * The card shows what the **agent** would say, since that's what this workspace
 * is for; the drilldown shows both, labelled. Role families moved there too.
 *
 * One component for every tier — there is only one kind of thing now — so a
 * four-deep org draws itself with no new code.
 */
function TeamBranch({ company, team }: { company: Company; team: Team }) {
  const children = childTeams(company, team.id)
  const depth = teamPath(company, team.id).length - 1
  const because = team.createdBecauseJobId
    ? company.jobs.find((j) => j.id === team.createdBecauseJobId)
    : null

  // Not a statistic — the audience. A candidate only ever hears about the teams
  // their own role sits under, so this is exactly who this team's knowledge can
  // reach, and zero means nobody.
  const reach = jobsUnderTeam(company, team.id)
  const reachLabel =
    reach.length === 0
      ? "No role sits under this"
      : `${reach.length} role${reach.length === 1 ? "" : "s"}`

  return (
    <div style={{ paddingLeft: depth > 0 ? "1.5rem" : undefined }}>
      <section className="space-y-2 rounded-lg border border-border p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <Link
            href={`/companies/${company.id}?section=teams&team=${team.id}`}
            className="inline-flex items-center gap-2 font-medium hover:underline"
          >
            <Users className="size-4 shrink-0 text-muted-foreground" />
            {team.name}
          </Link>
          <span
            className={cn(
              "shrink-0 text-xs",
              reach.length === 0
                ? "text-amber-700 dark:text-amber-300"
                : "text-muted-foreground"
            )}
          >
            {reachLabel}
          </span>
        </div>

        <p className="text-sm text-muted-foreground">
          {team.description ?? team.mission}
        </p>

        <p className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {team.sizeRange && <span>{team.sizeRange} people</span>}
          {team.operatingModel && <span>{team.operatingModel}</span>}
          {because && <span>Created for {because.title}</span>}
        </p>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2">
          <ItemVisibility
            idPrefix={draftKey.team(team.id)}
            visibility={team.visibility}
            label={team.name}
            audienceNote={
              reach.length === 0
                ? "— but no role sits under this, so no candidate hears it"
                : `on ${reachLabel}`
            }
          />
          <Button variant="ghost" size="xs" className="gap-1 text-xs text-muted-foreground">
            <Plus className="size-3" />
            Nested team
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
          idPrefix={draftKey.team(team.id)}
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

      {team.commonRoleFamilies.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {team.commonRoleFamilies.map((r) => (
            <Badge key={r} variant="secondary">
              {r}
            </Badge>
          ))}
        </div>
      )}

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
