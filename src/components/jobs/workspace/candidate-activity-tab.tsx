type ActivityEvent = {
  id: string
  /** One-line, plain-language description of the event. */
  summary: string
  timestamp: string
}

/**
 * Seeded mock activity log, most recent first — UI only, not wired to a
 * real event pipeline yet. Spans the full event catalog (entry, stage
 * movement, interview scheduling/execution, feedback, decision) for one
 * candidate's journey through this job so far.
 */
const ACTIVITY_EVENTS: ActivityEvent[] = [
  {
    id: "feedback-submitted",
    summary: "Technical Interview 1: feedback submitted by Jamie Rivera.",
    timestamp: "Jul 19, 2026 · 3:10 PM",
  },
  {
    id: "interview-occurred",
    summary: "Technical Interview 1: attended by Jamie Rivera and Isabella Reyes.",
    timestamp: "Jul 18, 2026 · 2:00 PM",
  },
  {
    id: "invite-confirmed",
    summary: "Technical Interview 1: invite confirmed by candidate and interviewer.",
    timestamp: "Jul 17, 2026 · 9:05 AM",
  },
  {
    id: "interview-scheduled",
    summary: "Technical Interview 1: interview scheduled by Anna John.",
    timestamp: "Jul 16, 2026 · 11:20 AM",
  },
  {
    id: "moved-to-next-round",
    summary:
      "Moved from Hiring Manager Interview to Technical Interview 1 by Anna John.",
    timestamp: "Jul 16, 2026 · 11:00 AM",
  },
  {
    id: "decision-recorded",
    summary: "Hiring Manager Interview: passed, decision recorded by Alex Kim.",
    timestamp: "Jul 15, 2026 · 4:45 PM",
  },
  {
    id: "scorecard-updated",
    summary: "HR Screening: scorecard updated with new evidence.",
    timestamp: "Jul 11, 2026 · 10:00 AM",
  },
  {
    id: "moved-to-stage",
    summary: "Moved from Source to Screen by Anna John.",
    timestamp: "Jul 9, 2026 · 1:15 PM",
  },
  {
    id: "initial-competency-match",
    summary: "Source: initial competency match generated from resume.",
    timestamp: "Jul 8, 2026 · 9:32 AM",
  },
  {
    id: "candidate-added",
    summary: "Source: candidate added to job by Anna John.",
    timestamp: "Jul 8, 2026 · 9:30 AM",
  },
]

export function CandidateActivityTab() {
  return (
    <div className="divide-y divide-border">
      {ACTIVITY_EVENTS.map((event) => (
        <div
          key={event.id}
          className="flex items-start justify-between gap-4 py-2.5"
        >
          <p className="text-sm text-foreground">{event.summary}</p>
          <span className="shrink-0 text-xs text-muted-foreground">
            {event.timestamp}
          </span>
        </div>
      ))}
    </div>
  )
}
