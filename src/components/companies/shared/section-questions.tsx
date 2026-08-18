"use client"

import * as React from "react"
import { Ban, ChevronRight, MessageCircleQuestion, Plus, ShieldAlert } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  EditablePills,
  EditableTextarea,
} from "@/components/companies/shared/editable-field"
import { TrustWarning } from "@/components/companies/shared/trust-warning"
import { VisibilitySentence } from "@/components/companies/shared/visibility-sentence"
import { useVisibilityDraft } from "@/components/companies/shared/use-visibility-draft"
import { FAQ_CATEGORY_LABELS, type FaqEntry } from "@/lib/mock-companies"

/**
 * "What candidates ask" — the questions belonging to *this* section, folded in
 * beneath the facts they're about.
 *
 * There is no separate FAQ library. Editing the benefits fields and editing the
 * answer to "what benefits do you offer?" is one job; splitting them across two
 * destinations meant a recruiter updated one and forgot the other, which is how
 * an agent ends up confidently stating last year's policy.
 */
export function SectionQuestions({
  entries,
  today,
  emptyPrompt,
}: {
  entries: FaqEntry[]
  today: Date
  emptyPrompt: string
}) {
  return (
    <section className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-medium">
          <MessageCircleQuestion className="size-4 text-muted-foreground" />
          What candidates ask
          {entries.length > 0 && (
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
              {entries.length}
            </span>
          )}
        </h3>
        <Button variant="ghost" size="sm" className="gap-1.5 text-xs">
          <Plus className="size-3.5" />
          Add a question
        </Button>
      </div>

      {entries.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
          {emptyPrompt}
        </p>
      ) : (
        <div className="space-y-2">
          {entries.map((entry) => (
            <QuestionRow key={entry.id} entry={entry} today={today} />
          ))}
        </div>
      )}
    </section>
  )
}

function QuestionRow({ entry, today }: { entry: FaqEntry; today: Date }) {
  const [open, setOpen] = React.useState(false)
  const visibility = useVisibilityDraft(
    `faq-${entry.id}`,
    entry.visibility,
    entry.questionIntent
  )

  return (
    <div className="rounded-lg border border-border">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2.5 p-3 text-left"
      >
        <ChevronRight
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-90"
          )}
        />
        <span className="min-w-0 flex-1 text-sm font-medium">
          {entry.questionIntent}
        </span>
        <span className="shrink-0 text-xs text-muted-foreground">
          asked {entry.askedCount}×
          {entry.unansweredCount > 0 && (
            <span className="ml-1 text-amber-700 dark:text-amber-300">
              · {entry.unansweredCount} follow-up
              {entry.unansweredCount === 1 ? "" : "s"} unanswered
            </span>
          )}
        </span>
      </button>

      {open && (
        <div className="space-y-4 border-t border-border p-4">
          <Field label="What the agent says">
            <EditableTextarea
              fieldKey={`faq-${entry.id}-answer`}
              value={entry.approvedAnswer}
              ariaLabel={`Answer to ${entry.questionIntent}`}
              rows={3}
            />
          </Field>

          <Field label="Candidates also ask it like this">
            <EditablePills
              fieldKey={`faq-${entry.id}-variants`}
              values={entry.questionVariants}
              addLabel="Add phrasing"
              ariaLabel="Question variants"
            />
          </Field>

          {entry.expandedAnswer !== null && (
            <Field label="If they ask for more">
              <EditableTextarea
                fieldKey={`faq-${entry.id}-expanded`}
                value={entry.expandedAnswer}
                ariaLabel="Expanded answer"
                rows={2}
              />
            </Field>
          )}

          {entry.escalationInstructions && (
            <div className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 dark:bg-amber-950/30">
              <ShieldAlert className="mt-0.5 size-4 shrink-0 text-amber-700 dark:text-amber-300" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-amber-900 dark:text-amber-200">
                  When to hand off instead
                </p>
                <p className="mt-0.5 text-sm text-amber-800 dark:text-amber-300">
                  {entry.escalationInstructions}
                </p>
              </div>
            </div>
          )}

          {entry.prohibitedClaims.length > 0 && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/[0.04] p-3">
              <p className="flex items-center gap-1.5 text-xs font-medium text-destructive">
                <Ban className="size-3.5" />
                Never say, however the question is phrased
              </p>
              <ul className="mt-2 space-y-1">
                {entry.prohibitedClaims.map((claim) => (
                  <li
                    key={claim}
                    className="flex items-start gap-2 text-sm text-muted-foreground"
                  >
                    <Ban className="mt-0.5 size-3 shrink-0 text-destructive" />
                    {claim}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <TrustWarning item={entry} today={today} />

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
            <VisibilitySentence
              clearance={visibility.clearance}
              agentUse={visibility.agentUse}
              onChange={visibility.onChange}
            />
            <span className="text-xs text-muted-foreground">
              {FAQ_CATEGORY_LABELS[entry.category]}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      {children}
    </div>
  )
}
