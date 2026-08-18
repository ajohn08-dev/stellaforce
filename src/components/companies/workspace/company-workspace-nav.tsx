"use client"

import * as React from "react"
import Link from "next/link"
import {
  ChevronDown,
  ChevronRight,
  EyeOff,
  Menu,
  MessageCircleOff,
  MessageCircleQuestion,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import {
  FALLBACKS_SECTION,
  groupKeyForSection,
  INBOX_SECTION,
  SECTION_GROUPS,
  type SectionDef,
  type SectionGroup,
} from "@/components/companies/workspace/company-sections"
import type { CompanySection, SectionGap } from "@/lib/company-readiness"

type NavProps = {
  companyId: string
  active: CompanySection
  gaps: Partial<Record<CompanySection, SectionGap>>
  attention: Partial<Record<CompanySection, number>>
  counts: Partial<Record<CompanySection, number>>
  canViewInternal: boolean
}

/**
 * The workspace's left rail — four collapsible groups plus an inbox.
 *
 * Only the group you're in is open on load. A fifteen-item always-open list was
 * more navigation than content, and the point of this workspace is to feel like a
 * knowledge base you read, not a console you operate.
 *
 * Group headers roll up their children's gaps, so a collapsed group still tells
 * you something is wrong inside it.
 *
 * The internal group is omitted entirely for profiles without the capability — a
 * greyed-out "Recruiter brief" entry would tell a client-side user that private
 * notes about them exist.
 */
export function CompanyWorkspaceNav(props: NavProps) {
  return (
    <>
      <nav
        aria-label="Company sections"
        className="hidden w-56 shrink-0 overflow-y-auto pr-4 lg:block"
      >
        <NavBody {...props} />
      </nav>

      <div className="lg:hidden">
        <Sheet>
          <SheetTrigger
            render={
              <Button variant="outline" size="sm" className="gap-1.5">
                <Menu className="size-4" />
                Sections
              </Button>
            }
          />
          <SheetContent side="left" className="w-72">
            <SheetHeader>
              <SheetTitle>Company sections</SheetTitle>
            </SheetHeader>
            <nav
              aria-label="Company sections"
              className="min-h-0 flex-1 overflow-y-auto px-4 pb-6"
            >
              <NavBody {...props} />
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </>
  )
}

function NavBody({ companyId, active, gaps, attention, counts, canViewInternal }: NavProps) {
  const groups = SECTION_GROUPS.filter((g) => !g.internal || canViewInternal)
  const activeGroup = groupKeyForSection(active)

  return (
    <div className="space-y-1">
      <NavItem
        companyId={companyId}
        section={INBOX_SECTION}
        active={active === INBOX_SECTION.key}
        gap={gaps[INBOX_SECTION.key]}
        icon={<MessageCircleQuestion className="size-3.5 shrink-0" />}
      />

      <NavItem
        companyId={companyId}
        section={FALLBACKS_SECTION}
        active={active === FALLBACKS_SECTION.key}
        icon={<MessageCircleOff className="size-3.5 shrink-0" />}
      />

      <div className="pt-1">
        {groups.map((group) => (
          <NavGroup
            key={group.key}
            group={group}
            companyId={companyId}
            active={active}
            defaultOpen={activeGroup === group.key}
            gaps={gaps}
            attention={attention}
            counts={counts}
          />
        ))}
      </div>
    </div>
  )
}

function NavGroup({
  group,
  companyId,
  active,
  defaultOpen,
  gaps,
  attention,
  counts,
}: {
  group: SectionGroup
  companyId: string
  active: CompanySection
  defaultOpen: boolean
  gaps: Partial<Record<CompanySection, SectionGap>>
  attention: Partial<Record<CompanySection, number>>
  counts: Partial<Record<CompanySection, number>>
}) {
  const [open, setOpen] = React.useState(defaultOpen)

  // Rolled-up state, so a collapsed group still reports trouble inside it.
  const rolled = group.sections.reduce(
    (acc, s) => {
      const g = gaps[s.key]
      return {
        count: acc.count + (g?.count ?? 0),
        blocking: acc.blocking || Boolean(g?.blocking),
        attention: acc.attention + (attention[s.key] ?? 0),
      }
    },
    { count: 0, blocking: false, attention: 0 }
  )

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-1.5 rounded-md px-2 py-2 text-left text-sm font-medium transition-colors hover:bg-muted/60"
      >
        {open ? (
          <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
        )}

        {group.internal && <EyeOff className="size-3.5 shrink-0 text-muted-foreground" />}

        <span className={cn("min-w-0 flex-1 truncate", group.internal && "text-muted-foreground")}>
          {group.label}
        </span>

        {!open && rolled.count > 0 ? (
          <GapBadge count={rolled.count} blocking={rolled.blocking} />
        ) : !open && rolled.attention > 0 ? (
          <AttentionDot count={rolled.attention} />
        ) : null}
      </button>

      {open && (
        <ul className="mb-1 space-y-0.5 pl-4">
          {group.sections.map((section) => (
            <li key={section.key}>
              <NavItem
                companyId={companyId}
                section={section}
                active={active === section.key}
                gap={gaps[section.key]}
                attentionCount={attention[section.key]}
                count={counts[section.key]}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function NavItem({
  companyId,
  section,
  active,
  gap,
  attentionCount,
  count,
  icon,
}: {
  companyId: string
  section: SectionDef
  active: boolean
  gap?: SectionGap
  attentionCount?: number
  count?: number
  icon?: React.ReactNode
}) {
  return (
    <Link
      href={`/companies/${companyId}?section=${section.key}`}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
        active
          ? "bg-muted font-medium text-foreground"
          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
      )}
    >
      {icon}
      <span className="min-w-0 flex-1 truncate">{section.label}</span>

      {gap ? (
        <GapBadge count={gap.count} blocking={gap.blocking} />
      ) : attentionCount ? (
        <AttentionDot count={attentionCount} />
      ) : count !== undefined && count > 0 ? (
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
          {count}
        </span>
      ) : null}

      {section.drillable && (
        <ChevronRight className="size-3 shrink-0 text-muted-foreground" />
      )}
    </Link>
  )
}

function GapBadge({ count, blocking }: { count: number; blocking: boolean }) {
  return (
    <span
      title={
        blocking
          ? "Blocking agent deployment"
          : `${count} thing${count === 1 ? "" : "s"} to confirm`
      }
      className={cn(
        "shrink-0 rounded-full px-1.5 py-0.5 text-xs font-medium tabular-nums",
        blocking
          ? "bg-destructive/10 text-destructive"
          : "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
      )}
    >
      {count}
    </span>
  )
}

function AttentionDot({ count }: { count: number }) {
  return (
    <span
      title={`${count} item${count === 1 ? "" : "s"} to re-confirm with the client`}
      className="size-1.5 shrink-0 rounded-full bg-amber-500"
    />
  )
}
