"use client"

import { useSetBreadcrumb } from "@/lib/breadcrumb-context"

/** Registers "Companies › {name}" as the header breadcrumb while this workspace is mounted. */
export function SetCompanyBreadcrumb({ name }: { name: string }) {
  useSetBreadcrumb([{ label: "Companies", href: "/companies" }, { label: name }])
  return null
}
