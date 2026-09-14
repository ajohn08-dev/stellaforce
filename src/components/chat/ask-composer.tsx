"use client"

import * as React from "react"
import { ArrowUp, MessageCircle, PanelRight, Plus, Settings2, type LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * The one chat composer. Every place in the product that takes a typed message
 * renders this — the home ask bar, the candidates ask bar, the /chat page, and
 * the Advanced Search AI tab.
 *
 * It existed as three different shapes before: a pill with a circular send
 * button on the two ask bars, and a `rounded-lg` textarea with a square send
 * button on /chat and in the search rail. Same gesture, three visual languages,
 * so the chat read as three unrelated features.
 *
 * **What is fixed and what varies.** The field, its roundness, the suggestion
 * chips and the send button are identical everywhere — those are the parts a
 * recruiter recognises. What varies is only what a surface genuinely doesn't
 * have: `prompts` (the candidates bar offers none) and `affordances` (the
 * narrow search rail has no room for the inert +/options/panel icons). Neither
 * changes the shape of the thing.
 *
 * Positioning and collapsing are deliberately *not* here — see
 * `floating-ask-bar.tsx` for the pill-that-expands wrapper. This component is
 * always open, which is what /chat and the search rail want directly.
 */
export function AskComposer({
  placeholder,
  onSend,
  prompts,
  affordances = false,
  autoFocus = false,
  disabled = false,
  inputRef: externalInputRef,
  onEscape,
  className,
}: {
  placeholder: string
  /** Receives the trimmed message. Never called with empty text. */
  onSend: (message: string) => void
  /** Shown above the field; clicking one fills it rather than sending. */
  prompts?: string[]
  /** The inert +, options and side-panel icons. Off where there's no room. */
  affordances?: boolean
  autoFocus?: boolean
  /** Blocks sending while a request is in flight. */
  disabled?: boolean
  inputRef?: React.RefObject<HTMLInputElement | null>
  /** Lets a collapsible wrapper close itself on Escape. */
  onEscape?: () => void
  className?: string
}) {
  const [value, setValue] = React.useState("")
  const localRef = React.useRef<HTMLInputElement>(null)
  const inputRef = externalInputRef ?? localRef

  const hasQuery = value.trim().length > 0

  React.useEffect(() => {
    if (autoFocus) inputRef.current?.focus()
    // Mount-only: the wrapper remounts this when it opens.
  }, [autoFocus, inputRef])

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const message = value.trim()
    if (!message || disabled) return
    onSend(message)
    setValue("")
  }

  return (
    <div className={cn("flex w-full flex-col gap-2", className)}>
      {prompts && prompts.length > 0 && (
        // Above the field, scrolling sideways rather than wrapping — a long
        // prompt set must not grow the composer upward over the page.
        <div className="no-scrollbar flex shrink-0 flex-nowrap gap-2 overflow-x-auto">
          {prompts.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => {
                setValue(prompt)
                inputRef.current?.focus()
              }}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-white px-3 py-1.5 text-xs font-medium text-foreground shadow-sm transition-colors hover:bg-muted dark:bg-white"
            >
              <MessageCircle className="size-3.5" />
              {prompt}
            </button>
          ))}
        </div>
      )}

      <form
        onSubmit={submit}
        className="flex w-full items-center gap-1 rounded-full border border-border bg-white py-2 pr-2 pl-3 shadow-xl ring-4 ring-ring/10 dark:bg-white"
      >
        {affordances && (
          <>
            <Affordance icon={Plus} label="Add context" />
            <Affordance icon={Settings2} label="Options" />
          </>
        )}
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault()
              setValue("")
              onEscape?.()
            }
          }}
          placeholder={placeholder}
          aria-label={placeholder}
          className="min-w-0 flex-1 bg-transparent px-2 text-sm text-foreground outline-none placeholder:text-muted-foreground"
        />
        {affordances && (
          <Affordance icon={PanelRight} label="Open in a side panel" />
        )}
        <button
          type="submit"
          disabled={!hasQuery || disabled}
          aria-label="Send"
          className={cn(
            "grid size-9 shrink-0 place-items-center rounded-full transition-colors",
            hasQuery && !disabled
              ? "bg-primary text-primary-foreground hover:bg-primary/80"
              : "bg-muted text-muted-foreground"
          )}
        >
          <ArrowUp className="size-4" />
        </button>
      </form>
    </div>
  )
}

/**
 * A rendered-but-inert control. Present so the composer looks complete where
 * there is room for it; each needs an action decided before it does anything.
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
