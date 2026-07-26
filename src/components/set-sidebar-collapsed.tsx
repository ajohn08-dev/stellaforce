"use client"

import { useSidebarDefaultCollapsed } from "@/lib/sidebar-context"

/** Collapses the app sidebar by default while this page is mounted. */
export function SetSidebarCollapsed() {
  useSidebarDefaultCollapsed(true)
  return null
}
