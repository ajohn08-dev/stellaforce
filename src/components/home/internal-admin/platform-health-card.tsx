"use client"

import * as React from "react"
import { ChevronDown, TriangleAlert } from "lucide-react"

import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { PlatformHealthData } from "@/lib/mock-internal-admin-home"

const SYSTEM_OPTIONS = ["All Systems", "Calendar", "Email", "ATS Sync"]

/** UI-only — doesn't recompute the metrics below yet, no per-system breakdown wired up. */
function SystemFilterTrigger() {
  const [selected, setSelected] = React.useState(SYSTEM_OPTIONS[0])

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
        {SYSTEM_OPTIONS.map((option) => (
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

/** Internal-admin analog of the recruiter home page's AgentHealthCard — the platform/integration/governance health view unique to this persona. */
export function PlatformHealthCard({ data }: { data: PlatformHealthData }) {
  return (
    <Card className="h-full" size="sm">
      <CardHeader className="shrink-0">
        <CardTitle>Platform Health</CardTitle>
        <CardAction className="self-center">
          <SystemFilterTrigger />
        </CardAction>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto no-scrollbar">
        <div>
          <p className="text-3xl font-semibold tracking-tight text-foreground">
            {data.reliabilityPct}%
          </p>
          <p className="text-xs text-muted-foreground">platform reliability</p>
        </div>
        <ul className="flex flex-col gap-1">
          {data.metrics.map((metric) => (
            <li key={metric.label} className="flex items-center justify-between gap-3 text-sm">
              <span className="text-muted-foreground">{metric.label}</span>
              <span className="font-medium tabular-nums text-foreground">{metric.value}</span>
            </li>
          ))}
        </ul>
        {data.degradationNote && (
          <div className="flex items-start gap-2 border-t border-border pt-2 text-xs text-muted-foreground">
            <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
            <span>{data.degradationNote}</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
