import { Ban, Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { PolicyRow } from "@/components/companies/shared/policy-row"
import { RestrictedPanel } from "@/components/companies/shared/restricted-panel"
import { SectionQuestions } from "@/components/companies/shared/section-questions"
import { EditableText, FieldRow } from "@/components/companies/shared/editable-field"
import {
  FieldCard,
  SectionEmpty,
  SectionShell,
} from "@/components/companies/workspace/section-shell"
import type { SectionDef } from "@/components/companies/workspace/company-sections"
import { faqSection, type CompanyReadiness } from "@/lib/company-readiness"
import type { Company, PolicyGroup } from "@/lib/mock-companies"

/**
 * One group of policies — **Locations & work model**, **Benefits**, **Work
 * authorization**, or **Compensation approach** — with the questions candidates
 * ask about them folded in underneath.
 *
 * Work authorization gets two extra things no other group needs: the standing
 * prohibition, rendered as a locked footnote so it reads as a property of the
 * system rather than a setting someone chose; and the restricted counsel panel.
 */
export function PolicySection({
  company,
  section,
  readiness,
  groups,
  today,
  standingProhibition,
  restrictedKeys = [],
  emptyPrompt,
  questionsEmptyPrompt,
}: {
  company: Company
  section: SectionDef
  readiness: CompanyReadiness
  /** Which `PolicyGroup`s belong to this section. */
  groups: PolicyGroup[]
  today: Date
  standingProhibition?: string
  /** Policy keys to render inside the restricted panel instead of inline. */
  restrictedKeys?: string[]
  emptyPrompt: string
  questionsEmptyPrompt: string
}) {
  const inGroup = company.policies.filter((p) => groups.includes(p.group))
  const visible = inGroup.filter((p) => !restrictedKeys.includes(p.key))
  const restricted = company.policies.filter((p) => restrictedKeys.includes(p.key))
  const questions = company.faq.filter((f) => faqSection(f.category) === section.key)

  return (
    <SectionShell
      section={section}
      readiness={readiness}
      bulkItems={visible}
      actions={
        <Button variant="outline" size="sm" className="gap-1.5">
          <Plus className="size-3.5" />
          Add
        </Button>
      }
    >
      {visible.length === 0 ? (
        <SectionEmpty
          title="Nothing set yet"
          prompt={emptyPrompt}
          actionLabel="Add a policy"
        />
      ) : (
        <FieldCard>
          {visible.map((policy) => (
            <PolicyRow key={policy.id} policy={policy} today={today} />
          ))}
        </FieldCard>
      )}

      {standingProhibition && (
        <p className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/[0.04] p-3 text-sm text-destructive">
          <Ban className="mt-0.5 size-4 shrink-0" />
          <span>
            {standingProhibition}
            <span className="mt-0.5 block text-xs opacity-80">
              This holds regardless of how the fields above are set. It can&apos;t be
              switched off.
            </span>
          </span>
        </p>
      )}

      <SectionQuestions
        entries={questions}
        today={today}
        emptyPrompt={questionsEmptyPrompt}
      />

      {restricted.length > 0 && (
        <RestrictedPanel
          title="Internal policy notes"
          reason="Counsel guidance, legal restrictions, and per-requisition budget. Never enters agent context."
        >
          <div className="divide-y divide-border">
            {restricted.map((p) => (
              <FieldRow key={p.id} label={p.label}>
                <EditableText
                  fieldKey={`policy-${p.id}-internal`}
                  value={p.value}
                  placeholder="Not recorded"
                  ariaLabel={p.label}
                />
              </FieldRow>
            ))}
          </div>
        </RestrictedPanel>
      )}
    </SectionShell>
  )
}
