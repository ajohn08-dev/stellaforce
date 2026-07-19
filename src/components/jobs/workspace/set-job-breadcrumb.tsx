"use client"

import { useSetBreadcrumb } from "@/lib/breadcrumb-context"

/** Registers "Jobs > {title} [badge]" as the top-nav breadcrumb while this page is mounted. */
export function SetJobBreadcrumb({
  title,
  badge,
}: {
  title: string
  badge?: string
}) {
  useSetBreadcrumb([{ label: "Jobs", href: "/jobs" }, { label: title, badge }])
  return null
}
