"use client"

import { useSetBreadcrumb } from "@/lib/breadcrumb-context"

/** Registers "Jobs > {title}" as the top-nav breadcrumb while this page is mounted. */
export function SetJobBreadcrumb({ title }: { title: string }) {
  useSetBreadcrumb([{ label: "Jobs", href: "/jobs" }, { label: title }])
  return null
}
