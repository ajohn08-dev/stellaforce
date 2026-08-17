"use client"

import * as React from "react"
import { AlertTriangle, ChevronDown, Clock, Sparkles } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import type { PulseAction, PulseEvent, PulseStat } from "@/lib/job-pulse"

type FilterOption = { id: string; name: string }

/**
 * The job workspace's first tab — where the job stands before you drill into
 * any one sub-stage. Headline stats up top, then one of two views over the
 * same job: **Recent** (the activity feed, newest first) or **Actions** (what
 * to do next to keep the job moving). Both obey the same Stage / Candidates
 * filters and search box, so switching views keeps your scope.
 *
 * Everything is computed server-side in `src/lib/job-pulse.ts`; this component
 * only filters and renders.
 */
export function JobPulseTab({
  stats,
  events,
  actions,
  stageOptions,
  candidateOptions,
}: {
  stats: PulseStat[]
  events: PulseEvent[]
  actions: PulseAction[]
  stageOptions: FilterOption[]
  candidateOptions: FilterOption[]
}) {
  const [view, setView] = React.useState<"recent" | "actions">("recent")
  const [query, setQuery] = React.useState("")
  const [stageIds, setStageIds] = React.useState<string[]>([])
  const [candidateIds, setCandidateIds] = React.useState<string[]>([])

  const matches = React.useCallback(
    (item: { stageId: string | null; candidateId: string | null; haystack: string }) => {
      if (stageIds.length > 0 && (!item.stageId || !stageIds.includes(item.stageId))) return false
      if (candidateIds.length > 0 && (!item.candidateId || !candidateIds.includes(item.candidateId)))
        return false
      const q = query.trim().toLowerCase()
      return q === "" || item.haystack.toLowerCase().includes(q)
    },
    [stageIds, candidateIds, query]
  )

  const visibleEvents = events.filter((e) =>
    matches({
      stageId: e.stageId,
      candidateId: e.candidateId,
      haystack: [e.label, e.candidateName, e.stageName, e.actor].filter(Boolean).join(" "),
    })
  )
  const visibleActions = actions.filter((a) =>
    matches({
      stageId: a.stageId,
      candidateId: a.candidateId,
      haystack: [a.title, a.detail, a.candidateName, a.stageName].filter(Boolean).join(" "),
    })
  )

  return (
    <div className="mx-auto w-full max-w-5xl space-y-8 pb-10">
      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map((stat) => (
          <StatCard key={stat.label} stat={stat} />
        ))}
      </div>

      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex items-center gap-1 rounded-lg bg-muted p-1">
            <ViewButton
              active={view === "recent"}
              onClick={() => setView("recent")}
              icon={<Clock className="size-3.5" />}
              label="Recent"
            />
            <ViewButton
              active={view === "actions"}
              onClick={() => setView("actions")}
              icon={<Sparkles className="size-3.5" />}
              label="Actions"
              count={actions.length}
            />
          </div>

          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={view === "recent" ? "Search activity" : "Search actions"}
            aria-label={view === "recent" ? "Search activity" : "Search actions"}
            className="w-full max-w-xs bg-white sm:ml-6"
          />

          <div className="flex items-center gap-2 sm:ml-auto">
            <FilterMenu
              label="Stage"
              options={stageOptions}
              selected={stageIds}
              onChange={setStageIds}
            />
            <FilterMenu
              label="Candidates"
              options={candidateOptions}
              selected={candidateIds}
              onChange={setCandidateIds}
            />
          </div>
        </div>

        {view === "recent" ? (
          visibleEvents.length === 0 ? (
            <EmptyState
              label={events.length === 0 ? "No Activity Yet" : "No Matching Activity"}
              hint={
                events.length === 0
                  ? "Moves, interviews and decisions on this job land here as they happen."
                  : undefined
              }
            />
          ) : (
            <ol className="space-y-2">
              {visibleEvents.map((event) => (
                <EventRow key={event.id} event={event} />
              ))}
            </ol>
          )
        ) : visibleActions.length === 0 ? (
          <EmptyState
            label={actions.length === 0 ? "Nothing Needs You" : "No Matching Actions"}
            hint={
              actions.length === 0
                ? "No stalled candidates, overdue evaluations or breached SLAs on this job."
                : undefined
            }
          />
        ) : (
          <ol className="space-y-2">
            {visibleActions.map((action) => (
              <ActionRow key={action.id} action={action} />
            ))}
          </ol>
        )}
      </div>
    </div>
  )
}

