"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Building2, Phone, Star, Video } from "lucide-react"
import { toast } from "sonner"

import { addEvaluationNote } from "@/app/(app)/jobs/actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Tabs, TabsList, TabsPanel, TabsTab } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import type { ApplicationEvaluation, EvaluationQuestion } from "@/lib/data"

const MODE_META: Record<
  NonNullable<ApplicationEvaluation["mode"]>,
  { label: string; icon: typeof Video }
> = {
  video: { label: "Video", icon: Video },
  phone: { label: "Phone", icon: Phone },
  onsite: { label: "Onsite", icon: Building2 },
  async: { label: "Async", icon: Building2 },
}

const LEVEL_LABEL: Record<NonNullable<EvaluationQuestion["recommended_level"]>, string> = {
  aware: "Aware",
  proficient: "Proficient",
  expert: "Expert",
}

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  const remainder = seconds % 60
  return minutes > 0 ? `${minutes}m ${remainder}s` : `${remainder}s`
}

function StarRating({ score }: { score: number }) {
  const rounded = Math.round(score)
  return (
    <div className="flex items-center gap-0.5" aria-label={`${score} out of 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={cn(
            "size-4",
            i <= rounded
              ? "fill-brand-orange-300 text-brand-orange-300"
              : "text-muted-foreground/30"
          )}
        />
      ))}
    </div>
  )
}

/**
 * Playable media for the interview. Mirrors ConversationMediaPreview (native
 * controls, video before audio, a reason when neither is available) but reads
 * the evaluation's own recording rather than a Conversation.
 */
function EvaluationMedia({ recording }: { recording: ApplicationEvaluation["recording"] }) {
  if (recording?.video_url) {
    return (
      <video
        controls
        preload="metadata"
        src={recording.video_url}
        className="w-full rounded-lg border border-border bg-black"
      />
    )
  }

  if (recording?.audio_url) {
    return (
      <audio controls preload="metadata" className="w-full">
        <source src={recording.audio_url} type={recording.audio_mime_type ?? undefined} />
        Your browser doesn&rsquo;t support audio playback.
      </audio>
    )
  }

  const message = !recording
    ? "No recording was captured for this interview."
    : recording.audio_status === "failed"
      ? "Recording unavailable — the audio upload failed."
      : "Recording is still processing."

  return (
    <p className="rounded-lg border border-dashed border-border px-3 py-2 text-sm text-muted-foreground">
      {message}
    </p>
  )
}

/** Q&A grouped by the competency each question probed, so the tab answers
 * "what did we assess, and what did they actually say". Questions with no
 * competency fall into a trailing "Other questions" group. */
function QuestionsTab({ questions }: { questions: EvaluationQuestion[] }) {
  if (questions.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No questions were recorded for this interview.
      </p>
    )
  }

  const groups: { key: string; label: string; questions: EvaluationQuestion[] }[] = []
  for (const question of questions) {
    const key = question.competency_id ?? "__other"
    const existing = groups.find((g) => g.key === key)
    if (existing) existing.questions.push(question)
    else
      groups.push({
        key,
        label: question.competency_label ?? "Other questions",
        questions: [question],
      })
  }

  return (
    <div className="flex flex-col gap-5">
      {groups.map((group) => {
        const [first] = group.questions
        return (
          <section key={group.key} className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold text-foreground">{group.label}</h3>
              {first.competency_type && (
                <Badge variant="secondary" className="capitalize">
                  {first.competency_type}
                </Badge>
              )}
              {first.recommended_level && (
                <Badge variant="outline">
                  Target: {LEVEL_LABEL[first.recommended_level]}
                </Badge>
              )}
            </div>

            {group.questions.map((question) => (
              <div
                key={question.id}
                className="rounded-lg border border-border bg-white p-3"
              >
                <p className="text-sm font-medium text-foreground">{question.question}</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {question.answer ?? "No answer recorded."}
                </p>
              </div>
            ))}
          </section>
        )
      })}
    </div>
  )
}

function TranscriptTab({
  recording,
  interviewerLabel,
}: {
  recording: ApplicationEvaluation["recording"]
  interviewerLabel: string
}) {
  if (!recording || recording.transcript.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No transcript is available for this interview.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {recording.transcript.map((turn, i) => (
        <div
          key={i}
          className={cn(
            "flex flex-col gap-1",
            turn.speaker === "candidate" ? "items-end" : "items-start"
          )}
        >
          <span className="text-xs text-muted-foreground">
            {turn.speaker === "candidate" ? "Candidate" : interviewerLabel}
          </span>
          <p
            className={cn(
              "max-w-[85%] rounded-lg px-3 py-2 text-sm",
              turn.speaker === "candidate"
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-foreground"
            )}
          >
            {turn.text}
          </p>
        </div>
      ))}
    </div>
  )
}

function NotesTab({
  evaluationId,
  notes,
}: {
  evaluationId: string
  notes: string[]
}) {
  const router = useRouter()
  const [draft, setDraft] = React.useState("")
  const [pending, startTransition] = React.useTransition()

  function submit() {
    const note = draft.trim()
    if (!note) return
    startTransition(async () => {
      const result = await addEvaluationNote(evaluationId, note)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      setDraft("")
      // The notes list is server-rendered from the job page's evaluations.
      router.refresh()
      toast.success("Note added.")
    })
  }

  return (
    <div className="flex flex-col gap-4">
      {notes.length > 0 ? (
        <div className="flex flex-col gap-2">
          {notes.map((note, i) => (
            <p key={i} className="rounded-lg border border-border p-3 text-sm text-foreground">
              {note}
            </p>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No notes on this evaluation yet.</p>
      )}

      <div className="flex flex-col items-end gap-2">
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Add a note for the rest of the hiring team…"
          disabled={pending}
        />
        <Button size="sm" onClick={submit} disabled={pending || draft.trim() === ""}>
          {pending ? "Adding…" : "Add note"}
        </Button>
      </div>
    </div>
  )
}

/**
 * Full detail for one stage evaluation, opened by clicking its card in the
 * Evaluation tab. The header (metadata + media) is pinned; only the tab
 * panels scroll, so the recording stays reachable while reading a long
 * transcript.
 *
 * Selection-driven rather than route-driven, like ConversationDetailSheet:
 * the pipeline board's candidate detail is itself transient UI, so there is
 * nothing stable to deep-link to.
 */
export function EvaluationDetailSheet({
  selected,
  candidateName,
  onOpenChange,
}: {
  /** The clicked card's evaluation plus the stage it belongs to; null when
   * the panel is closed. Bundled so the stage name can't go stale against
   * the evaluation during the sheet's close animation. */
  selected: { evaluation: ApplicationEvaluation; stageName: string } | null
  candidateName: string
  onOpenChange: (open: boolean) => void
}) {
  const evaluation = selected?.evaluation ?? null
  // Rendered inline in a normal page, so this goes through SSR where
  // `document` doesn't exist — same guard as ConversationDetailSheet.
  const container =
    typeof document !== "undefined"
      ? (document.getElementById("app-content") ?? undefined)
      : undefined

  const interviewerLabel = evaluation?.interviewer_name ?? "AI agent"
  const mode = evaluation?.mode ? MODE_META[evaluation.mode] : null
  const ModeIcon = mode?.icon

  const metadata = evaluation
    ? [
        evaluation.interviewer_name,
        evaluation.interview_date
          ? new Date(evaluation.interview_date).toLocaleDateString()
          : null,
        evaluation.recording?.duration_seconds
          ? formatDuration(evaluation.recording.duration_seconds)
          : null,
      ].filter((part): part is string => Boolean(part))
    : []

  return (
    <Sheet open={evaluation !== null} onOpenChange={onOpenChange}>
      <SheetContent container={container} side="right" className="max-w-2xl gap-0 bg-white p-0">
        {evaluation && (
          <div className="flex h-full flex-col overflow-hidden">
            {/* Pinned: identity, score, and the recording. */}
            <div className="shrink-0 border-b border-border p-6 pb-4">
              <SheetHeader className="pr-10">
                <div className="flex items-start justify-between gap-3">
                  <SheetTitle>{selected?.stageName}</SheetTitle>
                  {evaluation.rubric_score != null && (
                    <StarRating score={evaluation.rubric_score} />
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                  <span>{candidateName}</span>
                  {mode && ModeIcon && (
                    <>
                      <span>·</span>
                      <span className="inline-flex items-center gap-1">
                        <ModeIcon className="size-3.5" />
                        {mode.label}
                      </span>
                    </>
                  )}
                  {metadata.map((part) => (
                    <React.Fragment key={part}>
                      <span>·</span>
                      <span>{part}</span>
                    </React.Fragment>
                  ))}
                </div>
              </SheetHeader>

              {evaluation.summary && (
                <p className="mt-3 text-sm text-foreground">{evaluation.summary}</p>
              )}

              <div className="mt-4">
                <EvaluationMedia recording={evaluation.recording} />
              </div>
            </div>

            <Tabs defaultValue="questions" className="flex min-h-0 flex-1 flex-col gap-0">
              <TabsList className="shrink-0 px-6">
                <TabsTab value="questions">Q&amp;A</TabsTab>
                <TabsTab value="transcript">Transcript</TabsTab>
                <TabsTab value="notes">Notes</TabsTab>
              </TabsList>

              <div className="min-h-0 flex-1 overflow-y-auto p-6">
                <TabsPanel value="questions">
                  <QuestionsTab questions={evaluation.questions} />
                </TabsPanel>
                <TabsPanel value="transcript">
                  <TranscriptTab
                    recording={evaluation.recording}
                    interviewerLabel={interviewerLabel}
                  />
                </TabsPanel>
                <TabsPanel value="notes">
                  <NotesTab evaluationId={evaluation.id} notes={evaluation.notes} />
                </TabsPanel>
              </div>
            </Tabs>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
