"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { PanelLeftClose, PanelLeftOpen } from "lucide-react"

import { cn } from "@/lib/utils"
import { NAV_ITEMS, AGENTS_NAV_LABEL, AGENTS_NAV_ITEMS, SETTINGS_ITEM } from "@/lib/nav"
import { Logo } from "@/components/brand-logo"
import { Separator } from "@/components/ui/separator"
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
  icon: (typeof NAV_ITEMS)[number]["icon"]
  active: boolean
  collapsed: boolean
}) {
  return (
    <Link
      href={href}
      title={collapsed ? label : undefined}
      className={cn(
        "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors",
        collapsed && "justify-center px-0",
        active
          ? "bg-sidebar-primary text-sidebar-primary-foreground font-medium"
          : "text-muted-foreground hover:text-sidebar-accent-foreground hover:bg-sidebar-accent"
      )}
    >
      <Icon className="size-4 shrink-0" />
      {!collapsed && label}
    </Link>
  )
}

export function AppSidebar() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = React.useState(false)

  return (
    <aside
      className={cn(
        "flex h-full shrink-0 flex-col border-r border-border bg-sidebar px-3 py-4 transition-[width]",
        collapsed ? "w-16" : "w-[200px]"
      )}
    >
      <div
        className={cn(
          "flex items-center",
          collapsed ? "justify-center" : "justify-between"
        )}
      >
        {!collapsed && (
          <Link href="/home" className="px-2.5 py-1.5">
            <Logo />
          </Link>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0 text-muted-foreground"
          aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
          onClick={() => setCollapsed((v) => !v)}
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

      <Separator className="my-4" />

      <div className="flex flex-col gap-1">
        {!collapsed && (
          <span className="px-2.5 py-1.5 text-xs font-medium text-muted-foreground">
            {AGENTS_NAV_LABEL}
          </span>
        )}
        <nav className="flex flex-col gap-1">
          {AGENTS_NAV_ITEMS.map((item) => (
            <NavLink
              key={item.href}
              {...item}
              active={isActive(pathname, item.href)}
              collapsed={collapsed}
            />
          ))}
        </nav>
      </div>

      <div className="mt-auto flex flex-col gap-1">
        <NavLink
          {...SETTINGS_ITEM}
          active={isActive(pathname, SETTINGS_ITEM.href)}
          collapsed={collapsed}
        />
      </div>
    </aside>
  )
}
