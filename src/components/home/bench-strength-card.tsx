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
import type { BenchStrengthData } from "@/lib/mock-home"

const STAGE_OPTIONS = ["All Stages", "Interview-ready", "Submitted"]

/** UI-only — doesn't recompute the reqs below yet, no pipeline-stage data wired up. */
function StageFilterTrigger() {
  const [selected, setSelected] = React.useState(STAGE_OPTIONS[0])

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
        {STAGE_OPTIONS.map((option) => (
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

export function BenchStrengthCard({ data }: { data: BenchStrengthData }) {
  return (
    <Card className="h-full" size="sm">
      <CardHeader className="shrink-0">
        <CardTitle>Bench Strength</CardTitle>
        <CardAction className="self-center">
          <StageFilterTrigger />
        </CardAction>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto no-scrollbar">
        <div>
          <p className="text-3xl font-semibold tracking-tight text-foreground">
            {data.portfolioCoveragePct}%
          </p>
          <p className="text-xs text-muted-foreground">portfolio coverage</p>
        </div>
        <ul className="flex flex-col">
          {data.reqs.map((req) => (
            <li
              key={req.name}
              className="flex items-center justify-between gap-3 border-b border-border py-1.5 last:border-b-0"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{req.name}</p>
                <p className="truncate text-xs text-muted-foreground">{req.client}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <span className="text-sm tabular-nums text-muted-foreground">
                  {req.filled}/{req.total}
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
