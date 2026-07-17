import { Bot, Briefcase, Building2, Home, Settings, Users } from "lucide-react"
import type { LucideIcon } from "lucide-react"

export type NavItem = {
  href: string
  label: string
  icon: LucideIcon
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/jobs", label: "Jobs", icon: Briefcase },
  { href: "/candidates", label: "Candidates", icon: Users },
  { href: "/clients", label: "Clients", icon: Building2 },
]

export const AGENTS_NAV_LABEL = "Agents"

export const AGENTS_NAV_ITEMS: NavItem[] = [
  { href: "/agents/screening", label: "Screening Agent", icon: Bot },
]

export const SETTINGS_ITEM: NavItem = {
  href: "/settings",
  label: "Settings",
  icon: Settings,
}
