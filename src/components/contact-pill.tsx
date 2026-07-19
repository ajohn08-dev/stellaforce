import type { ReactNode } from "react"

/** Rounded contact-info pill (LinkedIn, email, phone, GitHub, ...) — used on candidate profile/detail headers. */
export function ContactPill({
  href,
  icon,
  label,
}: {
  href: string
  icon: ReactNode
  label: string
}) {
  const newTab = href.startsWith("http")
  return (
    <a
      href={href}
      target={newTab ? "_blank" : undefined}
      rel={newTab ? "noopener noreferrer" : undefined}
      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
    >
      {icon}
      {label}
    </a>
  )
}
