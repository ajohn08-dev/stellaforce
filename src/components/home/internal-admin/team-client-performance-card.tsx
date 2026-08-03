"use client"

import * as React from "react"
import { ChevronDown } from "lucide-react"

import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { TEAM_PERFORMANCE_BADGE_CLASS, titleCase } from "@/lib/constants"
import { cn } from "@/lib/utils"
import type { TeamClientPerformanceData } from "@/lib/mock-internal-admin-home"

const SCOPE_OPTIONS = ["All", "Recruiters", "Clients"]

/** UI-only — doesn't recompute the rows below yet, no recruiter/client scoping wired up. */
function ScopeFilterTrigger() {
  const [selected, setSelected] = React.useState(SCOPE_OPTIONS[0])

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button type="button" variant="ghost" size="sm" className="gap-1 text-xs text-muted-foreground">
            {selected}
            <ChevronDown className="size-3.5" />
          </Button>
        }
      />
      <DropdownMenuContent align="end">
        {SCOPE_OPTIONS.map((option) => (
          <DropdownMenuCheckboxItem
            key={option}
            checked={option === selected}
            onCheckedChange={() => setSelected(option)}
          >
            {option}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** Internal-admin analog of the recruiter home page's BenchStrengthCard — the supervision/management view unique to this persona. */
export function TeamClientPerformanceCard({ data }: { data: TeamClientPerformanceData }) {
  return (
    <Card className="h-full" size="sm">
      <CardHeader className="shrink-0">
        <CardTitle>Team & Client Performance</CardTitle>
        <CardAction className="self-center">
          <ScopeFilterTrigger />
        </CardAction>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto no-scrollbar">
        <div>
          <p className="text-3xl font-semibold tracking-tight text-foreground">
            {data.teamSlaCompliancePct}%
          </p>
          <p className="text-xs text-muted-foreground">team SLA compliance</p>
        </div>
        <ul className="flex flex-col">
          {data.items.map((item) => (
            <li
              key={item.name}
              className="flex items-center justify-between gap-3 border-b border-border py-1.5 last:border-b-0"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{item.name}</p>
                <p className="truncate text-xs text-muted-foreground">{item.context}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <span className="text-sm tabular-nums text-muted-foreground">{item.metric}</span>
                <Badge className={cn("border-transparent", TEAM_PERFORMANCE_BADGE_CLASS[item.status])}>
                  {titleCase(item.status)}
                </Badge>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
