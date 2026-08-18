import { ArrowDownRight, GitBranch } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { KnowledgeLevel } from "@/lib/mock-companies"

/**
 * Inheritance and override markers for the job-creation flow.
 *
 * The pair exists so precedence is visible at the point of editing rather than
 * documented somewhere else: a value is either flowing down from a level above,
 * or it has been deliberately replaced here — and if it's been replaced, the
 * inherited value stays on screen so the change is legible.
 */

const LEVEL_LABELS: Record<KnowledgeLevel, string> = {
  company: "Company",
  department: "Department",
  team: "Team",
  job: "Role",
}

export function InheritanceBadge({
  level,
  sourceName,
  className,
}: {
  level: KnowledgeLevel
  sourceName?: string
  className?: string
}) {
  return (
    <Badge
      variant="outline"
      className={cn("text-muted-foreground", className)}
      title={`Inherited from ${LEVEL_LABELS[level]}${sourceName ? ` — ${sourceName}` : ""}`}
    >
      <ArrowDownRight data-icon="inline-start" className="size-3" />
      From {LEVEL_LABELS[level].toLowerCase()}
      {sourceName ? ` · ${sourceName}` : ""}
    </Badge>
  )
}

export function OverrideBadge({
  conflicting = false,
  className,
}: {
  conflicting?: boolean
  className?: string
}) {
  return (
    <Badge
      variant="secondary"
      className={cn(
        conflicting
          ? "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
          : "bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300",
        className
      )}
    >
      <GitBranch data-icon="inline-start" className="size-3" />
      {conflicting ? "Conflicting override" : "Overridden at role level"}
    </Badge>
  )
}

/**
 * A single overridden field: what it inherited, what it says now, and a way back.
 * The struck-through inherited value is the point — an override with the original
 * hidden is indistinguishable from a plain edit.
 */
export function OverrideRow({
  label,
  inheritedValue,
  inheritedFromLevel,
  overrideValue,
  reason,
  conflicting = false,
  className,
}: {
  label: string
  inheritedValue: string
  inheritedFromLevel: KnowledgeLevel
  overrideValue: string
  reason?: string | null
  conflicting?: boolean
  className?: string
}) {
  return (
    <div className={cn("space-y-1.5 rounded-lg border border-border p-3", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">{label}</span>
        <OverrideBadge conflicting={conflicting} />
      </div>

      <p className="text-sm">{overrideValue}</p>

      <p className="text-xs text-muted-foreground">
        <span className="line-through">{inheritedValue}</span>
        <span className="ml-1.5">
          inherited from {LEVEL_LABELS[inheritedFromLevel].toLowerCase()}
        </span>
      </p>

      {reason && <p className="text-xs text-muted-foreground">{reason}</p>}

      <Button variant="ghost" size="sm" className="-ml-2 h-auto px-2 py-1 text-xs">
        Revert to inherited value
      </Button>
    </div>
  )
}
