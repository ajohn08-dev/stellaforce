import { AlertOctagon, AlertTriangle, Ban, Lock } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * **Every block of prose on the company page, and there are only four kinds.**
 *
 * Before this there were five visual treatments for "here is some information",
 * and red meant four different things: a blocking readiness failure, a standing
 * prohibition, a `restricted` clearance, and a knowledge item past its review
 * date. Amber meant four more. When a permanent rule that *cannot be changed*
 * shouts as loudly as a broken agent, the colour stops carrying information and
 * people stop reading both.
 *
 * The kinds are separated by **what the reader can do about it**:
 *
 * | Kind | Means | Can you act? | Colour |
 * |---|---|---|---|
 * | `rule` | Always true here, can't be switched off | **No** — read once | None. Quiet. |
 * | `attention` | Something needs you; nothing is broken | Yes | Amber |
 * | `blocking` | An agent can't run, or a candidate hears something wrong | Yes, now | **Red — only here** |
 * | `empty` | Nothing recorded yet | Optionally | Dashed, muted |
 *
 * The counter-intuitive one is `rule`. A standing prohibition —
 * *"never confirm a figure"* — feels like the most serious thing on the page, so
 * it got the loudest styling. But it is the system **working**, not failing, and
 * there is no action attached to it. Making it calm is what lets red keep
 * meaning "this is wrong right now".
 *
 * Orientation — *what is this section for* — is not on this list. It already has
 * a home in `SectionDef.purpose`, rendered under every section title, and a
 * second box repeating it is the inconsistency this component exists to remove.
 */

export type SectionNoteKind = "rule" | "attention" | "blocking" | "empty"

const STYLES: Record<SectionNoteKind, { box: string; icon: string }> = {
  rule: {
    box: "border-border bg-muted/40",
    icon: "text-muted-foreground",
  },
  attention: {
    box: "border-amber-500/30 bg-amber-50/60 dark:bg-amber-950/20",
    icon: "text-amber-600 dark:text-amber-400",
  },
  blocking: {
    box: "border-destructive/30 bg-destructive/[0.04]",
    icon: "text-destructive",
  },
  empty: {
    box: "border-dashed border-border",
    icon: "text-muted-foreground",
  },
}

const ICONS: Record<SectionNoteKind, typeof Lock> = {
  rule: Lock,
  attention: AlertTriangle,
  blocking: AlertOctagon,
  empty: Ban,
}

export function SectionNote({
  kind,
  title,
  children,
  icon,
  className,
}: {
  kind: SectionNoteKind
  /** Optional lead line. Without one the body carries the whole message. */
  title?: string
  children?: React.ReactNode
  /** Override the icon — a prohibition reads better with a `Ban` than a padlock. */
  icon?: React.ReactNode
  className?: string
}) {
  const style = STYLES[kind]
  const Icon = ICONS[kind]

  return (
    <div
      className={cn(
        "flex items-start gap-2.5 rounded-lg border p-3 text-sm",
        style.box,
        className
      )}
    >
      <span className={cn("mt-0.5 shrink-0", style.icon)}>
        {icon ?? <Icon className="size-4" />}
      </span>
      <div className="min-w-0 flex-1">
        {title && <p className="font-medium">{title}</p>}
        {children && (
          <div className={cn("text-muted-foreground", title && "mt-0.5")}>{children}</div>
        )}
      </div>
    </div>
  )
}
