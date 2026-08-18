import { Ban } from "lucide-react"

import { InternalNoteCard } from "@/components/companies/shared/internal-note-card"
import { SectionQuestions } from "@/components/companies/shared/section-questions"
import { SectionShell } from "@/components/companies/workspace/section-shell"
import type { SectionDef } from "@/components/companies/workspace/company-sections"
import { questionsForSection, type CompanyReadiness } from "@/lib/company-readiness"
import { questionAnswers } from "@/lib/company-inheritance"
import { briefItems, type Company } from "@/lib/mock-companies"

/**
 * What an agent may say about how hiring works here.
 *
 * The standing prohibition sits at the bottom because this is the section most
 * likely to drift into commitment — "you'll hear back Thursday" is the easiest
 * promise for an agent to make and one of the worst to break.
 */
export function InterviewProcessSection({
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
  const questions = questionsForSection(company, section.key)

  // Internal notes about how reliably this client actually runs its process.
  const reliabilityNotes = briefItems(company).filter((n) =>
    /interview|process|reliab|schedul/i.test(n.title)
  )

  return (
    <SectionShell section={section} readiness={readiness} bulkItems={questionAnswers(company, questions)}>
      <SectionQuestions
        company={company}
        entries={questions}
        today={today}
        emptyPrompt="Nothing recorded yet. Candidates ask about the process in nearly every screen — without an answer here, agents escalate a question you could answer once and reuse forever."
      />

      <p className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/[0.04] p-3 text-sm text-destructive">
        <Ban className="mt-0.5 size-4 shrink-0" />
        <span>
          The agent may never promise an interview, an offer, a hiring decision, or a
          specific date.
          <span className="mt-0.5 block text-xs opacity-80">
            This holds regardless of what the answers above say. It can&apos;t be
            switched off.
          </span>
        </span>
      </p>

      {reliabilityNotes.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-sm font-medium">
            How reliably this client runs it — internal
          </h3>
          {reliabilityNotes.map((note) => (
            <InternalNoteCard key={note.id} item={note} />
          ))}
        </section>
      )}
    </SectionShell>
  )
}
