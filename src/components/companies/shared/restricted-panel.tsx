"use client"

import * as React from "react"
import { ChevronRight, Lock } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * Restricted content, collapsed by default.
 *
 * Three deliberate behaviors:
 *  - It shows the **reason** and the title, never the body, until expanded.
 *  - Expanding is announced as logged, before the click, not after.
 *  - For users who may know restricted notes exist but not read them, callers
 *    pass `canExpand={false}` and get a count stub instead. For everyone else
 *    the panel isn't rendered at all — a locked box advertises that there is
 *    something worth wanting.
 */
export function RestrictedPanel({
  title,
  reason,
  canExpand = true,
  children,
  className,
}: {
  title: string
  reason?: string
  canExpand?: boolean
  children: React.ReactNode
  className?: string
}) {
  const [open, setOpen] = React.useState(false)

  return (
    <div
      className={cn(
        "rounded-lg border border-dashed border-border bg-muted/30",
        className
      )}
    >
      <button
        type="button"
        disabled={!canExpand}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex w-full items-start gap-2.5 p-3 text-left",
          canExpand ? "cursor-pointer" : "cursor-default"
        )}
      >
        <Lock className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="text-sm font-medium">{title}</span>
            <span className="text-xs text-muted-foreground">Restricted</span>
          </span>
          <span className="mt-0.5 block text-xs text-muted-foreground">
            {canExpand
              ? (reason ?? "Named staff only. Never leaves your team, never reaches an agent.")
              : "You don't have access to open this note."}
          </span>
          {canExpand && !open && (
            <span className="mt-1 block text-xs text-muted-foreground">
              Opening a restricted note is recorded in the audit log.
            </span>
          )}
        </span>
        {canExpand && (
          <ChevronRight
            className={cn(
              "mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform",
              open && "rotate-90"
            )}
          />
        )}
      </button>

      {canExpand && open && (
        <div className="border-t border-border p-3 text-sm">{children}</div>
      )}
    </div>
  )
}

/** What internal staff without restricted access see in place of the notes. */
export function RestrictedStub({ count, className }: { count: number; className?: string }) {
  if (count <= 0) return null
  return (
    <p
      className={cn(
        "flex items-center gap-2 rounded-lg border border-dashed border-border px-3 py-2.5 text-xs text-muted-foreground",
        className
      )}
    >
      <Lock className="size-3.5 shrink-0" />
      {count} restricted note{count === 1 ? "" : "s"} — not available to you.
    </p>
  )
}
