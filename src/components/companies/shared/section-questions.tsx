"use client"

import * as React from "react"
import { Ban, ChevronRight, MessageCircleQuestion, Plus, ShieldAlert } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useDraftField } from "@/components/companies/company-draft-context"
import {
  EditablePills,
  EditableTextarea,
} from "@/components/companies/shared/editable-field"
import { useFieldScope } from "@/components/companies/shared/field-scope"
import { TrustWarning } from "@/components/companies/shared/trust-warning"
import { VisibilitySentence } from "@/components/companies/shared/visibility-sentence"
import { useVisibilityDraft } from "@/components/companies/shared/use-visibility-draft"
import { formatDate } from "@/lib/constants"
import { isUnanswered } from "@/lib/company-readiness"
import { FAQ_CATEGORY_LABELS, type FaqEntry } from "@/lib/mock-companies"

/**
 * "What candidates ask" — the questions belonging to *this* section, folded in
 * beneath the facts they're about.
 *
 * There is no separate FAQ library. Editing the benefits fields and editing the
 * answer to "what benefits do you offer?" is one job; splitting them across two
 * destinations meant a recruiter updated one and forgot the other, which is how
 * an agent ends up confidently stating last year's policy.
 *
 * Unanswered questions are **the same rows with an empty answer**, sorted to the
 * top and opened on arrival. They are not filed here after the fact by anyone —
 * `faqSection()` routes them the moment a candidate asks, so the question is
 * already sitting next to the facts that answer it.
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
  // Unanswered first, most-asked first within each half — the only ordering that
  // survives a section with twelve questions in it.
  const ordered = React.useMemo(
    () =>
      [...entries].sort((a, b) => {
        const gap = Number(isUnanswered(b)) - Number(isUnanswered(a))
        return gap !== 0 ? gap : b.askedCount - a.askedCount
      }),
    [entries]
  )
  const unansweredCount = ordered.filter(isUnanswered).length

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
          {unansweredCount > 0 && (
            <span className="text-xs font-normal text-amber-700 dark:text-amber-300">
              {unansweredCount} unanswered
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
          {ordered.map((entry) => (
            <QuestionRow key={entry.id} entry={entry} today={today} />
          ))}
        </div>
      )}
    </section>
  )
}

/**
 * One question, answered or not — **the same row in the section and in the
 * Unanswered inbox**, bound to the same draft keys.
 *
 * That sameness is the point: answering from the inbox and answering from the
 * section are one edit, so nothing has to "move back" to a section afterwards.
 * The row was in its section the whole time; answering it only drops it out of
 * the inbox's filter.
 */
export function QuestionRow({
  entry,
  today,
  sectionLabel,
}: {
  entry: FaqEntry
  today: Date
  /** Set only in the inbox, where you can't tell which section a row lands in. */
  sectionLabel?: string
}) {
  const unanswered = isUnanswered(entry)
  // An unanswered row opens on arrival: the answer box is the only reason to be
  // looking at it, and making someone click a disclosure to reach it is the kind
  // of ceremony that turns a two-minute job into a deferred one.
  const [open, setOpen] = React.useState(unanswered)
  const visibility = useVisibilityDraft(
    `faq-${entry.id}`,
    entry.visibility,
    entry.questionIntent
  )

  const waitScope = useFieldScope(`${entry.questionIntent} — waiting on the client`)
  const [askedClientAt, setAskedClientAt] = useDraftField(
    `faq-${entry.id}-asked-client`,
    entry.askedClientAt ?? "",
    waitScope
  ) as readonly [string, (next: string) => void]

  const handedOff = visibility.agentUse === "escalate"

  return (
    <div
      className={cn(
        "rounded-lg border border-border",
        unanswered && !handedOff && "border-amber-300 dark:border-amber-900"
      )}
    >
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

        {sectionLabel && (
          <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
            {sectionLabel}
          </span>
        )}

        <span className="shrink-0 text-xs text-muted-foreground">
          asked {entry.askedCount}×
          {unanswered && (
            <span
              className={cn(
                "ml-1",
                !handedOff && !askedClientAt && "text-amber-700 dark:text-amber-300"
              )}
            >
              ·{" "}
              {handedOff
                ? "handed to a recruiter"
                : askedClientAt
                  ? `waiting on the client since ${formatDate(askedClientAt)}`
                  : "no answer yet"}
            </span>
          )}
        </span>
      </button>

      {open && (
        <div className="space-y-4 border-t border-border p-4">
          <Field label={unanswered ? "Write the answer" : "What the agent says"}>
            <EditableTextarea
              fieldKey={`faq-${entry.id}-answer`}
              value={entry.approvedAnswer}
              label={entry.questionIntent}
              ariaLabel={`Answer to ${entry.questionIntent}`}
              placeholder="Nothing written yet — the agent hands this question back to you until there is."
              rows={3}
            />
          </Field>

          {unanswered ? (
            <UnansweredActions
              askedClientAt={askedClientAt}
              onAskClient={(next) => setAskedClientAt(next)}
              handedOff={handedOff}
              onHandOff={(next) =>
                visibility.onChange({
                  clearance: visibility.clearance,
                  agentUse: next ? "escalate" : "on_request",
                })
              }
              today={today}
              lastAskedAt={entry.lastAskedAt}
            />
          ) : (
            <AnsweredDetail entry={entry} today={today} visibility={visibility} />
          )}
        </div>
      )}
    </div>
  )
}

/**
 * The two ways out of an unanswered question that aren't writing the answer.
 *
 * Both are real states rather than bookkeeping. "Ask the client" records that
 * we're blocked on someone outside the tool and since when — the honest
 * replacement for an assignee field, which only ever named the account owner
 * already printed in the header. "Hand to a recruiter" isn't a dismissal: it
 * writes `agentUse: escalate`, so the agent gets defined behaviour on the topic
 * instead of a hole it will fall into again tomorrow.
 */
function UnansweredActions({
  askedClientAt,
  onAskClient,
  handedOff,
  onHandOff,
  today,
  lastAskedAt,
}: {
  askedClientAt: string
  onAskClient: (next: string) => void
  handedOff: boolean
  onHandOff: (next: boolean) => void
  today: Date
  lastAskedAt: string | null
}) {
  const todayIso = today.toISOString().slice(0, 10)

  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
      <Button
        size="sm"
        variant={askedClientAt ? "secondary" : "outline"}
        onClick={() => onAskClient(askedClientAt ? "" : todayIso)}
        title={askedClientAt ? "Stop waiting on the client" : undefined}
      >
        {askedClientAt
          ? `Waiting on the client since ${formatDate(askedClientAt)}`
          : "Ask the client"}
      </Button>

      <Button
        size="sm"
        variant={handedOff ? "secondary" : "ghost"}
        onClick={() => onHandOff(!handedOff)}
        title={
          handedOff
            ? "Let the agent answer this once it has an answer"
            : "The agent will route this topic to a recruiter instead of answering"
        }
      >
        {handedOff ? "Handed to a recruiter" : "Hand to a recruiter"}
      </Button>

      {lastAskedAt && (
        <span className="ml-auto text-xs text-muted-foreground">
          Last asked {formatDate(lastAskedAt)}
        </span>
      )}
    </div>
  )
}

function AnsweredDetail({
  entry,
  today,
  visibility,
}: {
  entry: FaqEntry
  today: Date
  visibility: ReturnType<typeof useVisibilityDraft>
}) {
  return (
    <>
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
    </>
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
