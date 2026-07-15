"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { cn } from "@/lib/utils"
import { NAV_ITEMS, SETTINGS_ITEM } from "@/lib/nav"

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/")
}

function NavLink({ href, label, icon: Icon, active }: {
  href: string
  label: string
  icon: (typeof NAV_ITEMS)[number]["icon"]
  active: boolean
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors",
        active
          ? "bg-muted text-foreground font-medium"
          : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
      )}
    >
      <Icon className="size-4 shrink-0" />
      {label}
    </Link>
  )
}

export function AppSidebar() {
  const pathname = usePathname()

  return (
    <aside className="flex h-full w-60 shrink-0 flex-col border-r border-border px-3 py-4">
      <Link
        href="/home"
        className="px-2.5 py-1.5 font-semibold tracking-tight"
      >
        Stella<span className="text-muted-foreground">Force</span>
      </Link>

      <nav className="mt-4 flex flex-col gap-1">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.href}
            {...item}
            active={isActive(pathname, item.href)}
          />
        ))}
      </nav>

      <div className="mt-auto flex flex-col gap-1">
        <NavLink
          {...SETTINGS_ITEM}
          active={isActive(pathname, SETTINGS_ITEM.href)}
        />
      </div>
    </aside>
  )
}
