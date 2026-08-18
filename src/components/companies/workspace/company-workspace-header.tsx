import Link from "next/link"
import { ExternalLink, Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { CompanyLogo } from "@/components/companies/company-logo"
import { LinkedinIcon } from "@/components/icons/brand-icons"
import { ReadinessPill } from "@/components/companies/shared/readiness-pill"
import { PublishButton } from "@/components/companies/workspace/publish-bar"
import type { CompiledAgentContext } from "@/lib/company-agent-context"
import { READINESS_SUMMARY, type CompanyReadiness } from "@/lib/company-readiness"
import {
  COMPANY_STAGE_LABELS,
  OPERATING_MODEL_LABELS,
  type Company,
} from "@/lib/mock-companies"

/**
 * Identity and actions. Nothing else.
 *
 * A header answers *who is this, and what can I do here*. Status is neither, and
 * every status signal that used to sit here already had a better home:
 *
 *  - the readiness sentence duplicated the warning inside the very section that
 *    would fix it, and the rail badge pointing at that section;
 *  - "4 unanswered" duplicated the rail's inbox;
 *  - the two completeness meters said how far along the profile is without
 *    saying where to act — which the rail badges do, precisely;
 *  - "last verified" was a company-wide roll-up of a per-item field.
 *
 * They accumulated here because each surface I removed elsewhere spilled its
 * contents upward. Four rows of chrome sat above the content on a page whose
 * content already scrolls in a fixed viewport.
 *
 * The readiness pill stays — one chip, the same role `JobStatusBadge` plays on a
 * job — and carries the explanation in its tooltip for anyone who wants the
 * detail without navigating.
 *
 * **Publish is the primary action** and sits last: it's the one thing that
 * changes what candidates hear. There is deliberately no "Deploy agent" — agents
 * attach to a job stage, never to a company, so publishing is already what makes
 * this knowledge available to them.
 */
export function CompanyWorkspaceHeader({
  company,
  readiness,
  agentContext,
}: {
  company: Company
  readiness: CompanyReadiness
  agentContext: CompiledAgentContext
}) {
  const facts = [
    company.industry,
    company.stage ? COMPANY_STAGE_LABELS[company.stage] : null,
    company.headquarters,
    company.employeeRange ? `${company.employeeRange} employees` : null,
    company.operatingModel ? OPERATING_MODEL_LABELS[company.operatingModel] : null,
  ].filter(Boolean) as string[]

  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex min-w-0 items-start gap-3">
        <CompanyLogo
          name={company.preferredName}
          logoPath={company.logoPath}
          size="lg"
        />

        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              {company.preferredName}
            </h1>
            <Tooltip>
              <TooltipTrigger
                render={
                  <span tabIndex={0} className="inline-flex">
                    <ReadinessPill status={readiness.status} size="sm" />
                  </span>
                }
              />
              <TooltipContent className="max-w-xs">
                {readiness.status === "ready"
                  ? READINESS_SUMMARY.ready
                  : readiness.headline}
              </TooltipContent>
            </Tooltip>
          </div>

          <p className="text-sm text-muted-foreground">
            {facts.join(" · ")}
            {company.website && (
              <>
                {facts.length > 0 && " · "}
                <a
                  href={company.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 hover:text-foreground hover:underline"
                >
                  {company.website.replace(/^https?:\/\//, "")}
                  <ExternalLink className="size-3 shrink-0" />
                </a>
              </>
            )}
            {company.linkedinUrl && (
              <>
                {" · "}
                <a
                  href={company.linkedinUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 hover:text-foreground hover:underline"
                >
                  <LinkedinIcon className="size-3 shrink-0" />
                  LinkedIn
                </a>
              </>
            )}
            {` · Owner: ${company.accountOwner}`}
          </p>
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          render={<Link href="/jobs" />}
        >
          <Plus className="size-4" />
          Create job
        </Button>

        <PublishButton
          context={agentContext}
          readiness={readiness}
          versions={company.versions}
        />
      </div>
    </div>
  )
}
