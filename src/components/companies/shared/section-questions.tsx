"use client"

import * as React from "react"
import { Ban, ChevronRight, Lock, MessageCircleQuestion, Plus, ShieldAlert } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
import {
  answerStack,
  availableScopes,
  companyQuestions,
  effectiveProhibitions,
  isUnanswered,
  jobsInScope,
  questionOf,
  resolveAnswer,
  stackDepth,
  withDerived,
  type Answer,
  type AnswerScope,
  type CompanyQuestion,
  type ResolvedAnswer,
  type ResolvedScope,
} from "@/lib/company-inheritance"
import { FAQ_CATEGORY_LABELS, type Company } from "@/lib/mock-companies"
import type { Question } from "@/lib/question-catalog"

/**
 * "What candidates ask" — the questions belonging to *this* section, folded in
 * beneath the facts they're about.
 *
 * There is no separate FAQ library. Editing the benefits fields and editing the
 * answer to "what benefits do you offer?" is one job; splitting them across two
 * destinations meant a recruiter updated one and forgot the other, which is how
 * an agent ends up confidently stating last year's policy.
 *
 * The **question** is global and the **answers** are scoped — see
 * `src/lib/company-inheritance.ts`. On screen that shows up as an indented
 * stack: the company answer, then any team or role that answers differently,
 * with the narrowest one marked as the winner. Indentation carries the
 * explanation; nobody has to learn the word "scope".
 */
export function SectionQuestions({
  company,
  entries,
  today,
  emptyPrompt,
}: {
  company: Company
  entries: CompanyQuestion[]
  today: Date
  emptyPrompt: string
}) {
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
            <QuestionRow
              key={entry.questionId}
              company={company}
              entry={entry}
              today={today}
            />
          ))}
        </div>
      )}
    </section>
  )
}

/**
 * One question and every answer written for it — **the same row in a section, in
 * the Unanswered inbox, and on a job**, bound to the same draft keys.
 */
