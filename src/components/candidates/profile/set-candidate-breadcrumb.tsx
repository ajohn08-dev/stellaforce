"use client"

import { useSetBreadcrumb } from "@/lib/breadcrumb-context"

/** Registers "Candidates > {name}" as the top-nav breadcrumb while this page is mounted. */
export function SetCandidateBreadcrumb({ name }: { name: string }) {
  useSetBreadcrumb([{ label: "Candidates", href: "/candidates" }, { label: name }])
  return null
}
