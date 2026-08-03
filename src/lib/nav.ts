import {
  BarChart3,
  Bot,
  Briefcase,
  Building2,
  Home,
  MessageCircle,
  MessageSquare,
  Plug,
  Settings,
  SlidersHorizontal,
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
  { href: "/chat", label: "Chat", icon: MessageCircle },
]

export const AGENTS_NAV_LABEL = "Agents"

export const AGENTS_NAV_ITEMS: NavItem[] = [
  { href: "/agents/home", label: "Agent Home", icon: Bot },
  { href: "/agents/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/agents/conversations", label: "Conversations", icon: MessageSquare },
  { href: "/agents/configurations", label: "Configurations", icon: SlidersHorizontal },
]

/** Bottom-pinned nav items, in display order (Settings always last). */
export const BOTTOM_NAV_ITEMS: NavItem[] = [
  { href: "/clients", label: "Clients", icon: Building2 },
  { href: "/integrations", label: "Integrations", icon: Plug },
  { href: "/workflows", label: "Workflows", icon: Workflow },
  { href: "/settings", label: "Settings", icon: Settings },
]