export function QuestionRow({
  company,
  entry,
  today,
  sectionLabel,
}: {
  company: Company
  entry: CompanyQuestion
  today: Date
  /** Set only in the inbox, where you can't tell which section a row lands in. */
  sectionLabel?: string
}) {
  const catalog = questionOf(company, entry)
  const unanswered = isUnanswered(entry)
  const [open, setOpen] = React.useState(unanswered)

  // Scopes the recruiter has chosen to answer at during this session. UI-only:
  // a real publish would create the answer row.
  const [addedScopes, setAddedScopes] = React.useState<ResolvedScope[]>([])

  const stack = answerStack(company, entry)
  const winning = stack.at(-1) ?? null

  const waitScope = useFieldScope(`${catalog?.intent ?? entry.questionId} — waiting on the client`)
  const [askedClientAt, setAskedClientAt] = useDraftField(
    `faq-${entry.questionId}-asked-client`,
    entry.askedClientAt ?? "",
    waitScope
  ) as readonly [string, (next: string) => void]

  if (!catalog) return null

  return (
    <div
      className={cn(
        "rounded-lg border border-border",
        unanswered && "border-amber-300 dark:border-amber-900"
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
        <span className="min-w-0 flex-1 text-sm font-medium">{catalog.intent}</span>

        {sectionLabel && (
          <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
            {sectionLabel}
          </span>
        )}

        <span className="shrink-0 text-xs text-muted-foreground">
          asked {entry.askedCount}×
          {unanswered ? (
            <span className={cn("ml-1", !askedClientAt && "text-amber-700 dark:text-amber-300")}>
              ·{" "}
              {askedClientAt
                ? `waiting on the client since ${formatDate(askedClientAt)}`
                : "no answer yet"}
            </span>
          ) : (
            stack.length > 1 && (
              <span className="ml-1">
                · {stack.length - 1} override{stack.length === 2 ? "" : "s"}
              </span>
            )
          )}
        </span>
      </button>

      {open && (
        <div className="space-y-4 border-t border-border p-4">
          <AnswerStack
            company={company}
            entry={entry}
            catalog={catalog}
            stack={stack}
            addedScopes={addedScopes}
            onAddScope={(scope) => setAddedScopes((prev) => [...prev, scope])}
          />

          {unanswered ? (
            <UnansweredActions
              askedClientAt={askedClientAt}
              onAskClient={setAskedClientAt}
              today={today}
              lastAskedAt={entry.lastAskedAt}
            />
          ) : (
            <AnsweredDetail
              company={company}
              entry={entry}
              catalog={catalog}
              winning={winning}
              today={today}
            />
          )}
        </div>
      )}
    </div>
  )
}

/**
 * The stack — **the whole UI for inheritance**.
 *
 * Every answer written for this question, widest first, indented by how deep its
 * scope sits, with the narrowest marked as the one that wins. That indentation
 * plus one sentence *("The most specific answer wins")* is the entire
 * explanation, which is the point: a recruiter should never have to learn a
 * vocabulary of levels to understand what an agent will say.
 */
function AnswerStack({
  company,
  entry,
  catalog,
  stack,
  addedScopes,
  onAddScope,
}: {
  company: Company
  entry: CompanyQuestion
  catalog: Question
  stack: ResolvedAnswer[]
  addedScopes: ResolvedScope[]
  onAddScope: (scope: ResolvedScope) => void
}) {
  const answeredScopes = new Set(
    stack.map((s) => `${s.scope.kind}:${s.scope.refId ?? ""}`)
  )
  const pending = addedScopes.filter(
    (s) => !answeredScopes.has(`${s.kind}:${s.refId ?? ""}`)
  )

  // Anywhere that doesn't already have an answer, and isn't already open for
  // editing on this screen.
  const open = availableScopes(company).filter(
    (s) =>
      !answeredScopes.has(`${s.kind}:${s.refId ?? ""}`) &&
      !pending.some((p) => p.kind === s.kind && p.refId === s.refId)
  )

  return (
    <div className="space-y-2">
      {stack.length === 0 && pending.length === 0 && (
        <AnswerRow
          company={company}
          entry={entry}
          catalog={catalog}
          scope={{
            kind: "company",
            refId: null,
            label: "Everywhere",
            badge: "From company",
          }}
          answer={null}
          depth={0}
          wins
        />
      )}

      {stack.map((row, i) => (
        <AnswerRow
          key={row.answer.id}
          company={company}
          entry={entry}
          catalog={catalog}
          scope={row.scope}
          answer={row.answer}
          depth={stackDepth(company, row.scope)}
          wins={i === stack.length - 1}
        />
      ))}

      {pending.map((scope) => (
        <AnswerRow
          key={`${scope.kind}:${scope.refId}`}
          company={company}
          entry={entry}
          catalog={catalog}
          scope={scope}
          answer={null}
          depth={stackDepth(company, scope)}
          wins={false}
        />
      ))}

      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <p className="text-xs text-muted-foreground">
          The most specific answer wins.
        </p>

        {open.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="ghost" size="sm" className="gap-1.5 text-xs">
                  <Plus className="size-3.5" />
                  Answer differently…
                </Button>
              }
            />
            <DropdownMenuContent className="min-w-72">
              {open.map((scope) => {
                // The blast radius, at the moment of choosing. "For everyone in
                // Go-to-Market — 3 jobs" is a decision someone can make; "team
                // level" is a guess.
                const reach = jobsInScope(company, {
                  kind: scope.kind,
                  refId: scope.refId,
                }).length
                return (
                  <DropdownMenuItem
                    key={`${scope.kind}:${scope.refId}`}
                    onClick={() => onAddScope(scope)}
                    className="flex-col items-start gap-0.5"
                  >
                    <span>{scope.badge}</span>
                    <span className="text-xs text-muted-foreground">
                      {reach === 0
                        ? "No jobs yet"
                        : `${reach} job${reach === 1 ? "" : "s"}`}
                    </span>
                  </DropdownMenuItem>
                )
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  )
}

/** One row of the stack: where it applies, and the sentence the agent says there. */
function AnswerRow({
  company,
  entry,
  catalog,
  scope,
  answer,
  depth,
  wins,
}: {
  company: Company
  entry: CompanyQuestion
  catalog: Question
  scope: ResolvedScope
  answer: Answer | null
  depth: number
  wins: boolean
}) {
  const fieldKey = `faq-${entry.questionId}-${scope.kind}-${scope.refId ?? "all"}-answer`
  const reach = jobsInScope(company, { kind: scope.kind, refId: scope.refId }).length

  return (
    <div
      // Indent by depth so the tree is the explanation. Inline padding rather
      // than a Tailwind class: the depth is data, and arbitrary values in this
      // project have silently failed to generate before.
      style={{ paddingLeft: `${depth * 1.25}rem` }}
    >
      <div className="rounded-lg border border-border p-3">
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "rounded-md px-1.5 py-0.5 text-xs font-medium",
              scope.kind === "company"
                ? "bg-muted text-muted-foreground"
                : "bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300"
            )}
          >
            {scope.label}
          </span>
          {wins && answer && (
            <span className="text-xs text-muted-foreground">
              what the agent says
              {reach > 0 && scope.kind !== "company"
                ? ` for ${reach} job${reach === 1 ? "" : "s"}`
                : ""}
            </span>
          )}
        </div>

        <EditableTextarea
          fieldKey={fieldKey}
          value={answer?.body ?? ""}
          label={`${catalog.intent} — ${scope.label}`}
          ariaLabel={`Answer to ${catalog.intent} for ${scope.label}`}
          placeholder={
            scope.kind === "company"
              ? "Nothing written yet — the agent hands this question back to you until there is."
              : `Write the answer for ${scope.label}, or leave this empty to keep inheriting.`
          }
          rows={2}
        />
      </div>
    </div>
  )
}

/**
 * The two ways out of an unanswered question that aren't writing the answer.
 *
 * "Ask the client" records that we're blocked on someone outside the tool and
 * since when — the honest replacement for an assignee field. There's no
 * "hand to a recruiter" button any more: a sensitive question already arrives
 * from the catalog with an escalate posture, so an unanswered one is *already*
 * handed back, and a button claiming to do it was theatre.
 */
function UnansweredActions({
  askedClientAt,
  onAskClient,
  today,
  lastAskedAt,
}: {
  askedClientAt: string
  onAskClient: (next: string) => void
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

      {lastAskedAt && (
        <span className="ml-auto text-xs text-muted-foreground">
          Last asked {formatDate(lastAskedAt)}
        </span>
      )}
    </div>
  )
}

function AnsweredDetail({
  company,
  entry,
  catalog,
  winning,
  today,
}: {
  company: Company
  entry: CompanyQuestion
  catalog: Question
  winning: ResolvedAnswer | null
  today: Date
}) {
  const visibility = useVisibilityDraft(
    `faq-${entry.questionId}`,
    winning?.answer.visibility ?? {
      clearance: "cleared_for_candidates",
      agentUse: catalog.defaultAgentUse,
      state: "draft",
      source: "",
      verification: "unverified",
      lastVerifiedAt: null,
      verifiedBy: null,
      owner: "",
      reviewCadenceDays: null,
      nextReviewAt: null,
      isPresetDefault: true,
    },
    catalog.intent
  )

  const prohibitions = effectiveProhibitions(company, entry, catalog, {
    jobId: winning?.scope.kind === "job" ? winning.scope.refId : null,
    teamId: winning?.scope.kind === "team" ? winning.scope.refId : null,
  })
  const standing = new Set(catalog.prohibitions)

  return (
    <>
      <Field label="Candidates also ask it like this">
        <EditablePills
          fieldKey={`faq-${entry.questionId}-variants`}
          values={catalog.variants}
          addLabel="Add phrasing"
          ariaLabel="Question variants"
        />
      </Field>

      {winning?.answer.expandedAnswer && (
        <Field label="If they ask for more">
          <EditableTextarea
            fieldKey={`faq-${entry.questionId}-expanded`}
            value={winning.answer.expandedAnswer}
            ariaLabel="Expanded answer"
            rows={2}
          />
        </Field>
      )}

      {winning?.answer.escalationInstructions && (
        <div className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 dark:bg-amber-950/30">
          <ShieldAlert className="mt-0.5 size-4 shrink-0 text-amber-700 dark:text-amber-300" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-amber-900 dark:text-amber-200">
              When to hand off instead
            </p>
            <p className="mt-0.5 text-sm text-amber-800 dark:text-amber-300">
              {winning.answer.escalationInstructions}
            </p>
          </div>
        </div>
      )}

      {prohibitions.length > 0 && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/[0.04] p-3">
          <p className="flex items-center gap-1.5 text-xs font-medium text-destructive">
            <Ban className="size-3.5" />
            Never say, however the question is phrased
          </p>
          <ul className="mt-2 space-y-1">
            {prohibitions.map((claim) => (
              <li
                key={claim}
                className="flex items-start gap-2 text-sm text-muted-foreground"
              >
                {standing.has(claim) ? (
                  // Rule 2 made visible: catalog prohibitions accumulate onto
                  // every company and no scope can drop one.
                  <Lock
                    className="mt-0.5 size-3 shrink-0 text-destructive"
                    aria-label="Standing rule — applies at every company"
                  />
                ) : (
                  <Ban className="mt-0.5 size-3 shrink-0 text-destructive" />
                )}
                {claim}
              </li>
            ))}
          </ul>
          {[...standing].length > 0 && (
            <p className="mt-2 text-xs text-muted-foreground">
              Locked rules come with the question and apply at every company. A
              team or role can add to this list, never remove from it.
            </p>
          )}
        </div>
      )}

      {winning && <TrustWarning item={winning.answer} today={today} />}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
        <VisibilitySentence
          clearance={visibility.clearance}
          agentUse={visibility.agentUse}
          onChange={visibility.onChange}
        />
        <span className="text-xs text-muted-foreground">
          {FAQ_CATEGORY_LABELS[catalog.category]}
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

export type { AnswerScope }

/**
 * **What the agent will actually say on one job** — one line per question, the
 * resolved answer, and where it came from.
 *
 * This is the other half of the stack. In the company workspace you read the
 * cascade; standing on a job you want the opposite — no cascade at all, just the
 * answer and a badge saying which scope produced it. Both call `resolveAnswer`,
 * so the badge here and the winner marked over there cannot disagree.
 *
 * "Answer differently for this role" is the only way a job-scoped answer gets
 * created, and it opens *underneath the answer it replaces* — you can't write an
 * override without seeing what you're overriding.
 */
export function JobAnswers({
  company,
  jobId,
}: {
  company: Company
  jobId: string
}) {
  const [overriding, setOverriding] = React.useState<string[]>([])

  const job = company.jobs.find((j) => j.id === jobId) ?? null

  const rows = companyQuestions(company)
    .map((raw) => {
      const entry = withDerived(company, raw, job)
      return {
        entry,
        catalog: questionOf(company, entry),
        hit: resolveAnswer(company, entry, { jobId }),
      }
    })
    .filter((r) => r.catalog && r.hit)

  if (rows.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
        No answers reach this role yet. Anything written at the company or on a
        team above it will appear here.
      </p>
    )
  }

  return (
    <ul className="divide-y divide-border rounded-lg border border-border">
      {rows.map(({ entry, catalog, hit }) => {
        // A derived answer sits at job scope but nobody wrote it, so it must not
        // wear the "Set for this role" badge — that would claim a deliberate
        // override where there's only a mirrored field.
        const derived = Boolean(hit!.answer.derivedFrom)
        const own = hit!.scope.kind === "job" && !derived
        const isOverriding = overriding.includes(entry.questionId)

        return (
          <li key={entry.questionId} className="space-y-1.5 p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <p className="min-w-0 text-sm font-medium">{catalog!.intent}</p>
              <span
                className={cn(
                  "shrink-0 rounded-md px-1.5 py-0.5 text-xs",
                  own
                    ? "bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {derived ? "From this role's own fields" : hit!.scope.badge}
              </span>
            </div>

            <p className="text-sm text-muted-foreground">{hit!.answer.body}</p>

            {hit!.answer.derivedFrom && (
              // Says plainly that nobody wrote this sentence — it mirrors a
              // field on the job and will follow it when it changes.
              <p className="text-xs text-muted-foreground">
                Written from {hit!.answer.derivedFrom}. Edit the field and this
                follows it.
              </p>
            )}

            {!own &&
              (isOverriding ? (
                <div className="pt-1">
                  <EditableTextarea
                    fieldKey={`faq-${entry.questionId}-job-${jobId}-answer`}
                    value=""
                    label={`${catalog!.intent} — this role`}
                    ariaLabel={`Answer to ${catalog!.intent} for this role`}
                    placeholder="Write the answer for this role. Leave it empty to keep inheriting."
                    rows={2}
                  />
                </div>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  className="-ml-2 text-xs text-muted-foreground"
                  onClick={() =>
                    setOverriding((prev) => [...prev, entry.questionId])
                  }
                >
                  Answer differently for this role
                </Button>
              ))}
          </li>
        )
      })}
    </ul>
  )
}
