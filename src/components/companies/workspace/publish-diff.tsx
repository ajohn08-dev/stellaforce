"use client"

import { cn } from "@/lib/utils"
import type { PendingChange } from "@/components/companies/company-draft-context"
import { diffLists, diffWords, similarity } from "@/lib/text-diff"

/**
 * One change, shown as what it said and what it will say.
 *
 * **Colour choice, deliberately narrow.** The company page reserves red for
 * "something is wrong right now" (see `section-note.tsx`), so a deletion here is
 * *not* red — it's struck through and muted, which reads as "gone" without
 * borrowing the alarm. Additions use emerald, which isn't in that vocabulary at
 * all and is the universal convention for added text. A diff is data, not a
 * message, and it shouldn't spend the page's one alarm colour.
 *
 * **Two layouts, picked by how much survived.** Interleaving works when an edit
 * is a few words inside a sentence — you read the sentence once and see the
 * change in place. When a paragraph is rewritten wholesale, interleaving shreds
 * the two texts together and is less readable than simply showing both, so below
 * 30% similarity it falls back to *was* / *now* blocks.
 */
export function PublishDiff({ change }: { change: PendingChange }) {
  const { baseline, value } = change

  if (Array.isArray(baseline) || Array.isArray(value)) {
    return (
      <ListDiff
        before={Array.isArray(baseline) ? baseline : [String(baseline)]}
        after={Array.isArray(value) ? value : [String(value)]}
      />
    )
  }

  const before = String(baseline)
  const after = String(value)

  if (!before.trim()) {
    return (
      <p className="text-sm">
        <span className="text-xs text-muted-foreground">Added — </span>
        <Added>{after}</Added>
      </p>
    )
  }

  if (!after.trim()) {
    return (
      <p className="text-sm">
        <span className="text-xs text-muted-foreground">Cleared — </span>
        <Removed>{before}</Removed>
      </p>
    )
  }

  const segments = diffWords(before, after)

  if (similarity(segments) < 0.3) {
    return (
      <div className="space-y-1 text-sm">
        <p>
          <Label>was</Label>
          <Removed>{before}</Removed>
        </p>
        <p>
          <Label>now</Label>
          <Added>{after}</Added>
        </p>
      </div>
    )
  }

  return (
    <p className="text-sm leading-6">
      {segments.map((segment, i) =>
        segment.kind === "same" ? (
          <span key={i}>{segment.text}</span>
        ) : segment.kind === "removed" ? (
          <Removed key={i}>{segment.text}</Removed>
        ) : (
          <Added key={i}>{segment.text}</Added>
        )
      )}
    </p>
  )
}

function ListDiff({ before, after }: { before: string[]; after: string[] }) {
  const { added, removed, kept } = diffLists(before, after)

  return (
    <p className="flex flex-wrap items-center gap-1.5 text-sm">
      {kept.map((v) => (
        <span key={v} className="rounded-md bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
          {v}
        </span>
      ))}
      {removed.map((v) => (
        <span
          key={v}
          className="rounded-md bg-muted px-1.5 py-0.5 text-xs text-muted-foreground line-through"
        >
          {v}
        </span>
      ))}
      {added.map((v) => (
        <span
          key={v}
          className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-xs text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
        >
          {v}
        </span>
      ))}
    </p>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return <span className="mr-1.5 text-xs text-muted-foreground">{children}</span>
}

function Removed({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("text-muted-foreground line-through", className)}>{children}</span>
  )
}

function Added({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "rounded-[3px] bg-emerald-50 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200",
        className
      )}
    >
      {children}
    </span>
  )
}
