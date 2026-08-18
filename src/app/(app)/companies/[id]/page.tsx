import { notFound } from "next/navigation"

import { CompanyWorkspaceHeader } from "@/components/companies/workspace/company-workspace-header"
import { CompanyWorkspaceNav } from "@/components/companies/workspace/company-workspace-nav"
import { SectionRouter } from "@/components/companies/workspace/section-router"
import { SetCompanyBreadcrumb } from "@/components/companies/workspace/set-company-breadcrumb"
import { UnsavedChangesGuard } from "@/components/companies/workspace/unsaved-changes-guard"
import {
  findSection,
  INTERNAL_SECTIONS,
} from "@/components/companies/workspace/company-sections"
import { compileAgentContext } from "@/lib/company-agent-context"
import {
  evaluateReadiness,
  gapCountsBySection,
  attentionSections,
  type CompanySection,
} from "@/lib/company-readiness"
import { briefItems, getMockCompany } from "@/lib/mock-companies"

/**
 * The Company Profile workspace — see COMPANY.md § B.3.
 *
 * A thin server shell: it computes readiness and the compiled agent context,
 * resolves `?section` (plus any drilldown param), and hands everything down as
 * data. Same split `/jobs/[id]` uses with `src/lib/job-pulse.ts` — the judgement
 * lives in `src/lib/`, the components only render.
 */
export default async function CompanyWorkspacePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const [{ id }, sp] = await Promise.all([params, searchParams])
  const company = getMockCompany(id)
  if (!company) notFound()

  const param = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined)

  // TODO: gate on `can(profile, ...)` once a company-brief capability exists.
  // Stellaforce-side staff pass every gate the app currently defines.
  const canViewInternal = true

  const requested = findSection(param("section"))
  // Falling back rather than 404-ing: a link to an internal section shared with
  // someone who can't see it should land them somewhere useful, not on an error
  // page that confirms the section exists.
  const section =
    !canViewInternal && INTERNAL_SECTIONS.includes(requested.key)
      ? findSection("profile")
      : requested

  const today = new Date()
  const readiness = evaluateReadiness(company, today)
  const agentContext = compileAgentContext(company, null)

  const counts: Partial<Record<CompanySection, number>> = {
    teams: company.departments.length,
    jobs: company.jobs.filter((j) => j.status === "open" || j.status === "draft").length,
    brief: briefItems(company).length,
  }

  return (
    <div
      className="overflow-hidden p-4"
      // Matches the candidate profile shell: <main> has no padding of its own, so
      // only the app header (h-14 = 3.5rem) is subtracted; this div's p-4 is
      // inside that height via border-box. Fixed (not min-) height so the company
      // header stays put and only the section body scrolls. Inline style rather
      // than an arbitrary Tailwind class — this project has already had one
      // bracketed arbitrary value silently fail to generate.
      style={{ height: "calc(100vh - 3.5rem)" }}
    >
      <div className="flex h-full flex-col gap-5 overflow-hidden rounded-lg border border-border bg-white p-4 dark:bg-background">
        <SetCompanyBreadcrumb name={company.preferredName} />
        <UnsavedChangesGuard companyId={company.id} />

        <div className="shrink-0">
          <CompanyWorkspaceHeader
            company={company}
            readiness={readiness}
            agentContext={agentContext}
          />
        </div>

        {/* Column on narrow viewports so the nav trigger sits above the section
            rather than beside it; row from `lg` up, where the rail is persistent. */}
        <div className="flex min-h-0 flex-1 flex-col gap-3 border-t border-border pt-4 lg:flex-row lg:gap-0">
          <CompanyWorkspaceNav
            companyId={company.id}
            active={section.key}
            gaps={gapCountsBySection(readiness)}
            attention={attentionSections(readiness)}
            counts={counts}
            canViewInternal={canViewInternal}
          />

          <div className="min-h-0 min-w-0 flex-1 overflow-y-auto lg:border-l lg:border-border lg:pl-6">
            <SectionRouter
              company={company}
              section={section}
              readiness={readiness}
              today={today}
              drill={{ team: param("team"), job: param("job") }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
