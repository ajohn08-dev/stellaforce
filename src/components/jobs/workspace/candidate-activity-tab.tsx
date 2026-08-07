import { titleCase } from "@/lib/constants"
import type { ApplicationActivityEvent } from "@/lib/data"

function formatEventTimestamp(at: string): string {
  return new Date(at).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

function actorLabel(event: ApplicationActivityEvent): string {
  if (event.actor_type === "system") return "System"
  if (event.actor_type === "candidate") return "the candidate"
  return event.actor?.full_name ?? "Someone"
}

/** Real activity_events rows for this one application (a candidate's run
 * through this job) — see getApplicationActivity in src/lib/data.ts. */
export function CandidateActivityTab({ events }: { events: ApplicationActivityEvent[] }) {
  if (events.length === 0) {
    return <p className="text-sm text-muted-foreground">No activity yet.</p>
  }

  return (
    <div className="divide-y divide-border">
      {events.map((event) => (
        <div key={event.id} className="flex items-start justify-between gap-4 py-2.5">
          <p className="text-sm text-foreground">
            {titleCase(event.event_type)} — {actorLabel(event)}
          </p>
          <span className="shrink-0 text-xs text-muted-foreground">
            {formatEventTimestamp(event.created_at)}
          </span>
        </div>
      ))}
    </div>
  )
}
