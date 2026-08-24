import {
  Bot,
  History,
  Lock,
  PenLine,
  ShieldCheck,
  Sparkles,
  UploadCloud,
} from "lucide-react"

import { cn } from "@/lib/utils"
import {
  ACTIVITY_EVENT_LABELS,
  type ActivityEntry,
  type ActivityEventType,
} from "@/lib/mock-companies"

/**
 * One row of the company activity feed.
 *
 * There is deliberately **no per-item history drawer**. Two different jobs kept
 * getting conflated:
 *
 *  - *"Who said this, and when was it last confirmed?"* — provenance. Needed
 *    constantly, and already answered inline by `VerificationRow` on every card.
 *  - *"Reconstruct what happened during a dispute."* — audit. Needed rarely, and
 *    answered by one queryable append-only log.
 *
 * The app already has that log (`activity_events` + `audit_log`, see CLAUDE.md).
 * A history sheet hanging off every card meant a third parallel store, a
 * denormalized counter on every item to render "History (3)", and an affordance
 * that mostly opened to nothing. Filtering the one feed covers the same ground.
 */

const EVENT_ICONS: Record<ActivityEventType, typeof PenLine> = {
  created: Sparkles,
  edited: PenLine,
  clearance_changed: ShieldCheck,
  agent_use_changed: Bot,
  published: UploadCloud,
  unpublished: UploadCloud,
  verified: ShieldCheck,
  marked_stale: History,
  promoted: Sparkles,
  restricted_expanded: Lock,
  agent_deployed: Bot,
  agent_used_item: Bot,
}

export function ActivityRow({
  entry,
  showEntity = true,
  className,
}: {
  entry: ActivityEntry
  showEntity?: boolean
  className?: string
}) {
  const Icon = EVENT_ICONS[entry.event]
  const isSystem = entry.actorType === "system"

  return (
    <li className={cn("flex gap-3 rounded-lg px-2 py-2.5 hover:bg-muted/50", className)}>
      <span
        className={cn(
          "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full",
          // Opening a restricted item is an event worth finding in the log,
          // not an incident — it gets the system tint, not an alarm.
          entry.event === "restricted_expanded" || isSystem
              ? "bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300"
              : "bg-muted text-muted-foreground"
        )}
      >
        <Icon className="size-3.5" />
      </span>

      <div className="min-w-0 flex-1">
        <p className="text-sm">
          <span className="font-medium">{ACTIVITY_EVENT_LABELS[entry.event]}</span>
          {showEntity && (
            <span className="text-muted-foreground"> · {entry.entityLabel}</span>
          )}
        </p>
        {entry.detail && (
          <p className="mt-0.5 text-xs text-muted-foreground">{entry.detail}</p>
        )}
        <p className="mt-0.5 text-xs text-muted-foreground">
          {entry.actor} · {formatTimestamp(entry.at)}
        </p>
      </div>
    </li>
  )
}

/** ISO timestamp → "16 Aug 2026, 15:42". Fixed locale so SSR and client agree. */
export function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  })
}
