import Link from "next/link"
import { Ban, ChevronRight, Workflow } from "lucide-react"

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
 * **The process itself is a property of the job, not of the company.** Each job
 * snapshots its own pipeline at publish, so "the interview process" is a
 * different set of stages for every role — and a company-level section inviting
 * someone to write prose about it is inviting a sentence that is wrong for half
 * the roles. That's not a hypothetical: the derived answer
 * (`derivedAnswers` → `q-interview-process`) is built from a job's real stages
 * precisely so an agent can't describe a process the pipeline doesn't run.
 *
 * So this section leads with **the actual pipelines, per role**, read-only, and
 * keeps for itself only what genuinely holds across every hire here: what a
 * candidate is told when no role is in play, the standing prohibition, and how
 * reliably this client runs whatever it has agreed to.
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
      <ProcessByRole company={company} />

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

/**
 * The real pipelines, one per active role — **read-only here on purpose**.
 *
 * You edit a pipeline on the job, where publishing freezes it; showing an
 * editable copy at company level would be a second place to change something
 * that has exactly one owner. What this view is for is the comparison you can't
 * get anywhere else: three roles side by side, and whether they diverge on
 * purpose or by accident.
 *
 * It is also the honest answer to "why does this company section exist if the
 * process is per-job?" — the company answer above is the fallback for a
 * conversation with no role in play, and everything here overrides it.
 */
function ProcessByRole({ company }: { company: Company }) {
  const jobs = company.jobs.filter((j) => j.status === "open" || j.status === "draft")

  if (jobs.length === 0) return null

  return (
    <section className="space-y-2">
      <h3 className="flex items-center gap-2 text-sm font-medium">
        <Workflow className="size-4 text-muted-foreground" />
        The process, role by role
      </h3>
      <p className="text-xs text-muted-foreground">
        Each role runs its own pipeline, and that&apos;s what an agent describes to
        a candidate for that role. Anything written below is the fallback when no
        role is in play.
      </p>

      <ul className="divide-y divide-border rounded-lg border border-border">
        {jobs.map((job) => (
          <li key={job.id} className="space-y-1 p-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <Link
                href={`/companies/${company.id}?section=jobs&job=${job.id}`}
                className="text-sm font-medium hover:underline"
              >
                {job.title}
              </Link>
              <span className="text-xs text-muted-foreground">
                {job.interviewStages.length > 0
                  ? `${job.interviewStages.length} stages`
                  : "No pipeline yet"}
              </span>
            </div>

            {job.interviewStages.length > 0 ? (
              <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-muted-foreground">
                {job.interviewStages.map((stage, i) => (
                  <span key={stage} className="inline-flex items-center gap-1.5">
                    {i > 0 && <ChevronRight className="size-3 shrink-0 opacity-60" />}
                    {stage}
                  </span>
                ))}
              </p>
            ) : (
              <p className="text-xs text-amber-700 dark:text-amber-300">
                No stages yet, so the agent falls back to whatever is written
                below — which may not be what this role actually runs.
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
