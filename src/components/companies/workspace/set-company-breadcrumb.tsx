"use client"

import { useSetBreadcrumb } from "@/lib/breadcrumb-context"

/**
 * Registers "Companies › {name}" as the header breadcrumb while this workspace
 * is mounted.
 *
 * A client-side viewer gets a single crumb instead — "Company Profile › {name}"
 * with nothing to click. The parent crumb links to `/companies`, a list they
 * can't open, and a trail implying they're one of several companies is exactly
 * the impression this workspace must not give.
 */
export function SetCompanyBreadcrumb({
  name,
  isOwnCompany = false,
}: {
  name: string
  isOwnCompany?: boolean
}) {
  useSetBreadcrumb(
    isOwnCompany
      ? [{ label: "Company Profile" }, { label: name }]
      : [{ label: "Companies", href: "/companies" }, { label: name }]
  )
  return null
}
