import { ActivityRow } from "@/components/companies/shared/activity-row"
import {
  SectionEmpty,
  SectionShell,
} from "@/components/companies/workspace/section-shell"
import type { SectionDef } from "@/components/companies/workspace/company-sections"
import type { CompanyReadiness } from "@/lib/company-readiness"
import type { Company } from "@/lib/mock-companies"

/**
 * The company-wide roll-up of the same events the per-item audit drawer shows.
 * Append-only — there is deliberately no edit or delete affordance anywhere on
 * this page.
 */
export function ActivitySection({
  company,
  section,
  readiness,
}: {
  company: Company
  section: SectionDef
  readiness: CompanyReadiness
}) {
  return (
    <SectionShell section={section} readiness={readiness}>
      {company.activity.length === 0 ? (
        <SectionEmpty
          title="No changes recorded yet"
          prompt="Edits, verifications, promotions, and agent deployments land here as they happen."
        />
      ) : (
        <ol className="-mx-2 rounded-lg border border-border px-2 py-1">
          {company.activity.map((entry) => (
            <ActivityRow key={entry.id} entry={entry} />
          ))}
        </ol>
      )}
    </SectionShell>
  )
}
