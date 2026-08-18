import { AlertTriangle, Clock } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  agentMustEscalate,
  monthsSinceVerified,
  staleState,
  type VisibilityBearing,
} from "@/lib/company-visibility"

/**
 * Whether an item warrants a trust warning, and why.
 *
 * Exported so nothing has to re-implement the rule to reason about it — the
 * component below and the rail's attention dots must agree, and the only way to
 * guarantee that is one predicate.
 *
 * Escalate-marked items are excluded, matching the readiness queues: an item
 * that routes to a recruiter asserts nothing, so it can't be stale and can't be
 * an unverified claim. Telling someone to "verify it or hold it back" when it is
 * already held back — which is exactly what escalate means — is noise.
 */
export function needsAttention(
  item: VisibilityBearing,
  today: Date
): "stale" | "unverified" | null {
  const v = item.visibility

  if (agentMustEscalate(item)) return null
  if (staleState(item, today) === "overdue") return "stale"
  if (
    v.state === "published" &&
    v.clearance === "cleared_for_candidates" &&
    (v.verification === "unverified" || v.verification === "needs_review")
  ) {
    return "unverified"
  }
  return null
}

/**
 * The one trust signal that stays on an item — and it renders **nothing** unless
 * something is actually wrong.
 *
 * This replaced a four-field provenance strip (source · owner · verified-by ·
 * next review) that sat under every card. That data is real, but it isn't read
 * constantly — it's consulted when something looks off, which is exactly the
 * case a warning covers. Showing it always meant every card carried a line of
 * chrome, with the owner's name usually repeated twice, to answer a question
 * nobody was asking. The full detail lives in the activity log.
 *
 * What genuinely has to interrupt you is narrower: this claim is going out to
 * candidates and nobody has confirmed it, or its review date has passed. Both
 * change what you'd do next; the rest is reference.
 */
export function TrustWarning({
  item,
  today,
  className,
}: {
  item: VisibilityBearing
  today: Date
  className?: string
}) {
  const reason = needsAttention(item, today)
  if (!reason) return null

  const stale = reason === "stale"
  const months = monthsSinceVerified(item, today)
  const Icon = stale ? AlertTriangle : Clock

  const message = stale
    ? `Last verified ${months ? `${months} month${months === 1 ? "" : "s"} ago` : "some time ago"}. Re-confirm before an agent uses this.`
    : "Not confirmed with the client. An agent can use this today — verify it or hold it back."

  return (
    <p
      // Both states are `attention`: stale knowledge and an unverified claim
      // each mean "go and confirm this", and neither means an agent is broken.
      // Stale used to render destructive-red, which is reserved for a check that
      // actually fails.
      className={cn(
        "flex items-start gap-2 rounded-md bg-amber-50 px-2.5 py-2 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-300",
        className
      )}
    >
      <Icon className="mt-0.5 size-3.5 shrink-0" />
      <span className="flex-1">{message}</span>
      <Button
        variant="ghost"
        size="sm"
        className="-my-1 h-auto px-1.5 py-0.5 text-xs font-medium"
      >
        Mark verified
      </Button>
    </p>
  )
}
