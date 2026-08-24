"use client"

import * as React from "react"
import { MessageCircle, Play, Send } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import { useCompanyDraft } from "@/components/companies/company-draft-context"
import { SectionNote } from "@/components/companies/shared/section-note"
import {
  previewAsk,
  previewSuggestions,
  type PreviewTurn,
} from "@/lib/company-preview"
import { activeJobs } from "@/lib/company-inheritance"
import {
  AGENT_AUDIENCE_LABELS,
  type AgentAudience,
} from "@/lib/company-visibility"
import type { Company } from "@/lib/mock-companies"

/**
 * **Ask the knowledge base a question and watch what comes back.**
 *
 * Everything else in this workspace describes the agent's behaviour; this is the
 * only place it can be observed. Type what a candidate would type, and see the
 * answer, which scope produced it, and — when there isn't one — which of the four
 * fallbacks fires and why.
 *
 * **It shows published knowledge only, on purpose.** Unpublished edits are
 * excluded and the panel says how many. A preview that folded in your drafts
 * would answer *"what will candidates hear after I publish?"*, which is a fine
 * question but not the one people have while editing — that one is **"what are
 * candidates being told right now?"**, and the two answers diverge exactly when
 * you're least sure. Publish, then re-ask, and the change is visible as a
 * change.
 *
 * The role selector matters more than it looks: the same question has a
 * different true answer per role, so previewing "company-wide" and previewing on
 * the Central AE are genuinely different tests.
 */
export function KnowledgePreview({ company }: { company: Company }) {
  const draft = useCompanyDraft()
  const pending = draft?.changes.length ?? 0

  const jobs = activeJobs(company)
  const [jobId, setJobId] = React.useState<string>(jobs[0]?.id ?? "")
  const [audience, setAudience] = React.useState<AgentAudience>("candidate")
  const [turns, setTurns] = React.useState<PreviewTurn[]>([])
  const [text, setText] = React.useState("")
  const nextId = React.useRef(0)
  const endRef = React.useRef<HTMLDivElement>(null)

  // Keep the latest exchange in view, the way any chat does.
  React.useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [turns])

  const suggestions = React.useMemo(
    () => previewSuggestions(company, jobId || null),
    [company, jobId]
  )

  function ask(question: string) {
    const trimmed = question.trim()
    if (!trimmed) return
    setTurns((prev) => [
      ...prev,
      previewAsk(company, trimmed, { jobId: jobId || null, audience }, String(nextId.current++)),
    ])
    setText("")
  }

  return (
    <Sheet>
      <SheetTrigger
        render={
          <Button variant="outline" size="sm" className="gap-1.5">
            <Play className="size-3.5" />
            Preview
          </Button>
        }
      />
      <SheetContent side="right" className="w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Preview</SheetTitle>
          <SheetDescription>
            Ask what a candidate would ask. This is published knowledge — what
            they hear today.
          </SheetDescription>
        </SheetHeader>

        {/* No padding of its own: SheetContent already has p-6. Adding px-4 pb-4
            here inset the chat column further than the header above it and left
            a 40px gutter down both sides of a panel that needs the width. */}
        <div className="flex min-h-0 flex-1 flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Select value={jobId || "none"} onValueChange={(v) => setJobId(v === "none" ? "" : (v as string))}>
              <SelectTrigger size="sm" className="min-w-48 flex-1" aria-label="Role">
                {/* Base UI renders the raw value unless given a mapper, so this
                    was showing "job-lg-01" where a job title belongs. */}
                <SelectValue>
                  {(value: string) =>
                    jobs.find((j) => j.id === value)?.title ?? "No role in play"
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No role in play</SelectItem>
                {jobs.map((j) => (
                  <SelectItem key={j.id} value={j.id}>
                    {j.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div
              role="radiogroup"
              aria-label="Agent audience"
              className="flex shrink-0 rounded-lg border border-border p-0.5"
            >
              {(Object.keys(AGENT_AUDIENCE_LABELS) as AgentAudience[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  role="radio"
                  aria-checked={audience === key}
                  onClick={() => setAudience(key)}
                  className={cn(
                    "rounded-md px-2 py-1 text-xs font-medium transition-colors",
                    audience === key
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {AGENT_AUDIENCE_LABELS[key]}
                </button>
              ))}
            </div>
          </div>

          {pending > 0 && (
            <SectionNote kind="attention">
              {pending} unpublished change{pending === 1 ? " isn't" : "s aren't"}{" "}
              included. This is what candidates hear right now — publish, then ask
              again to see the difference.
            </SectionNote>
          )}

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto">
            {turns.length === 0 ? (
              <p className="flex h-full items-center justify-center px-6 text-center text-sm text-muted-foreground">
                Ask a question and you&apos;ll see the answer, which scope it came
                from, and what happens when there isn&apos;t one.
              </p>
            ) : (
              turns.map((turn) => <Turn key={turn.id} turn={turn} />)
            )}
            <div ref={endRef} />
          </div>

          {/* Directly above the composer, the way the home chat does — but
              wrapped rather than in a scrolling strip, since the panel is narrow
              and a horizontal strip clips every prompt mid-question. Wrapping
              lets two short prompts share a line and gives a long one the whole
              row, so four prompts cost two or three lines instead of four. */}
          <div className="flex shrink-0 flex-wrap items-start gap-2">
            {turns.length === 0 &&
              suggestions.map((s) => (
                <Button
                  key={s}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="max-w-full gap-1.5 rounded-full"
                  onClick={() => ask(s)}
                >
                  <MessageCircle className="size-3.5 shrink-0" />
                  <span className="truncate">{s}</span>
                </Button>
              ))}
          </div>

          <div className="flex shrink-0 items-end gap-2 rounded-lg border border-input bg-white p-2 dark:bg-white">
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  ask(text)
                }
              }}
              placeholder="Ask something a candidate would ask…"
              aria-label="Ask the knowledge base"
              rows={2}
              className="flex-1 resize-none border-0 bg-transparent field-sizing-fixed dark:bg-transparent"
            />
            <Button
              type="button"
              size="icon"
              disabled={!text.trim()}
              onClick={() => ask(text)}
              aria-label="Ask"
            >
              <Send className="size-4" />
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

const REASON_LABEL: Record<PreviewTurn["reason"], string> = {
  answered: "Answered",
  escalated: "Handed to a recruiter",
  unanswered: "No approved answer",
  no_match: "Nothing matched",
  withheld_from_audience: "Not cleared for this audience",
}

function Turn({ turn }: { turn: PreviewTurn }) {
  const answered = turn.reason === "answered"

  return (
    <div className="space-y-1.5">
      <p className="ml-auto w-fit max-w-[85%] rounded-lg bg-muted px-3 py-2 text-sm">
        {turn.asked}
      </p>

      <div className="w-fit max-w-[92%] space-y-1.5 rounded-lg border border-border p-3">
        <p className="text-sm">{turn.says}</p>

        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <span
            className={cn(
              "rounded-md px-1.5 py-0.5",
              answered
                ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                : "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
            )}
          >
            {REASON_LABEL[turn.reason]}
          </span>

          {/* The whole point of the cascade, observable: not just the sentence
              but which scope produced it. */}
          {turn.resolved && answered && <span>{turn.resolved.scope.badge}</span>}
          {turn.matched && <span>· {turn.matched.intent}</span>}
          {turn.fallback && <span>· fallback: {turn.fallback.label}</span>}
        </div>

        {turn.prohibitions.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {turn.prohibitions.length} standing rule
            {turn.prohibitions.length === 1 ? "" : "s"} applied to this topic.
          </p>
        )}
      </div>
    </div>
  )
}
