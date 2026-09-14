import {
  BarChart3,
  Bot,
  Briefcase,
  Building2,
  Home,
  Mail,
  MessageCircle,
  MessageSquare,
  Plug,
  Settings,
  SlidersHorizontal,
  Users,
  UsersRound,
  Workflow,
  Zap,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

// Type-only: `company-access` pulls in the company fixtures, and this module is
// imported by the client-side sidebar and header.
import type { CompanyAccess } from "@/lib/company-access"

export type NavItem = {
  href: string
  label: string
  icon: LucideIcon
}

/** A labelled group of nav items — rendered identically wherever it appears. */
export type NavSection = {
  label: string
  items: NavItem[]
}

/** The daily work, unlabelled and first. */
export const NAV_ITEMS: NavItem[] = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/jobs", label: "Jobs", icon: Briefcase },
  { href: "/candidates", label: "Candidates", icon: Users },
  { href: "/chat", label: "Chat", icon: MessageCircle },
]

export const AGENTS_NAV_SECTION: NavSection = {
  label: "Agents",
  items: [
    { href: "/agents/home", label: "Agent Home", icon: Bot },
    { href: "/agents/analytics", label: "Analytics", icon: BarChart3 },
    { href: "/agents/conversations", label: "Conversations", icon: MessageSquare },
    { href: "/agents/configurations", label: "Configurations", icon: SlidersHorizontal },
  ],
}

/**
 * How the operation is configured, rather than what's happening in it today —
 * the things you set up once and revisit occasionally. Sits under Agents,
 * labelled the same way, so the sidebar reads as three bands: work, agents,
 * setup.
 */
export const OPERATIONS_NAV_SECTION: NavSection = {
  label: "Operations",
  items: [
    { href: "/companies", label: "Companies", icon: Building2 },
    { href: "/workflows", label: "Workflows", icon: Workflow },
    { href: "/automations", label: "Automations", icon: Zap },
    { href: "/communications", label: "Communications", icon: Mail },
    { href: "/integrations", label: "Integrations", icon: Plug },
  ],
}

/** Bottom-pinned. */
export const SETTINGS_NAV_SECTION: NavSection = {
  label: "Settings",
  items: [
    { href: "/settings/team-access", label: "Team Access", icon: UsersRound },
    // No "Automations" entry here. `/automations` under Operations already owns
    // that word; the account-wide switch is a section of Platform settings, and
    // two sidebar items with the same label is worse than one extra click.
    { href: "/settings/platform", label: "Platform settings", icon: Settings },
  ],
}

/**
 * Operations as a given viewer sees it. A client-side profile has exactly one
 * company — their own — so the entry is singular (**Company Profile**) and
 * points straight at it; the plural label and the `/companies` list are
 * Stellaforce-side only. See `src/lib/company-access.ts`.
 *
 * Called in the client components rather than the server layout: a `NavItem`
 * carries a lucide `icon` component, which can't cross the server/client
 * boundary. `CompanyAccess` is a plain object and can, so that's what's passed
 * down.
 */
export function operationsSectionFor(access: CompanyAccess): NavSection {
  if (access.scope === "all") return OPERATIONS_NAV_SECTION
  return {
    ...OPERATIONS_NAV_SECTION,
    items: OPERATIONS_NAV_SECTION.items.map((item) =>
      item.href === "/companies"
        ? { ...item, href: `/companies/${access.companyId}`, label: "Company Profile" }
        : item
    ),
  }
}

/**
 * Routes that keep the top header but drop the main side navigation.
 *
 * These are *working* screens rather than destinations — you arrive from
 * somewhere specific, do one thing, and go back. Advanced Search is the first:
 * its own filter rail is the navigation while you're in it, and a second column
 * of app-level links beside it would compete with that.
 *
 * Listed here rather than achieved by moving the route into its own group,
 * because `(app)/candidates/[id]` also matches `/candidates/search` and two
 * groups resolving one path is a conflict Next resolves unpredictably. The
 * header, the providers and the URL all stay exactly as they are.
 *
 * Living under `/candidates` has one other cost, paid in `src/proxy.ts`: the
 * `@modal/(.)[id]` interception rewrite captures this path too, and has to be
 * suppressed by name or every soft navigation here 404s.
 */
export const SIDEBAR_HIDDEN_ROUTES: string[] = ["/candidates/search"]

export function hidesMainSidebar(pathname: string): boolean {
  return SIDEBAR_HIDDEN_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route + "/")
  )
}

/** Every nav item a viewer has, for resolving the current page's title. */
export function allNavItemsFor(access: CompanyAccess): NavItem[] {
  return [
    ...NAV_ITEMS,
    ...AGENTS_NAV_SECTION.items,
    ...operationsSectionFor(access).items,
    ...SETTINGS_NAV_SECTION.items,
  ]
}
