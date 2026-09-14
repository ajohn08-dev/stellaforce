"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"

import { cn } from "@/lib/utils"
import { SETTINGS_SECTIONS, type SettingsSectionKey } from "@/lib/settings-sections"

/**
 * The rail inside Platform settings. Links rather than local state, so every
 * section is deep-linkable — and each carries the current query forward, since
 * changing section shouldn't silently clear anything else in the URL.
 *
 * Deliberately the same markup as `AutomationSectionNav`: two rails that look
 * different teach the reader they work differently.
 */
export function SettingsSectionNav({ active }: { active: SettingsSectionKey }) {
  const params = useSearchParams()

  function hrefFor(key: SettingsSectionKey) {
    const sp = new URLSearchParams(params.toString())
    sp.set("section", key)
    return `/settings/platform?${sp.toString()}`
  }

  return (
    <nav className="flex w-56 shrink-0 flex-col gap-1">
      {SETTINGS_SECTIONS.map((section) => (
        <Link
          key={section.key}
          href={hrefFor(section.key)}
          className={cn(
            "rounded-md px-3 py-2 text-left text-sm transition-colors",
            active === section.key
              ? "bg-brand-orange-100 font-medium text-foreground"
              : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
          )}
        >
          {section.label}
        </Link>
      ))}
    </nav>
  )
}
