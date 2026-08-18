import {
  SectionEmpty,
  SectionShell,
} from "@/components/companies/workspace/section-shell"
import { FieldScopeProvider } from "@/components/companies/shared/field-scope"
import { QuestionRow } from "@/components/companies/shared/section-questions"
import { ALL_SECTIONS } from "@/components/companies/workspace/company-sections"
import type { SectionDef } from "@/components/companies/workspace/company-sections"
import {
  faqSection,
  unansweredQuestions,
  type CompanyReadiness,
} from "@/lib/company-readiness"
import { questionOf } from "@/lib/company-inheritance"
import type { Company } from "@/lib/mock-companies"

/**
 * Questions candidates asked that approved knowledge couldn't answer.
 *
 * **This is a filter, not a stage.** Every row here already lives in the section
 * that will answer it — sponsorship under Work authorization, quota under
 * Compensation — routed by `faqSection()` the moment a candidate asks. Nothing
 * gets filed anywhere when it's answered; the row simply stops matching the
 * filter. That's why the rows are literally the same component bound to the same
 * draft keys: answering here and answering in the section are one edit.
 *
 * The inbox earns its place in the rail because "what is my agent failing on?"
 * is a question you ask *without knowing which section owns the answer*. So each
 * row names the section it lands in, and its edits are scoped to that section —
 * a change made here shows up in the publish review under "Work authorization",
 * not under "Unanswered questions".
 *
 * What used to be here — a level picker, an assignee, and a five-state status
 * badge — is gone. None of it survived asking what a recruiter is actually doing
 * on this screen: writing an answer, or noting that they've asked the client for
 * one.
 */
export function UnansweredSection({
  company,
  section,
  readiness,
  today,
}: {
  company: Company
  section: SectionDef
  readiness: CompanyReadiness
  today: Date
}) {
  const open = unansweredQuestions(company)

  return (
    <SectionShell section={section} readiness={readiness}>
      {open.length === 0 ? (
        <SectionEmpty
          title="No unanswered questions"
          prompt="Anything a candidate asks that approved knowledge can't cover appears here, most-asked first, alongside the section that will answer it."
        />
      ) : (
        <div className="space-y-2">
          {open.map((entry) => {
            const catalog = questionOf(company, entry)
            const target = catalog ? faqSection(catalog.category) : "profile"
            return (
              <FieldScopeProvider key={entry.questionId} section={target}>
                <QuestionRow
                  company={company}
                  entry={entry}
                  today={today}
                  sectionLabel={sectionLabel(target)}
                />
              </FieldScopeProvider>
            )
          })}
        </div>
      )}
    </SectionShell>
  )
}

function sectionLabel(key: string): string {
  return ALL_SECTIONS.find((s) => s.key === key)?.label ?? key
}
