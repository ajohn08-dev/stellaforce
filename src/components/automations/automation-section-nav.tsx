"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"

import { cn } from "@/lib/utils"
import {
  AUTOMATION_SECTIONS,
  type AutomationSectionKey,
} from "@/lib/automation-sections"

/**
 * The rail below the toolbar. Links rather than local state, so every section
 * is deep-linkable — and each one carries the current search and filter
 * forward, since changing section shouldn't silently clear what you typed.
 */
export function AutomationSectionNav({ active }: { active: AutomationSectionKey }) {
  const params = useSearchParams()

  function hrefFor(key: AutomationSectionKey) {
    const sp = new URLSearchParams(params.toString())
    sp.set("section", key)
    return `/automations?${sp.toString()}`
  }

  return (
    <nav className="flex w-56 shrink-0 flex-col gap-1">
      {AUTOMATION_SECTIONS.map((section) => (
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