/** Same shape as the agent analytics stat cards (`AnalyticsStatCard`) —
 * `rounded-lg border bg-white`, muted label over a 3xl figure. */
function StatCard({ stat }: { stat: PulseStat }) {
  return (
    <div className="flex flex-1 flex-col gap-6 rounded-lg border border-border bg-white p-4">
      <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
      <div className="flex items-baseline gap-1.5">
        <p className="text-3xl font-medium tracking-tight text-foreground tabular-nums">
          {stat.value}
        </p>
        {stat.unit && <span className="text-sm text-muted-foreground">{stat.unit}</span>}
      </div>
    </div>
  )
}

function ViewButton({
  active,
  onClick,
  icon,
  label,
  count,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
  count?: number
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-sm transition-colors",
        active
          ? "bg-background font-medium text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground"
      )}
    >
      {icon}
      {label}
      {count !== undefined && count > 0 && (
        <span className="rounded-full bg-primary/10 px-1.5 text-xs font-medium text-primary">
          {count}
        </span>
      )}
    </button>
  )
}

/** "Stage ⌄" / "Candidates ⌄" — multi-select, empty selection meaning "all". */
function FilterMenu({
  label,
  options,
  selected,
  onChange,
}: {
  label: string
  options: FilterOption[]
  selected: string[]
  onChange: (next: string[]) => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button type="button" variant="outline" className="gap-1.5">
            {label}
            {selected.length > 0 && (
              <span className="rounded-full bg-primary/10 px-1.5 text-xs font-medium text-primary">
                {selected.length}
              </span>
            )}
            <ChevronDown className="size-4" />
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="max-h-80 overflow-y-auto">
        <DropdownMenuLabel>{label}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {options.length === 0 ? (
          <DropdownMenuItem disabled>None available</DropdownMenuItem>
        ) : (
          <>
            {options.map((option) => (
              <DropdownMenuCheckboxItem
                key={option.id}
                checked={selected.includes(option.id)}
                onCheckedChange={(checked) =>
                  onChange(
                    checked
                      ? [...selected, option.id]
                      : selected.filter((id) => id !== option.id)
                  )
                }
              >
                {option.name}
              </DropdownMenuCheckboxItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onChange([])}>All</DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

const SEVERITY_DOT: Record<PulseEvent["severity"], string> = {
  info: "bg-muted-foreground/40",
  warning: "bg-amber-500",
  critical: "bg-destructive",
}

function formatTimestamp(at: string): string {
  return new Date(at).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

function EventRow({ event }: { event: PulseEvent }) {
  const context = [event.candidateName, event.stageName].filter(Boolean).join(" • ")
  return (
    <li className="flex items-start justify-between gap-4 rounded-lg border border-border bg-white px-4 py-3">
      <div className="flex min-w-0 items-start gap-3">
        <span
          className={cn("mt-1.5 size-2 shrink-0 rounded-full", SEVERITY_DOT[event.severity])}
          aria-hidden
        />
        <div className="min-w-0">
          <p className="truncate text-sm text-foreground">
            {event.label}
            {context && <span className="text-muted-foreground"> — {context}</span>}
          </p>
          <p className="truncate text-xs text-muted-foreground">{event.actor}</p>
        </div>
      </div>
      <span className="shrink-0 text-xs text-muted-foreground">
        {formatTimestamp(event.at)}
      </span>
    </li>
  )
}

const PRIORITY_STYLES: Record<PulseAction["priority"], string> = {
  high: "text-destructive",
  medium: "text-amber-600 dark:text-amber-500",
  low: "text-muted-foreground",
}

function ActionRow({ action }: { action: PulseAction }) {
  return (
    <li className="flex items-start gap-3 rounded-lg border border-border bg-white px-4 py-3">
      <AlertTriangle
        className={cn("mt-0.5 size-4 shrink-0", PRIORITY_STYLES[action.priority])}
        aria-hidden
      />
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{action.title}</p>
        <p className="text-sm text-muted-foreground">{action.detail}</p>
      </div>
    </li>
  )
}

function EmptyState({ label, hint }: { label: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-24 text-center">
      <p className="text-3xl font-medium text-muted-foreground/30">{label}</p>
      {hint && <p className="max-w-sm text-sm text-muted-foreground/70">{hint}</p>}
    </div>
  )
}
