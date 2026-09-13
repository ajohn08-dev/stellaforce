"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  ArrowUp,
  PanelRight,
  Plus,
  Settings2,
  type LucideIcon,
} from "lucide-react"

import { LogoMark } from "@/components/brand-logo"
import { cn } from "@/lib/utils"

/**
 * Floating natural-language candidate search, pinned to the bottom of the
 * candidates page. Two states:
 *
 *   collapsed — an icon-only pill, the resting state
 *   expanded  — the composer: describe who you're looking for, then send
 *
 * `position: fixed` is scoped to `#app-content`, which sets `contain: layout`
 * in the app layout — so the bar centres over the content region rather than
 * the whole viewport and never drifts under the sidebar.
 *
 * UI only. Sending routes to /candidates/search with the query typed verbatim;
 * nothing parses it yet. The `+`, options and panel affordances are rendered
 * but deliberately inert until we've settled which actions belong here.
 */
export function CandidateAskBar() {
  const router = useRouter()
  const [expanded, setExpanded] = React.useState(false)
  const [value, setValue] = React.useState("")
  const rootRef = React.useRef<HTMLDivElement>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)

  const hasQuery = value.trim().length > 0

  // Focus the field as it opens — expanding it and then making the recruiter
  // click into it is one interaction too many.
  React.useEffect(() => {
    if (expanded) inputRef.current?.focus()
  }, [expanded])

  // Collapse on an outside click, but only with nothing typed: silently
  // discarding a half-written query because someone clicked the table is the
  // one behaviour that would make this bar untrustworthy.
  React.useEffect(() => {
    if (!expanded) return
    function onPointerDown(e: PointerEvent) {
      if (rootRef.current?.contains(e.target as Node)) return
      setValue((current) => {
        if (!current.trim()) setExpanded(false)
        return current
      })
    }
    document.addEventListener("pointerdown", onPointerDown)
    return () => document.removeEventListener("pointerdown", onPointerDown)
  }, [expanded])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const query = value.trim()
    if (!query) return
    router.push(`/candidates/search?q=${encodeURIComponent(query)}`)
  }

  return (
    <div
      ref={rootRef}
      // The wrapper spans the content width so the bar can centre in it, but
      // stays click-through — otherwise an invisible full-width strip would
      // swallow clicks on the table rows behind it.
      className="pointer-events-none fixed inset-x-0 bottom-6 z-30 flex justify-center px-4"
    >
      {expanded ? (
        <form
          onSubmit={handleSubmit}
          className="pointer-events-auto flex w-[min(46rem,100%)] items-center gap-1 rounded-full border border-border bg-white py-2 pr-2 pl-3 shadow-xl ring-4 ring-ring/10 dark:bg-white"
        >
          <Affordance icon={Plus} label="Add context to this search" />
          <Affordance icon={Settings2} label="Search options" />
          <input
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault()
                setValue("")
                setExpanded(false)
              }
            }}
            placeholder="Find a product designer with fintech experience, open to contract…"
            aria-label="Describe the candidate you're looking for"
            className="min-w-0 flex-1 bg-transparent px-2 text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
          <Affordance icon={PanelRight} label="Open results in a side panel" />
          <button
            type="submit"
            disabled={!hasQuery}
            aria-label="Search candidates"
            className={cn(
              "grid size-9 shrink-0 place-items-center rounded-full transition-colors",
              hasQuery
                ? "bg-primary text-primary-foreground hover:bg-primary/80"
                : "bg-muted text-muted-foreground"
            )}
          >
            <ArrowUp className="size-4" />
          </button>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          // Fixed 100x25 for the resting state, with the 12px mark centred in
          // it — the logo keeps its own 39:23 ratio rather than stretching to
          // the pill.
          className="pointer-events-auto inline-flex h-[25px] w-[100px] items-center justify-center rounded-full bg-secondary shadow-lg ring-1 ring-black/5 transition-colors hover:bg-brand-neutral-200"
        >
          <LogoMark height={12} />
          <span className="sr-only">Search candidates in your own words</span>
        </button>
      )}
    </div>
  )
}

/**
 * A rendered-but-inert control. Present so the two states match the agreed
 * design; each needs an action decided before it does anything.
 */
function Affordance({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      className="grid size-8 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      <Icon className="size-[18px]" />
    </button>
  )
}
