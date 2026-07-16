"use client"

import { usePathname } from "next/navigation"
import { Bell, LogOut } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { logout } from "@/app/login/actions"
import { NAV_ITEMS, SETTINGS_ITEM } from "@/lib/nav"
import type { CurrentProfile } from "@/lib/auth"

function currentTitle(pathname: string): string {
  const item = [...NAV_ITEMS, SETTINGS_ITEM].find(
    (i) => pathname === i.href || pathname.startsWith(i.href + "/")
  )
  return item?.label ?? ""
}

function getInitials({ full_name, email }: CurrentProfile): string {
  if (full_name) {
    return full_name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("")
  }
  return email.slice(0, 2).toUpperCase()
}

export function AppHeader({ user }: { user: CurrentProfile | null }) {
  const pathname = usePathname()

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border px-6">
      <span className="text-sm font-medium">{currentTitle(pathname)}</span>

      {user ? (
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" aria-label="Notifications">
            <Bell />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger className="rounded-full focus-visible:ring-3 focus-visible:ring-ring/50">
              <Avatar>
                <AvatarFallback className="bg-brand-purple-600 text-white dark:bg-brand-purple-500">
                  {getInitials(user)}
                </AvatarFallback>
              </Avatar>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuLabel>
                <p className="font-medium">{user.full_name ?? user.email}</p>
                <p className="text-xs text-muted-foreground capitalize">
                  {user.role}
                </p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <form action={logout}>
                <DropdownMenuItem
                  render={<button type="submit" className="text-left" />}
                >
                  <LogOut />
                  Log out
                </DropdownMenuItem>
              </form>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ) : null}
    </header>
  )
}
