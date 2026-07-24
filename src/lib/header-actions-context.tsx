"use client"

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react"

type HeaderActionsContextValue = {
  content: ReactNode | null
  setContent: (content: ReactNode | null) => void
}

const HeaderActionsContext = createContext<HeaderActionsContextValue | null>(null)

export function HeaderActionsProvider({ children }: { children: ReactNode }) {
  const [content, setContent] = useState<ReactNode | null>(null)
  return (
    <HeaderActionsContext.Provider value={{ content, setContent }}>
      {children}
    </HeaderActionsContext.Provider>
  )
}

function useHeaderActionsContext() {
  const ctx = useContext(HeaderActionsContext)
  if (!ctx) {
    throw new Error("Header actions hooks must be used within a HeaderActionsProvider")
  }
  return ctx
}

/**
 * Read by AppHeader — a page-supplied node replaces the default
 * notifications/avatar block entirely; null falls back to the default.
 */
export function useHeaderActionsContent() {
  return useHeaderActionsContext().content
}

/**
 * Call from a page to replace the header's right-side content (notifications
 * + avatar) with custom actions for as long as the page is mounted. Clears
 * itself on unmount so the next page doesn't inherit it.
 *
 * `content` is a JSX node — a new object reference on every render of the
 * caller — so it can't be a `useEffect` dependency directly (that caused a
 * real "Maximum update depth exceeded" infinite loop: effect re-runs ->
 * setContent -> provider re-renders -> caller re-renders -> new `content`
 * reference -> effect re-runs...). Two effects avoid that: one keeps a ref
 * current (runs every render, but only touches a ref — no state update, so
 * no re-render cascade); the other pushes to context once on mount/unmount,
 * reading the ref rather than depending on `content` directly. Ref writes
 * happen inside effects, never during render, per React's rules-of-refs.
 */
export function useSetHeaderActions(content: ReactNode) {
  const { setContent } = useHeaderActionsContext()
  const contentRef = useRef(content)

  useEffect(() => {
    contentRef.current = content
  }, [content])

  useEffect(() => {
    setContent(contentRef.current)
    return () => setContent(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
