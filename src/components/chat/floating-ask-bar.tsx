"use client"

import * as React from "react"

import { LogoMark } from "@/components/brand-logo"
import { AskComposer } from "@/components/chat/ask-composer"

/**
 * The collapsed-pill wrapper around `AskComposer`, pinned to the bottom of the
 * content region. Used by the home ask bar and the candidates ask bar — the two
 * places where chat is an occasional aside on a page that is mostly something
 * else, so a permanently-open composer would be furniture.
 *
 * `/chat` and the Advanced Search AI tab render `AskComposer` directly instead:
 * there, typing is the point, so it is open by default.
 *
 * `position: fixed` is scoped to `#app-content`, which sets `contain: layout`
 * in the app layout — so the bar centres over the content region rather than
 * the whole viewport and never drifts under the sidebar.
 */
export function FloatingAskBar({
  placeholder,
  onSend,
  prompts,
  srLabel,
}: {
  placeholder: string
  onSend: (message: string) => void
  prompts?: string[]
  /** Names the collapsed pill for screen readers. */
  srLabel: string
}) {
  const [expanded, setExpanded] = React.useState(false)
  const rootRef = React.useRef<HTMLDivElement>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)

  // Collapse on an outside click, but only with nothing typed: silently
  // discarding a half-written message because someone clicked the page behind
  // it is the one behaviour that would make this bar untrustworthy.
  React.useEffect(() => {
    if (!expanded) return
    function onPointerDown(e: PointerEvent) {
      if (rootRef.current?.contains(e.target as Node)) return
      if (!inputRef.current?.value.trim()) setExpanded(false)
    }
    document.addEventListener("pointerdown", onPointerDown)
    return () => document.removeEventListener("pointerdown", onPointerDown)
  }, [expanded])

  return (
    <div
      ref={rootRef}
      // The wrapper spans the content width so the bar can centre in it, but
      // stays click-through — otherwise an invisible full-width strip would
      // swallow clicks on the page behind it.
      className="pointer-events-none fixed inset-x-0 bottom-6 z-30 flex justify-center px-4"
    >
      {expanded ? (
        <div className="pointer-events-auto w-[min(46rem,100%)]">
          <AskComposer
            placeholder={placeholder}
            prompts={prompts}
            onSend={onSend}
            affordances
            autoFocus
            inputRef={inputRef}
            onEscape={() => setExpanded(false)}
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          // Fixed 100x25 for the resting state, with the 12px mark centred in
          // it — the logo keeps its own 39:23 ratio rather than stretching.
          className="pointer-events-auto inline-flex h-[25px] w-[100px] items-center justify-center rounded-full bg-secondary shadow-lg ring-1 ring-black/5 transition-colors hover:bg-brand-neutral-200"
        >
          <LogoMark height={12} />
          <span className="sr-only">{srLabel}</span>
        </button>
      )}
    </div>
  )
}
