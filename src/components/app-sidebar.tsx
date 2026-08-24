"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { PanelLeftClose, PanelLeftOpen } from "lucide-react"

import { cn } from "@/lib/utils"
import {
  NAV_ITEMS,
  AGENTS_NAV_SECTION,
  SETTINGS_NAV_SECTION,
  operationsSectionFor,
  type NavItem,
  type NavSection,
} from "@/lib/nav"
import type { CompanyAccess } from "@/lib/company-access"
import { useSidebarState } from "@/lib/sidebar-context"
import { Logo } from "@/components/brand-logo"
import { Button } from "@/components/ui/button"

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/")
}

function NavLink({
  href,
  label,
  icon: Icon,
  active,
  collapsed,
}: {
  href: string
  label: string
  icon: NavItem["icon"]
  active: boolean
  collapsed: boolean
}) {
  return (
    <Link
      href={href}
      title={collapsed ? label : undefined}
      className={cn(
        // Fixed `h-8` rather than vertical padding: a padded row is 20px of
        // text line-height expanded but a 16px icon collapsed, so every row
        // would shrink 4px and the whole rail would creep upwards.
        "flex h-8 items-center gap-2.5 rounded-md px-2.5 text-sm transition-colors",
        collapsed && "justify-center px-0",
        active
          ? "bg-accent text-accent-foreground font-medium"
          : "text-foreground hover:text-sidebar-accent-foreground hover:bg-sidebar-accent"
      )}
    >
      <Icon className="size-4 shrink-0" />
      {!collapsed && label}
    </Link>
  )
}

/** A labelled group — Agents, Operations and Settings all render through this, so they can't drift apart. */
function NavGroup({
  section,
  pathname,
  collapsed,
}: {
  section: NavSection
  pathname: string
  collapsed: boolean
}) {
  return (
    <div className="flex flex-col gap-1">
      {/* Collapsed trades the words for a rule, in a row of exactly the same
          height: dropping the row would pull every icon below the group up by
          its height plus the gap, and leaving it empty would lose the grouping
          the label was carrying. */}
      {collapsed ? (
        <div className="flex h-7 items-center px-1" aria-hidden>
          <span className="h-px w-full bg-border" />
        </div>
      ) : (
        <span className="flex h-7 items-center px-2.5 text-xs font-medium text-muted-foreground">
          {section.label}
        </span>
      )}
      <nav className="flex flex-col gap-1">
        {section.items.map((item) => (
          <NavLink
            key={item.href}
            {...item}
            active={isActive(pathname, item.href)}
            collapsed={collapsed}
          />
        ))}
      </nav>
    </div>
  )
}

export function AppSidebar({
  /** A client-side profile gets "Company Profile" pointing at their own company. */
  companyAccess = { scope: "all" },
}: {
  companyAccess?: CompanyAccess
}) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useSidebarState()
  const operations = operationsSectionFor(companyAccess)

  return (
    <aside
      className={cn(
        "flex h-full shrink-0 flex-col overflow-y-auto border-r border-border bg-sidebar px-3 py-4 transition-[width]",
        collapsed ? "w-16" : "w-[200px]"
      )}
    >
      {/* `h-9` is the expanded height (a 24px logo in a `py-1.5` link). Fixed,
          because collapsed leaves only the 32px toggle button behind. */}
      <div
        className={cn(
          "flex h-9 items-center",
          collapsed ? "justify-center" : "justify-between"
        )}
      >
        {!collapsed && (
          <Link href="/home" className="flex items-center px-2.5">
            <Logo />
          </Link>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0 text-muted-foreground"
          aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? (
            <PanelLeftOpen className="size-4" />
          ) : (
            <PanelLeftClose className="size-4" />
          )}
        </Button>
      </div>

      <nav className="mt-4 flex flex-col gap-1">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.href}
            {...item}
            active={isActive(pathname, item.href)}
            collapsed={collapsed}
          />
        ))}
      </nav>

      <div className="mt-4 flex flex-col gap-4">
        <NavGroup section={AGENTS_NAV_SECTION} pathname={pathname} collapsed={collapsed} />
        <NavGroup section={operations} pathname={pathname} collapsed={collapsed} />
      </div>

      {/* `mt-auto` pins Settings to the bottom whenever the nav is shorter than
          the viewport; `pt-4` keeps it off Operations when it isn't. */}
      <div className="mt-auto pt-4">
        <NavGroup section={SETTINGS_NAV_SECTION} pathname={pathname} collapsed={collapsed} />
      </div>
    </aside>
  )
}
