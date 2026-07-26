"use client"

import { Fragment } from "react"
import { usePathname } from "next/navigation"
import { Bell, LogOut, Users, UndoDot } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { logout } from "@/app/login/actions"
import { switchToUser, returnToMyAccount } from "@/app/(app)/switch-user-actions"
import { NAV_ITEMS, BOTTOM_NAV_ITEMS } from "@/lib/nav"
import { useBreadcrumbItems } from "@/lib/breadcrumb-context"
import { useHeaderActionsContent } from "@/lib/header-actions-context"
import type { CurrentProfile } from "@/lib/auth"

type SwitchableUser = {
  id: string
  email: string
  full_name: string | null
  side: string
  role: string | null
  client_role: string | null
  client_name: string | null
}

/** Stellaforce users first, then client-side users grouped under their client's name. */
function groupSwitchableUsers(users: SwitchableUser[], excludeId: string) {
  const others = users.filter((u) => u.id !== excludeId)
  const stellaforce = others.filter((u) => u.side === "stellaforce")
  const byClient = new Map<string, SwitchableUser[]>()
  for (const u of others) {
    if (u.side === "stellaforce") continue
    const key = u.client_name ?? "Client"
    byClient.set(key, [...(byClient.get(key) ?? []), u])
  }
  return { stellaforce, clientGroups: Array.from(byClient.entries()) }
}

function currentTitle(pathname: string): string {
  const item = [...NAV_ITEMS, ...BOTTOM_NAV_ITEMS].find(
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

export function AppHeader({
  user,
  switchableUsers = [],
  isImpersonating = false,
}: {
  user: CurrentProfile | null
  switchableUsers?: SwitchableUser[]
  isImpersonating?: boolean
}) {
  const pathname = usePathname()
  const breadcrumbItems = useBreadcrumbItems()
  const headerActions = useHeaderActionsContent()

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border px-6">
      {breadcrumbItems ? (
        <Breadcrumb>
          <BreadcrumbList>
            {breadcrumbItems.map((item, i) => {
              const isLast = i === breadcrumbItems.length - 1
              return (
                <Fragment key={i}>
                  <BreadcrumbItem>
                    {isLast || !item.href ? (
                      <BreadcrumbPage className="flex items-center gap-1.5">
                        {item.label}
                        {item.badge && (
                          <Badge className="border-transparent bg-muted text-muted-foreground">
                            {item.badge}
                          </Badge>
                        )}
                      </BreadcrumbPage>
                    ) : (
                      <BreadcrumbLink href={item.href}>
                        {item.label}
                      </BreadcrumbLink>
                    )}
                  </BreadcrumbItem>
                  {!isLast && <BreadcrumbSeparator />}
                </Fragment>
              )
            })}
          </BreadcrumbList>
        </Breadcrumb>
      ) : (
        <span className="text-sm font-medium">{currentTitle(pathname)}</span>
      )}

      {headerActions ? (
        headerActions
      ) : user ? (
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

              {isImpersonating ? (
                <>
                  <form action={returnToMyAccount}>
                    <DropdownMenuItem
                      render={<button type="submit" className="text-left" />}
                    >
                      <UndoDot />
                      Return to my account
                    </DropdownMenuItem>
                  </form>
                  <DropdownMenuSeparator />
                </>
              ) : user.side === "stellaforce" &&
                user.role === "admin" &&
                switchableUsers.some((u) => u.id !== user.id) ? (
                <>
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      <Users />
                      Switch User
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent>
                      {(() => {
                        const { stellaforce, clientGroups } = groupSwitchableUsers(
                          switchableUsers,
                          user.id
                        )
                        return (
                          <>
                            {stellaforce.length > 0 && (
                              <>
                                <DropdownMenuLabel className="text-xs text-muted-foreground">
                                  Stellaforce
                                </DropdownMenuLabel>
                                {stellaforce.map((u) => (
                                  <form key={u.id} action={switchToUser.bind(null, u.id)}>
                                    <DropdownMenuItem
                                      render={<button type="submit" className="text-left" />}
                                    >
                                      <span className="flex flex-col">
                                        <span>{u.full_name ?? u.email}</span>
                                        <span className="text-xs text-muted-foreground capitalize">
                                          {u.role}
                                        </span>
                                      </span>
                                    </DropdownMenuItem>
                                  </form>
                                ))}
                              </>
                            )}
                            {clientGroups.map(([clientName, users]) => (
                              <Fragment key={clientName}>
                                <DropdownMenuSeparator />
                                <DropdownMenuLabel className="text-xs text-muted-foreground">
                                  {clientName}
                                </DropdownMenuLabel>
                                {users.map((u) => (
                                  <form key={u.id} action={switchToUser.bind(null, u.id)}>
                                    <DropdownMenuItem
                                      render={<button type="submit" className="text-left" />}
                                    >
                                      <span className="flex flex-col">
                                        <span>{u.full_name ?? u.email}</span>
                                        <span className="text-xs text-muted-foreground capitalize">
                                          {u.client_role}
                                        </span>
                                      </span>
                                    </DropdownMenuItem>
                                  </form>
                                ))}
                              </Fragment>
                            ))}
                          </>
                        )
                      })()}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                  <DropdownMenuSeparator />
                </>
              ) : null}

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
