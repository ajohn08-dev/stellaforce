"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react"

import { SIDEBAR_COOKIE } from "@/lib/sidebar-cookie"

type SidebarContextValue = {
  collapsed: boolean
  setCollapsed: (collapsed: boolean) => void
  setOverride: (collapsed: boolean | null) => void
}

const SidebarContext = createContext<SidebarContextValue | null>(null)

export function SidebarProvider({
  children,
  initialCollapsed = true,
}: {
  children: ReactNode
  initialCollapsed?: boolean
}) {
  // The user's own choice, mirrored to a cookie so it survives reloads.
  const [preference, setPreference] = useState(initialCollapsed)
  // A transient, route-scoped force (see useSidebarDefaultCollapsed) that wins
  // while set but never overwrites the stored preference.
  const [override, setOverride] = useState<boolean | null>(null)

  const setCollapsed = useCallback((next: boolean) => {
    setPreference(next)
    // An explicit toggle beats whatever the current page asked for.
    setOverride(null)
    document.cookie = `${SIDEBAR_COOKIE}=${next ? "1" : "0"}; path=/; max-age=31536000; samesite=lax`
  }, [])

  return (
    <SidebarContext.Provider
      value={{ collapsed: override ?? preference, setCollapsed, setOverride }}
    >
      {children}
    </SidebarContext.Provider>
  )
}

function useSidebarContext() {
  const ctx = useContext(SidebarContext)
  if (!ctx) {
    throw new Error("Sidebar hooks must be used within a SidebarProvider")
  }
  return ctx
}

/** Read and toggled by AppSidebar. */
export function useSidebarState() {
  const { collapsed, setCollapsed } = useSidebarContext()
  return [collapsed, setCollapsed] as const
}

/**
 * Call from a page to collapse (or expand) the sidebar while it is mounted.
 * The user's stored preference is left untouched and restored on unmount.
 */
export function useSidebarDefaultCollapsed(collapsed: boolean) {
  const { setOverride } = useSidebarContext()

  useEffect(() => {
    setOverride(collapsed)
    return () => setOverride(null)
  }, [collapsed, setOverride])
}
