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
import { BENCH_COVERAGE_BADGE_CLASS, titleCase } from "@/lib/constants"
import { cn } from "@/lib/utils"
import type { CoverageData } from "@/lib/mock-client-home"

const PRIORITY_OPTIONS = ["All Reqs", "Priority Only"]

/** UI-only — doesn't recompute the reqs below yet, no priority-flag data wired up. */
function PriorityFilterTrigger() {
  const [selected, setSelected] = React.useState(PRIORITY_OPTIONS[0])

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
        {PRIORITY_OPTIONS.map((option) => (
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

/** Client-admin analog of the recruiter home page's BenchStrengthCard. */
export function CoverageCard({ data }: { data: CoverageData }) {
  return (
    <Card className="h-full" size="sm">
      <CardHeader className="shrink-0">
        <CardTitle>Coverage</CardTitle>
        <CardAction className="self-center">
          <PriorityFilterTrigger />
        </CardAction>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto no-scrollbar">
        <div>
          <p className="text-3xl font-semibold tracking-tight text-foreground">
            {data.priorityCoveragePct}%
          </p>
          <p className="text-xs text-muted-foreground">priority req coverage</p>
        </div>
        <ul className="flex flex-col">
          {data.reqs.map((req) => (
            <li
              key={req.name}
              className="flex items-center justify-between gap-3 border-b border-border py-1.5 last:border-b-0"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{req.name}</p>
                <p className="truncate text-xs text-muted-foreground">{req.department}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <span className="text-sm tabular-nums text-muted-foreground">
                  {req.finalistReady}/{req.target}
                </span>
                <Badge className={cn("border-transparent", BENCH_COVERAGE_BADGE_CLASS[req.coverage])}>
                  {titleCase(req.coverage)}
                </Badge>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
