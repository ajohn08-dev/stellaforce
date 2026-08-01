"use client"

import { createContext, useContext, useEffect, useState, type ReactNode } from "react"

/**
 * Split into two contexts, not one `{ content, setContent }` value: a page
 * calling `useSetHeaderActions` only ever needs the setter, never the
 * content itself. If both lived in one context, every page that *writes*
 * header actions would also be subscribed to (and re-render on) `content`
 * changes it caused itself — and since `content` is a JSX node that's a new
 * object reference on every render, naively re-pushing it on every change
 * caused a real "Maximum update depth exceeded" infinite loop (effect ->
 * setContent -> provider re-renders -> caller re-renders because it reads
 * `content` too -> new reference -> effect reruns -> ...). `useState`'s
 * setter is referentially stable across renders, so a writer that only
 * subscribes to *that* context never re-renders from its own writes, and
 * `useSetHeaderActions` can safely re-push on every real content change
 * instead of freezing whatever was passed in on the first render.
 */
const HeaderActionsContentContext = createContext<ReactNode | null>(null)
const HeaderActionsSetterContext = createContext<((content: ReactNode | null) => void) | null>(
  null
)

export function HeaderActionsProvider({ children }: { children: ReactNode }) {
  const [content, setContent] = useState<ReactNode | null>(null)
  return (
    <HeaderActionsSetterContext.Provider value={setContent}>
      <HeaderActionsContentContext.Provider value={content}>
        {children}
      </HeaderActionsContentContext.Provider>
    </HeaderActionsSetterContext.Provider>
  )
}

/**
 * Read by AppHeader — a page-supplied node replaces the default
 * notifications/avatar block entirely; null falls back to the default.
 */
export function useHeaderActionsContent() {
  return useContext(HeaderActionsContentContext)
}

/**
 * Call from a page to replace the header's right-side content (notifications
 * + avatar) with custom actions for as long as the page is mounted, updating
 * it whenever `content` changes. Clears itself on unmount so the next page
 * doesn't inherit it.
 */
export function useSetHeaderActions(content: ReactNode) {
  const setContent = useContext(HeaderActionsSetterContext)
  if (!setContent) {
    throw new Error("useSetHeaderActions must be used within a HeaderActionsProvider")
  }

  useEffect(() => {
    setContent(content)
    return () => setContent(null)
  }, [content, setContent])
}
