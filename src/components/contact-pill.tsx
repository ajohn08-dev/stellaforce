import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

/** Rounded contact-info pill (LinkedIn, email, phone, GitHub, ...) — used on candidate profile/detail headers. */
export function ContactPill({
  href,
  icon,
  label,
  className,
}: {
  href: string
  icon: ReactNode
  label: string
  className?: string
}) {
  const newTab = href.startsWith("http")
  return (
    <a
      href={href}
      target={newTab ? "_blank" : undefined}
      rel={newTab ? "noopener noreferrer" : undefined}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:text-accent-foreground",
        className
      )}
    >
      {icon}
      {label}
    </a>
  )
}
