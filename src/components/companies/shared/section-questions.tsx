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
import { SectionNote } from "@/components/companies/shared/section-note"
import { formatDate } from "@/lib/constants"
import { draftKey } from "@/lib/company-draft-keys"
import {
  answerStack,
  appliesToJob,
  askCount,
  lastAsked,
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
import { FAQ_CATEGORY_LABELS, type Company, type CompanyJob } from "@/lib/mock-companies"
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
        return gap !== 0 ? gap : askCount(b) - askCount(a)
      }),
    [entries]
  )
  // Split, because they mean different things: a candidate asked and we had
  // nothing (act on it) versus the catalog offers it and nobody here has been
  // asked (write it when you have it).
  const gapCount = ordered.filter((q) => isUnanswered(q) && askCount(q) > 0).length
  const promptCount = ordered.filter((q) => isUnanswered(q) && askCount(q) === 0).length

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
          {gapCount > 0 && (
            <span className="text-xs font-normal text-amber-700 dark:text-amber-300">
              {gapCount} unanswered
            </span>
          )}
          {promptCount > 0 && (
            <span className="text-xs font-normal text-muted-foreground">
              {promptCount} not asked yet
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
  job,
  sectionLabel,
}: {
  company: Company
  entry: CompanyQuestion
  today: Date
  /** Set for a job-only question: the role this row is about. */
  job?: CompanyJob | null
  /** Set only in the inbox, where you can't tell which section a row lands in. */
  sectionLabel?: string
}) {
  const catalog = questionOf(company, entry)
  const unanswered = isUnanswered(entry)

  // A question nobody has asked here is a prompt from the catalog, not a gap a
  // candidate fell into. Rendering the two identically — amber border, "no
  // answer yet" — made a brand-new company look like it was failing candidates
  // it had never spoken to, and taught people to ignore the colour.
  // Counted for *this row's* scope: on a job row, asks on that role; in a
  // company section, asks anywhere.
  const asks = askCount(entry, job ? job.id : undefined)
  const neverAsked = asks === 0
  const [open, setOpen] = React.useState(unanswered && !neverAsked)

  // Scopes the recruiter has chosen to answer at during this session. UI-only:
  // a real publish would create the answer row.
  const [addedScopes, setAddedScopes] = React.useState<ResolvedScope[]>([])

  // Scoped to one role when the row is about one role, so the stack shows that
  // job's answers rather than every job's.
  const stack = answerStack(company, entry).filter(
    (row) => !job || row.scope.kind !== "job" || row.scope.refId === job.id
  )
  const winning = stack.at(-1) ?? null

  const waitScope = useFieldScope(`${catalog?.intent ?? entry.questionId} — waiting on the client`)
  const [askedClientAt, setAskedClientAt] = useDraftField(
    draftKey.askedClient(entry.questionId),
    entry.askedClientAt ?? "",
    waitScope
  ) as readonly [string, (next: string) => void]

  if (!catalog) return null

  return (
    <div
      className={cn(
        "rounded-lg border border-border",
        unanswered && !neverAsked && "border-amber-300 dark:border-amber-900"
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
          {neverAsked ? "not asked here yet" : `asked ${asks}×`}
          {unanswered ? (
            neverAsked ? null : (
              <span
                className={cn("ml-1", !askedClientAt && "text-amber-700 dark:text-amber-300")}
              >
                ·{" "}
                {askedClientAt
                  ? `waiting on the client since ${formatDate(askedClientAt)}`
                  : "no answer yet"}
              </span>
            )
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
            job={job ?? null}
            addedScopes={addedScopes}
            onAddScope={(scope) => setAddedScopes((prev) => [...prev, scope])}
          />

          {unanswered ? (
            <UnansweredActions
              askedClientAt={askedClientAt}
              onAskClient={setAskedClientAt}
              today={today}
              lastAskedAt={lastAsked(entry, job ? job.id : undefined)}
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
  job,
  addedScopes,
  onAddScope,
}: {
  company: Company
  entry: CompanyQuestion
  catalog: Question
  stack: ResolvedAnswer[]
  /** Set when the row is about one role — the stack then only offers that role. */
  job: CompanyJob | null
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
  const open = availableScopes(company, job ? { jobId: job.id } : {}, catalog).filter(
    (s) =>
      !answeredScopes.has(`${s.kind}:${s.refId ?? ""}`) &&
      !pending.some((p) => p.kind === s.kind && p.refId === s.refId)
  )

  // A question that can only be answered per role opens with one row per active
  // role rather than an empty "Everywhere" box. Offering the company row asks
  // for a sentence that would be a promise made on behalf of every role at once.
  const jobOnly = catalog.answerableAt === "job"

  return (
    <div className="space-y-2">
      {jobOnly && (
        <p className="text-xs text-muted-foreground">
          Answered per role — the honest answer depends on the pipeline and how
          fast this client moves, so there&apos;s no company-wide one to write.
        </p>
      )}

      {stack.length === 0 &&
        pending.length === 0 &&
        (jobOnly ? (
          open
            .filter((s) => s.kind === "job")
            .map((scope) => (
              <AnswerRow
                key={`${scope.kind}:${scope.refId}`}
                company={company}
                entry={entry}
                catalog={catalog}
                scope={scope}
                answer={null}
                depth={0}
                wins={false}
              />
            ))
        ) : (
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
        ))}

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
          {jobOnly ? "One answer per role." : "The most specific answer wins."}
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
  const fieldKey = draftKey.answer(entry.questionId, scope.kind, scope.refId)
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
    draftKey.answerVisibility(
      entry.questionId,
      winning?.scope.kind ?? "company",
      winning?.scope.refId ?? null
    ),
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
        {/* The catalog's phrasings are read-only here on purpose: that row is
            global, so editing it from one company would rewrite the question for
            every other customer's agent. Anything added is company-scoped and
            additive. */}
        {catalog.variants.length > 0 && (
          <p className="flex flex-wrap gap-1.5">
            {catalog.variants.map((v) => (
              <span
                key={v}
                title="Comes with the question — shared across every company"
                className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground"
              >
                {v}
              </span>
            ))}
          </p>
        )}
        <EditablePills
          fieldKey={draftKey.extraVariants(entry.questionId)}
          values={entry.extraVariants ?? []}
          addLabel="Add a phrasing used here"
          ariaLabel="Extra question phrasings for this company"
        />
      </Field>

      {winning?.answer.expandedAnswer && (
        <Field label="If they ask for more">
          <EditableTextarea
            fieldKey={draftKey.answer(entry.questionId, winning!.scope.kind, winning!.scope.refId, "expanded_answer")}
            value={winning.answer.expandedAnswer}
            ariaLabel="Expanded answer"
            rows={2}
          />
        </Field>
      )}

      {winning?.answer.escalationInstructions && (
        // A handoff instruction is how the agent is *meant* to behave, not a
        // problem — so it reads as a rule rather than a warning.
        <SectionNote
          kind="rule"
          icon={<ShieldAlert className="size-4" />}
          title="When to hand off instead"
        >
          {winning.answer.escalationInstructions}
        </SectionNote>
      )}

      {prohibitions.length > 0 && (
        <SectionNote
          kind="rule"
          icon={<Ban className="size-4" />}
          title="Never say, however the question is phrased"
        >
          <ul className="space-y-1">
            {prohibitions.map((claim) => (
              <li
                key={claim}
                className="flex items-start gap-2 text-sm text-muted-foreground"
              >
                {standing.has(claim) ? (
                  // Rule 2 made visible: catalog prohibitions accumulate onto
                  // every company and no scope can drop one.
                  <Lock
                    className="mt-0.5 size-3 shrink-0"
                    aria-label="Standing rule — applies at every company"
                  />
                ) : (
                  <Ban className="mt-0.5 size-3 shrink-0" />
                )}
                {claim}
              </li>
            ))}
          </ul>
          {[...standing].length > 0 && (
            <p className="mt-2 text-xs">
              Locked rules come with the question and apply at every company. A
              team or role can add to this list, never remove from it.
            </p>
          )}
        </SectionNote>
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
 * **Everything this role's agent will say, question by question — and the one
 * place to change any of it.**
 *
 * A published job is an *instance*: the catalog projected onto the company, the
 * company and team answers applied, the role's own fields folded in, and
 * whatever this role answers for itself on top. Nothing is seeded and nothing is
 * assigned — the job simply resolves. What a recruiter needs from that is not a
 * cascade diagram but a list they can act on, so the rows group by **what you'd
 * do about them**:
 *
 *  - *Needs an answer* — open, with the box already there. No click to reach it.
 *  - *Set for this role* — what makes this job different, editable in place.
 *  - *Inherited* — collapsed, because it's working; one click to override, and
 *    the override box opens directly under the answer it replaces.
 *
 * Grouping by action rather than by scope is the difference between a screen you
 * read and a screen you work in. The scope still shows, as a badge on every row.
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
    .filter((r) => r.catalog && job && appliesToJob(r.catalog, job))

  const needs = rows.filter((r) => !r.hit)
  const own = rows.filter((r) => r.hit && r.hit.scope.kind === "job")
  const inherited = rows.filter((r) => r.hit && r.hit.scope.kind !== "job")

  return (
    <div className="space-y-3">
      <JobAnswerGroup
        title="Needs an answer"
        count={needs.length}
        tone="warn"
        empty="Nothing outstanding — every question this role can be asked has an answer."
        defaultOpen
      >
        {needs.map(({ entry, catalog }) => (
          <li key={entry.questionId} className="space-y-1.5 p-3">
            <p className="text-sm font-medium">{catalog!.intent}</p>
            <p className="text-xs text-muted-foreground">
              {catalog!.answerableAt === "job"
                ? "Only answerable on a role — there's no company answer to fall back to."
                : "No company answer either, so the agent hands this back to you."}
            </p>
            <EditableTextarea
              fieldKey={draftKey.answer(entry.questionId, "job", jobId)}
              value=""
              label={`${catalog!.intent} — ${job?.title ?? "this role"}`}
              ariaLabel={`Answer to ${catalog!.intent} for this role`}
              placeholder="Write the answer for this role."
              rows={2}
            />
          </li>
        ))}
      </JobAnswerGroup>

      <JobAnswerGroup
        title="Set for this role"
        count={own.length}
        tone="own"
        empty="This role says nothing different from the company yet."
        defaultOpen
      >
        {own.map(({ entry, catalog, hit }) => {
          const derived = Boolean(hit!.answer.derivedFrom)
          return (
            <li key={entry.questionId} className="space-y-1.5 p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="min-w-0 text-sm font-medium">{catalog!.intent}</p>
                <span className="shrink-0 rounded-md bg-sky-50 px-1.5 py-0.5 text-xs text-sky-700 dark:bg-sky-950/40 dark:text-sky-300">
                  {derived ? "From this role's own fields" : "Set for this role"}
                </span>
              </div>

              {derived ? (
                <>
                  <p className="text-sm text-muted-foreground">{hit!.answer.body}</p>
                  <p className="text-xs text-muted-foreground">
                    Written from {hit!.answer.derivedFrom}. Edit that field and
                    this follows it — or write something different below.
                  </p>
                  <EditableTextarea
                    fieldKey={draftKey.answer(entry.questionId, "job", jobId)}
                    value=""
                    label={`${catalog!.intent} — ${job?.title ?? "this role"}`}
                    ariaLabel={`Answer to ${catalog!.intent} for this role`}
                    placeholder="Leave empty to keep following the field above."
                    rows={2}
                  />
                </>
              ) : (
                <EditableTextarea
                  fieldKey={draftKey.answer(entry.questionId, "job", jobId)}
                  value={hit!.answer.body}
                  label={`${catalog!.intent} — ${job?.title ?? "this role"}`}
                  ariaLabel={`Answer to ${catalog!.intent} for this role`}
                  rows={2}
                />
              )}
            </li>
          )
        })}
      </JobAnswerGroup>

      <JobAnswerGroup
        title="Inherited"
        count={inherited.length}
        tone="quiet"
        empty="Nothing reaches this role from the company or its teams yet."
      >
        {inherited.map(({ entry, catalog, hit }) => {
          const isOverriding = overriding.includes(entry.questionId)
          return (
            <li key={entry.questionId} className="space-y-1.5 p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="min-w-0 text-sm font-medium">{catalog!.intent}</p>
                <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                  {hit!.scope.badge}
                </span>
              </div>

              <p className="text-sm text-muted-foreground">{hit!.answer.body}</p>

              {isOverriding ? (
                <EditableTextarea
                  fieldKey={draftKey.answer(entry.questionId, "job", jobId)}
                  value=""
                  label={`${catalog!.intent} — ${job?.title ?? "this role"}`}
                  ariaLabel={`Answer to ${catalog!.intent} for this role`}
                  placeholder="Write the answer for this role. Leave it empty to keep inheriting."
                  rows={2}
                />
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  className="-ml-2 text-xs text-muted-foreground"
                  onClick={() => setOverriding((prev) => [...prev, entry.questionId])}
                >
                  Answer differently for this role
                </Button>
              )}
            </li>
          )
        })}
      </JobAnswerGroup>
    </div>
  )
}

function JobAnswerGroup({
  title,
  count,
  tone,
  empty,
  defaultOpen = false,
  children,
}: {
  title: string
  count: number
  tone: "warn" | "own" | "quiet"
  empty: string
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = React.useState(defaultOpen && count > 0)

  return (
    <section
      className={cn(
        "rounded-lg border",
        tone === "warn" && count > 0
          ? "border-amber-300 dark:border-amber-900"
          : "border-border"
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        disabled={count === 0}
        className="flex w-full items-center gap-2.5 p-3 text-left disabled:opacity-70"
      >
        <ChevronRight
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-90"
          )}
        />
        <span className="min-w-0 flex-1 text-sm font-medium">{title}</span>
        <span
          className={cn(
            "shrink-0 text-sm tabular-nums",
            tone === "warn" && count > 0
              ? "text-amber-700 dark:text-amber-300"
              : "text-muted-foreground"
          )}
        >
          {count}
        </span>
      </button>

      {count === 0 && (
        <p className="px-3 pb-3 text-xs text-muted-foreground">{empty}</p>
      )}

      {open && count > 0 && <ul className="divide-y divide-border border-t border-border">{children}</ul>}
    </section>
  )
}
