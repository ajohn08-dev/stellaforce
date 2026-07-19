"use client"

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react"

type SidebarContextValue = {
  collapsed: boolean
  setCollapsed: (collapsed: boolean) => void
}

const SidebarContext = createContext<SidebarContextValue | null>(null)

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)
  return (
    <SidebarContext.Provider value={{ collapsed, setCollapsed }}>
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

/** Call from a page to collapse (or expand) the sidebar by default when it mounts. */
export function useSidebarDefaultCollapsed(collapsed: boolean) {
  const { setCollapsed } = useSidebarContext()

  useEffect(() => {
    setCollapsed(collapsed)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collapsed])
}
