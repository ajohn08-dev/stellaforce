import { EyeOff, Lock, MessageCircle, Users } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
  AGENT_USE_LABELS,
  CLEARANCE_LABELS,
  CLEARANCE_SHORT_LABELS,
  type AgentUse,
  type Clearance,
} from "@/lib/company-visibility"

/**
 * One clearance level, rendered as a chip.
 *
 * Uses the short labels; the full ones ("Restricted — named staff only") are for
 * the sentence control, where there's room. Each level gets its own icon as well
 * as its own color, because a recruiter scanning a dense page shouldn't have to
 * distinguish two muted tones to know whether something can reach a candidate.
 */

const CLEARANCE_STYLES: Record<Clearance, string> = {
  cleared_for_candidates:
    "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  recruiters_only: "bg-muted text-muted-foreground",
  // A state, not a failure — the strictest rung of the ladder is the system
  // working. Red is reserved for a check that fails.
  restricted: "bg-muted text-muted-foreground",
}

const CLEARANCE_ICONS: Record<Clearance, typeof Users> = {
  cleared_for_candidates: Users,
  recruiters_only: EyeOff,
  restricted: Lock,
}

export function ClearanceBadge({
  clearance,
  className,
  showIcon = true,
}: {
  clearance: Clearance
  className?: string
  showIcon?: boolean
}) {
  const Icon = CLEARANCE_ICONS[clearance]
  return (
    <Badge
      variant="secondary"
      className={cn(CLEARANCE_STYLES[clearance], className)}
      title={CLEARANCE_LABELS[clearance]}
    >
      {showIcon && <Icon data-icon="inline-start" className="size-3" />}
      {CLEARANCE_SHORT_LABELS[clearance]}
    </Badge>
  )
}

/**
 * The second axis. Only meaningful on candidate-safe items, so callers pass null
 * elsewhere and nothing renders. `escalate` is styled as a warning rather than a
 * neutral chip — it means the agent refuses to answer, which is a decision worth
 * seeing at a glance.
 */
const AGENT_USE_STYLES: Record<AgentUse, string> = {
  proactive: "bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300",
  on_request: "bg-muted text-muted-foreground",
  reference_only: "bg-muted text-muted-foreground",
  escalate: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
}

export function AgentUseBadge({
  agentUse,
  className,
}: {
  agentUse: AgentUse | null
  className?: string
}) {
  if (!agentUse) return null
  return (
    <Badge
      variant="secondary"
      className={cn(AGENT_USE_STYLES[agentUse], className)}
      title={`Agent use: ${AGENT_USE_LABELS[agentUse]}`}
    >
      <MessageCircle data-icon="inline-start" className="size-3" />
      {AGENT_USE_LABELS[agentUse]}
    </Badge>
  )
}
