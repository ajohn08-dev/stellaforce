"use client"

import * as React from "react"
import { toast } from "sonner"
import { Building2, Phone, Star, Video } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

type InterviewMode = "video" | "phone" | "onsite"

const MODE_META: Record<InterviewMode, { label: string; icon: typeof Video }> = {
  video: { label: "Video", icon: Video },
  phone: { label: "Phone", icon: Phone },
  onsite: { label: "Onsite", icon: Building2 },
}

type CompletedEvaluation = {
  id: string
  status: "completed"
  stageName: string
  interviewer: string
  interviewDate: string
  mode: InterviewMode
  lastUpdated: string
  rubricScore: number
  summary: string
  notes: string[]
}

type PendingEvaluation = {
  id: string
  status: "pending"
  stageName: string
  interviewer: string
  interviewDate: string
  mode: InterviewMode
}

type Evaluation = CompletedEvaluation | PendingEvaluation

/**
 * Seeded mock evaluations, most recent interview first — UI only, not
 * wired to a real evaluation pipeline yet. The most recent interview
 * (Technical Interview 1) hasn't had its write-up submitted, so it renders
 * as the "pending" card type instead of a completed one.
 */
const EVALUATIONS: Evaluation[] = [
  {
    id: "technical-interview-1",
    status: "pending",
    stageName: "Technical Interview 1",
    interviewer: "Jamie Rivera",
    interviewDate: "Jul 18, 2026",
    mode: "video",
  },
  {
    id: "hiring-manager-interview",
    status: "completed",
    stageName: "Hiring Manager Interview",
    interviewer: "Alex Kim",
    interviewDate: "Jul 15, 2026",
    mode: "video",
    lastUpdated: "Jul 15, 2026",
    rubricScore: 4,
    summary:
      "Strong alignment on role expectations and team fit; candidate asked thoughtful questions about the team's roadmap and demonstrated clear ownership in past projects.",
    notes: [
      "Asked specific questions about on-call rotation and team rituals.",
      "Described a past project where they drove scope down to hit a deadline.",
    ],
  },
  {
    id: "hr-screening",
    status: "completed",
    stageName: "HR Screening",
    interviewer: "Priya Shah",
    interviewDate: "Jul 10, 2026",
    mode: "phone",
    lastUpdated: "Jul 11, 2026",
    rubricScore: 4.5,
    summary:
      "Confirmed compensation expectations, work authorization, and availability; candidate was responsive and professional throughout.",
    notes: [
      "Compensation expectations within band.",
      "Available to start within 3 weeks of an offer.",
    ],
  },
  {
    id: "recruiter-screen",
    status: "completed",
    stageName: "Recruiter Screen",
    interviewer: "Jordan Lee",
    interviewDate: "Jul 8, 2026",
    mode: "phone",
    lastUpdated: "Jul 8, 2026",
    rubricScore: 4,
    summary:
      "Candidate's background matches the core requirements; motivated by the mission and open to the compensation range discussed.",
    notes: [
      "Currently at a company going through layoffs — motivated to move quickly.",
      "No relocation needed; already based in the target metro.",
    ],
  },
]

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

function ModeTag({ mode }: { mode: InterviewMode }) {
  const meta = MODE_META[mode]
  const Icon = meta.icon
  return (
    <span className="inline-flex items-center gap-1">
      <Icon className="size-3.5" />
      {meta.label}
    </span>
  )
}

function CompletedEvaluationCard({ evaluation }: { evaluation: CompletedEvaluation }) {
  const [open, setOpen] = React.useState(false)

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            setOpen(true)
          }
        }}
        className="cursor-pointer rounded-lg border border-transparent bg-brand-orange-50 p-4 transition-colors hover:border-brand-orange-300"
      >
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm font-semibold text-foreground">
            {evaluation.stageName}
          </p>
          <StarRating score={evaluation.rubricScore} />
        </div>

        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <span>{evaluation.interviewer}</span>
          <span>·</span>
          <ModeTag mode={evaluation.mode} />
          <span>·</span>
          <span>{evaluation.interviewDate}</span>
          <span>·</span>
          <span>Updated {evaluation.lastUpdated}</span>
        </div>

        <p className="mt-3 text-sm text-foreground">{evaluation.summary}</p>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{evaluation.stageName}</SheetTitle>
            <SheetDescription>
              {evaluation.interviewer} · {MODE_META[evaluation.mode].label} ·{" "}
              {evaluation.interviewDate}
            </SheetDescription>
          </SheetHeader>

          <div className="flex items-center justify-between rounded-md border border-border p-3">
            <span className="text-sm text-muted-foreground">Rubric score</span>
            <StarRating score={evaluation.rubricScore} />
          </div>

          <div>
            <p className="text-xs font-medium text-muted-foreground">Summary</p>
            <p className="mt-1 text-sm text-foreground">{evaluation.summary}</p>
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium text-muted-foreground">Notes</p>
            {evaluation.notes.map((note, i) => (
              <div key={i} className="rounded-md border border-border p-3">
                <p className="text-sm text-foreground">{note}</p>
              </div>
            ))}
          </div>

          <p className="text-xs text-muted-foreground">
            Last updated {evaluation.lastUpdated}
          </p>
        </SheetContent>
      </Sheet>
    </>
  )
}

function PendingEvaluationCard({ evaluation }: { evaluation: PendingEvaluation }) {
  return (
    <div className="rounded-lg border-2 border-dashed border-border bg-muted/40 p-4">
      <p className="text-sm font-semibold text-foreground">{evaluation.stageName}</p>

      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
        <span>{evaluation.interviewer}</span>
        <span>·</span>
        <ModeTag mode={evaluation.mode} />
        <span>·</span>
        <span>{evaluation.interviewDate}</span>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          No evaluation submitted yet.
        </p>
        <Button
          size="sm"
          onClick={() =>
            toast.info("Not wired up yet — adding an evaluation is coming soon.")
          }
        >
          Add evaluation
        </Button>
      </div>
    </div>
  )
}

export function CandidateEvaluationTab() {
  return (
    <div className="flex flex-col gap-3">
      {EVALUATIONS.map((evaluation) =>
        evaluation.status === "completed" ? (
          <CompletedEvaluationCard key={evaluation.id} evaluation={evaluation} />
        ) : (
          <PendingEvaluationCard key={evaluation.id} evaluation={evaluation} />
        )
      )}
    </div>
  )
}
