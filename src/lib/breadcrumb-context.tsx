"use client"

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react"

export type BreadcrumbSegment = { label: string; href?: string; badge?: string }

/**
 * An explicit way out, rendered as "← Back" to the left of the trail.
 *
 * For screens you enter rather than browse to — Advanced Search is the first —
 * where the main side navigation is hidden and a breadcrumb trail alone would
 * leave no obvious exit.
 */
export type BreadcrumbBack = { href: string; label?: string }

type BreadcrumbContextValue = {
  items: BreadcrumbSegment[] | null
  back: BreadcrumbBack | null
  setItems: (items: BreadcrumbSegment[] | null) => void
  setBack: (back: BreadcrumbBack | null) => void
}

const BreadcrumbContext = createContext<BreadcrumbContextValue | null>(null)

export function BreadcrumbProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<BreadcrumbSegment[] | null>(null)
  const [back, setBack] = useState<BreadcrumbBack | null>(null)
  return (
    <BreadcrumbContext.Provider value={{ items, back, setItems, setBack }}>
      {children}
    </BreadcrumbContext.Provider>
  )
}

function useBreadcrumbContext() {
  const ctx = useContext(BreadcrumbContext)
  if (!ctx) {
    throw new Error("Breadcrumb hooks must be used within a BreadcrumbProvider")
  }
  return ctx
}

/** Read by AppHeader — null means "no page-specific breadcrumb set, fall back to the nav section title". */
export function useBreadcrumbItems() {
  return useBreadcrumbContext().items
}

/** Read by AppHeader — null means this page offers no explicit way back. */
export function useBreadcrumbBack() {
  return useBreadcrumbContext().back
}

/**
 * Call from a page to set the header's breadcrumb trail, and optionally a
 * "← Back" link before it. Clears both on unmount so the next page doesn't
 * inherit them.
 */
export function useSetBreadcrumb(
  items: BreadcrumbSegment[],
  back?: BreadcrumbBack
) {
  const { setItems, setBack } = useBreadcrumbContext()
  const key = JSON.stringify(items)
  const backKey = JSON.stringify(back ?? null)

  useEffect(() => {
    setItems(items)
    setBack(back ?? null)
    return () => {
      setItems(null)
      setBack(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, backKey])
}
