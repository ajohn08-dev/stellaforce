import {
  Bot,
  Briefcase,
  Building2,
  Home,
  Mic,
  Plug,
  Settings,
  Users,
  Workflow,
} from "lucide-react"
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
]

export const AGENTS_NAV_LABEL = "Agents"

export const AGENTS_NAV_ITEMS: NavItem[] = [
  { href: "/agents/screening", label: "Screening Agent", icon: Bot },
  { href: "/agents/interview", label: "Interview Agent", icon: Mic },
]

/** Bottom-pinned nav items, in display order (Settings always last). */
export const BOTTOM_NAV_ITEMS: NavItem[] = [
  { href: "/clients", label: "Clients", icon: Building2 },
  { href: "/integrations", label: "Integrations", icon: Plug },
  { href: "/workflows", label: "Workflows", icon: Workflow },
  { href: "/settings", label: "Settings", icon: Settings },
]
