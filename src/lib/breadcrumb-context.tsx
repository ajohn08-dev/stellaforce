"use client"

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react"

export type BreadcrumbSegment = { label: string; href?: string; badge?: string }

type BreadcrumbContextValue = {
  items: BreadcrumbSegment[] | null
  setItems: (items: BreadcrumbSegment[] | null) => void
}

const BreadcrumbContext = createContext<BreadcrumbContextValue | null>(null)

export function BreadcrumbProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<BreadcrumbSegment[] | null>(null)
  return (
    <BreadcrumbContext.Provider value={{ items, setItems }}>
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

/** Call from a page to set the header's breadcrumb trail. Clears itself on unmount so the next page doesn't inherit it. */
export function useSetBreadcrumb(items: BreadcrumbSegment[]) {
  const { setItems } = useBreadcrumbContext()
  const key = JSON.stringify(items)

  useEffect(() => {
    setItems(items)
    return () => setItems(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
}
