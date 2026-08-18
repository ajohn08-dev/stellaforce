import { KnowledgeCard } from "@/components/companies/shared/knowledge-card"
import { SectionQuestions } from "@/components/companies/shared/section-questions"
import {
  SectionEmpty,
  SectionShell,
} from "@/components/companies/workspace/section-shell"
import type { SectionDef } from "@/components/companies/workspace/company-sections"
import {
  questionsForSection,
  knowledgeSection,
  type CompanyReadiness,
} from "@/lib/company-readiness"
import {
  KNOWLEDGE_KIND_PROMPTS,
  narrativeItems,
  type Company,
} from "@/lib/mock-companies"

/**
 * The candidate-safe knowledge blocks belonging to one section — **What they
 * do**, **Culture & working style**, and **Why join** all use this,
 * differing only in which `KnowledgeKind`s route to them (`knowledgeSection()`).
 *
 * The questions candidates ask about this topic sit underneath the facts, since
 * editing the fact and editing the answer about that fact is one job.
 */
export function NarrativeSection({
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
  const items = narrativeItems(company).filter(
    (k) => knowledgeSection(k.kind) === section.key
  )
  const written = items.filter((k) => k.body.trim())
  const questions = questionsForSection(company, section.key)

  return (
    <SectionShell section={section} readiness={readiness} bulkItems={items.map((k) => ({ key: `knowledge-${k.id}`, label: k.title, visibility: k.visibility }))}>
      {items.length === 0 ? (
        <SectionEmpty
          title="Nothing here yet"
          prompt="Until something is published here, agents will escalate every question on this topic."
          actionLabel="Add the first block"
        />
      ) : (
        <>
          {written.length === 0 && (
            <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
              Nothing approved for candidates yet. Agents will escalate every question
              on this topic until at least one block is published.
            </p>
          )}

          <div className="space-y-3">
            {items.map((item) => (
              <KnowledgeCard
                key={item.id}
                item={item}
                prompt={KNOWLEDGE_KIND_PROMPTS[item.kind]}
                today={today}
              />
            ))}
          </div>
        </>
      )}

      <SectionQuestions
        company={company}
        entries={questions}
        today={today}
        emptyPrompt="No recorded questions on this topic yet. When a candidate asks something the blocks above don't cover, it lands in Unanswered questions and you can add it here."
      />
    </SectionShell>
  )
}
