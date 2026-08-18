import { AlertOctagon, AlertTriangle, CheckCircle2, Eye } from "lucide-react"

import { cn } from "@/lib/utils"
import { READINESS_LABELS, type ReadinessStatus } from "@/lib/company-readiness"

/**
 * The four-value readiness chip — the company's status badge, playing the same
 * role `JobStatusBadge` plays on a job.
 *
 * Color is a secondary cue only: the label always says the status in words. The
 * `headline` sentence explaining *why* belongs either in the pill's tooltip
 * (header) or beside the thing that would fix it (section warnings) — never as a
 * standing paragraph, which is how it ended up duplicated three ways.
 */

const STATUS_STYLES: Record<ReadinessStatus, string> = {
  ready:
    "bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-400/20",
  ready_with_caveats:
    "bg-sky-50 text-sky-700 ring-sky-600/20 dark:bg-sky-950/40 dark:text-sky-300 dark:ring-sky-400/20",
  review_required:
    "bg-amber-50 text-amber-800 ring-amber-600/20 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-400/20",
  blocked: "bg-destructive/10 text-destructive ring-destructive/20",
}

const STATUS_ICONS: Record<ReadinessStatus, typeof CheckCircle2> = {
  ready: CheckCircle2,
  ready_with_caveats: Eye,
  review_required: AlertTriangle,
  blocked: AlertOctagon,
}

export function ReadinessPill({
  status,
  className,
  size = "default",
}: {
  status: ReadinessStatus
  className?: string
  size?: "default" | "sm"
}) {
  const Icon = STATUS_ICONS[status]
  return (
    <span
      className={cn(
        "inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full font-medium ring-1 ring-inset",
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-sm",
        STATUS_STYLES[status],
        className
      )}
    >
      <Icon className={size === "sm" ? "size-3" : "size-3.5"} />
      {READINESS_LABELS[status]}
    </span>
  )
}
