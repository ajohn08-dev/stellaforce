"use client"

import { usePathname } from "next/navigation"

import { Button } from "@/components/ui/button"
import { logout } from "@/app/login/actions"
import { NAV_ITEMS, SETTINGS_ITEM } from "@/lib/nav"
import type { CurrentProfile } from "@/lib/auth"

function currentTitle(pathname: string): string {
  const item = [...NAV_ITEMS, SETTINGS_ITEM].find(
    (i) => pathname === i.href || pathname.startsWith(i.href + "/")
  )
  return item?.label ?? ""
}

export function AppHeader({ user }: { user: CurrentProfile | null }) {
  const pathname = usePathname()

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border px-6">
      <span className="text-sm font-medium">{currentTitle(pathname)}</span>

      {user ? (
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">
            {user.email} <span className="text-xs">({user.role})</span>
          </span>
          <form action={logout}>
            <Button type="submit" variant="outline" size="sm">
              Sign out
            </Button>
          </form>
        </div>
      ) : null}
    </header>
  )
}
