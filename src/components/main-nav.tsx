"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { logout } from "@/app/login/actions"
import type { CurrentProfile } from "@/lib/auth"

const LINKS = [
  { href: "/candidates", label: "Candidates" },
  { href: "/job-orders", label: "Job Orders" },
  { href: "/search", label: "Search" },
]

export function MainNav({ user }: { user: CurrentProfile | null }) {
  const pathname = usePathname()

  return (
    <header className="border-b border-border">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center gap-6">
        <Link href="/candidates" className="font-semibold tracking-tight">
          Stella<span className="text-muted-foreground">Force</span>
        </Link>
        <nav className="flex items-center gap-1">
          {LINKS.map((link) => {
            const active =
              pathname === link.href || pathname.startsWith(link.href + "/")
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "px-3 py-1.5 rounded-md text-sm transition-colors",
                  active
                    ? "bg-muted text-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
              >
                {link.label}
              </Link>
            )
          })}
        </nav>
        {user ? (
          <div className="ml-auto flex items-center gap-3">
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
      </div>
    </header>
  )
}
