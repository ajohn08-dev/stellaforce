"use client"

import * as React from "react"
import { toast } from "sonner"
import { ArrowLeft } from "lucide-react"

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import type { CalendarBusyBlock } from "@/lib/server/calendar-events"
import {
  DEFAULT_TIMEZONE,
  TIMEZONES,
  formatZonedDayLabel,
  formatZonedTime,
  timezoneAbbreviation,
  zonedDaySequence,
  zonedTimeToUtc,
  type ZonedDay,
} from "@/lib/timezone"
import {
  DEFAULT_PREFERRED_DAYS,
  WORKDAY_END_HOUR,
  WORKDAY_START_HOUR,
  findAvailableSlots,
  type Slot,
} from "@/lib/availability"

/** What the panel is showing a calendar for, plus that fetch's state. */
export type CalendarSheetState = {
  target: { id: string; name: string }
  loading: boolean
  error: string | null
  busy: CalendarBusyBlock[] | null
  /**
   * Instant the sheet was opened, captured once in the click handler. The whole
   * view renders relative to it, so toggling a control can't shift "today" or
   * drop a slot that just went stale mid-interaction.
   */
  openedAt: number
}

/** Book one time, or gather several to propose. An explicit choice, not a mode inferred from clicks. */
type BookingMode = "book" | "propose"
/** The sheet swaps its body between these rather than stacking overlays. */
type SheetView = "calendar" | "create" | "propose"

const GRID_DAYS = 7
const SUGGESTION_COUNT = 5
/** Enough to cover every free slot in the fetched window. */
const ALL_SLOTS_LIMIT = 500
/** Cap on how many times can be proposed at once — a wall of options helps nobody. */
const MAX_PROPOSED = 6
/** Default visible band; widened if a busy block falls outside it. */
const GRID_START_HOUR = 7
const GRID_END_HOUR = 19
/** Tall enough that a 30-minute cell is a comfortable click target. */
const HOUR_ROW_REM = 3
const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const DURATIONS = [30, 45, 60]
const MS_PER_MIN = 60_000

/**
 * Week-at-a-glance availability for one connected team member, as a slide-over.
 *
 * Shows **busy blocks only — never event titles** (titles are dropped
 * server-side in src/lib/server/calendar-events.ts, so they never reach this
 * component). Timezone is an explicit control rather than the browser default:
 * a recruiter in one zone booking an interviewer in another would otherwise
 * read the grid correctly and still book the wrong hour.
 *
 * Two modes, chosen deliberately rather than inferred: **Book a time** (click a
 * free slot → the create-event form) and **Propose times** (multi-select → the
 * send form). Creating events and sending are **not wired up** — both end in a
 * placeholder toast.
 *
 * Timezone/duration/preferred days are session state, not stored against the
 * team member (see docs/google-calendar-consent-plan.md).
 */
export function TeamMemberCalendarSheet({
  state,
  onClose,
}: {
  state: CalendarSheetState | null
  onClose: () => void
}) {
  const { loading, error, busy, openedAt } = state ?? {
    loading: false,
    error: null,
    busy: null,
    openedAt: 0,
  }

  const [timeZone, setTimeZone] = React.useState(DEFAULT_TIMEZONE)
  const [slotMinutes, setSlotMinutes] = React.useState(DURATIONS[0])
  const [preferredDays, setPreferredDays] = React.useState<number[]>(DEFAULT_PREFERRED_DAYS)
  const [mode, setMode] = React.useState<BookingMode>("book")
  const [selected, setSelected] = React.useState<number[]>([])
  const [view, setView] = React.useState<SheetView>("calendar")
  const [pendingSlot, setPendingSlot] = React.useState<Slot | null>(null)

  // One source of truth for what's bookable: the pills are just the first few
  // of the same list the grid renders, so the two can never disagree.
  const slots = React.useMemo(
    () =>
      busy
        ? findAvailableSlots({
            busy,
            timeZone,
            preferredDays,
            slotMinutes,
            count: ALL_SLOTS_LIMIT,
            from: openedAt,
          })
        : [],
    [busy, timeZone, preferredDays, slotMinutes, openedAt]
  )
  const suggestions = slots.slice(0, SUGGESTION_COUNT)
  const selectedSlots = slots.filter((s) => selected.includes(s.start))

  /** Any control that changes what counts as a slot invalidates the selection. */
  function resetSelection() {
    setSelected([])
    setPendingSlot(null)
  }

  function handleSlotClick(slot: Slot) {
    if (mode === "book") {
      setPendingSlot(slot)
      setView("create")
      return
    }
    setSelected((prev) => {
      if (prev.includes(slot.start)) return prev.filter((s) => s !== slot.start)
      if (prev.length >= MAX_PROPOSED) {
        toast.error(`You can propose up to ${MAX_PROPOSED} times.`)
        return prev
      }
      return [...prev, slot.start].sort((a, b) => a - b)
    })
  }

  function handleOpenChange(open: boolean) {
    if (open) return
    // Per-person choices reset; timezone and duration are the recruiter's own
    // working preference and persist across opens within the session.
    setView("calendar")
    setMode("book")
    setPreferredDays(DEFAULT_PREFERRED_DAYS)
    resetSelection()
    onClose()
  }

  const title =
    view === "create"
      ? "New interview"
      : view === "propose"
        ? "Propose times"
        : (state?.target.name ?? "Calendar")

  return (
    <Sheet open={!!state} onOpenChange={handleOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col p-0 sm:max-w-4xl">
        <SheetHeader className="px-4 pt-4">
          <SheetTitle className="flex items-center gap-2">
            {view !== "calendar" && (
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Back to calendar"
                onClick={() => setView("calendar")}
              >
                <ArrowLeft />
              </Button>
            )}
            {title}
          </SheetTitle>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-auto px-4 pb-4">
          {loading ? (
            <div className="h-96 animate-pulse rounded-md bg-muted" aria-busy="true" />
          ) : error ? (
            <p className="py-4 text-sm text-muted-foreground">{error}</p>
          ) : !busy ? null : view === "create" && pendingSlot ? (
            <CreateEventForm
              slot={pendingSlot}
              slotMinutes={slotMinutes}
              timeZone={timeZone}
              interviewer={state?.target.name ?? ""}
              onDurationChange={setSlotMinutes}
              onCancel={() => setView("calendar")}
            />
          ) : view === "propose" ? (
            <ProposeTimesForm
              slots={selectedSlots}
              timeZone={timeZone}
              onCancel={() => setView("calendar")}
            />
          ) : (
            <div className="flex flex-col gap-4 py-1">
              <ControlsRow
                timeZone={timeZone}
                onTimeZoneChange={(tz) => {
                  setTimeZone(tz)
                  resetSelection()
                }}
                slotMinutes={slotMinutes}
                onSlotMinutesChange={(m) => {
                  setSlotMinutes(m)
                  resetSelection()
                }}
                preferredDays={preferredDays}
                onTogglePreferredDay={(day) => {
                  resetSelection()
                  setPreferredDays((prev) =>
                    prev.includes(day)
                      ? prev.filter((d) => d !== day)
                      : [...prev, day].sort()
                  )
                }}
                mode={mode}
                onModeChange={(next) => {
                  setMode(next)
                  resetSelection()
                }}
              />

              <NextAvailability
                slots={suggestions}
                timeZone={timeZone}
                selected={selected}
                mode={mode}
                onSelect={handleSlotClick}
                hasPreferredDays={preferredDays.length > 0}
              />

              <WeekGrid
                busy={busy}
                slots={slots}
                selected={selected}
                timeZone={timeZone}
                preferredDays={preferredDays}
                now={openedAt}
                onSlotClick={handleSlotClick}
              />
            </div>
          )}
        </div>

        {view === "calendar" && mode === "propose" && selected.length > 0 && (
          <div className="flex shrink-0 items-center justify-between gap-3 border-t border-border bg-background px-4 py-3">
            <p className="text-sm">
              <span className="font-medium">{selected.length}</span>{" "}
              {selected.length === 1 ? "time" : "times"} selected
            </p>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={resetSelection}>
                Clear
              </Button>
              <Button size="sm" onClick={() => setView("propose")}>
                Send times…
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

// ── Controls ─────────────────────────────────────────────────────────────────

function ControlsRow({
  timeZone,
  onTimeZoneChange,
  slotMinutes,
  onSlotMinutesChange,
  preferredDays,
  onTogglePreferredDay,
  mode,
  onModeChange,
}: {
  timeZone: string
  onTimeZoneChange: (tz: string) => void
  slotMinutes: number
  onSlotMinutesChange: (minutes: number) => void
  preferredDays: number[]
  onTogglePreferredDay: (day: number) => void
  mode: BookingMode
  onModeChange: (mode: BookingMode) => void
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">Timezone</span>
          <Select value={timeZone} onValueChange={(v) => onTimeZoneChange(v as string)}>
            <SelectTrigger className="w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIMEZONES.map((tz) => (
                <SelectItem key={tz.value} value={tz.value}>
                  {tz.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">Length</span>
          <Select
            value={String(slotMinutes)}
            onValueChange={(v) => onSlotMinutesChange(Number(v))}
          >
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DURATIONS.map((minutes) => (
                <SelectItem key={minutes} value={String(minutes)}>
                  {minutes} min
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">Preferred days</span>
          <div className="flex gap-1">
            {DAY_LABELS.map((label, day) => {
              const active = preferredDays.includes(day)
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => onTogglePreferredDay(day)}
                  aria-pressed={active}
                  className={cn(
                    "rounded-full px-2 py-1 text-xs transition-colors",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  )}
                >
                  {label}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div
          role="radiogroup"
          aria-label="What clicking a time does"
          className="inline-flex rounded-full border border-border p-0.5"
        >
          {(
            [
              ["book", "Book a time"],
              ["propose", "Propose times"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={mode === value}
              onClick={() => onModeChange(value)}
              className={cn(
                "rounded-full px-3 py-1 text-xs transition-colors",
                mode === value
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <span className="text-xs text-muted-foreground">
          {mode === "book"
            ? "Click an open time to set up the interview."
            : `Pick up to ${MAX_PROPOSED} times to send.`}
        </span>
      </div>
    </div>
  )
}

function NextAvailability({
  slots,
  timeZone,
  selected,
  mode,
  onSelect,
  hasPreferredDays,
}: {
  slots: Slot[]
  timeZone: string
  selected: number[]
  mode: BookingMode
  onSelect: (slot: Slot) => void
  hasPreferredDays: boolean
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline gap-2">
        <h3 className="text-sm font-semibold">Next availability</h3>
        <span className="text-xs text-muted-foreground">
          {timezoneAbbreviation(timeZone)}
        </span>
      </div>

      {slots.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {hasPreferredDays
            ? "No open slots in the next 14 days on the selected days."
            : "Select at least one preferred day to see availability."}
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {slots.map((slot) => {
            const isSelected = mode === "propose" && selected.includes(slot.start)
            return (
              <button
                key={slot.start}
                type="button"
                onClick={() => onSelect(slot)}
                aria-pressed={mode === "propose" ? isSelected : undefined}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-sm transition-colors",
                  isSelected
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background hover:bg-muted"
                )}
              >
                <span className="font-medium">
                  {formatZonedDayLabel(slot.start, timeZone)}
                </span>{" "}
                <span className={isSelected ? undefined : "text-muted-foreground"}>
                  {formatZonedTime(slot.start, timeZone)}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Week grid ────────────────────────────────────────────────────────────────

type Positioned = { topPct: number; heightPct: number }
type PositionedSlot = Positioned & { slot: Slot }

/** 7 day columns: busy blocks as context, free slots as click targets. */
function WeekGrid({
  busy,
  slots,
  selected,
  timeZone,
  preferredDays,
  now,
  onSlotClick,
}: {
  busy: CalendarBusyBlock[]
  slots: Slot[]
  selected: number[]
  timeZone: string
  preferredDays: number[]
  now: number
  onSlotClick: (slot: Slot) => void
}) {
  const days = zonedDaySequence(now, GRID_DAYS, timeZone)

  const busyBlocks = busy
    .filter((b) => !b.allDay)
    .map((b) => ({ start: new Date(b.start).getTime(), end: new Date(b.end).getTime() }))
  const allDayBlocks = busy
    .filter((b) => b.allDay)
    .map((b) => ({ start: new Date(b.start).getTime(), end: new Date(b.end).getTime() }))

  // Default band, widened so an early/late meeting is never invisible.
  let startHour = GRID_START_HOUR
  let endHour = GRID_END_HOUR
  for (const day of days) {
    const dayStart = zonedTimeToUtc(day.year, day.month, day.day, 0, 0, timeZone)
    const dayEnd = dayStart + 24 * 60 * MS_PER_MIN
    for (const block of busyBlocks) {
      if (block.end <= dayStart || block.start >= dayEnd) continue
      startHour = Math.min(
        startHour,
        Math.floor((Math.max(block.start, dayStart) - dayStart) / (60 * MS_PER_MIN))
      )
      endHour = Math.max(
        endHour,
        Math.ceil((Math.min(block.end, dayEnd) - dayStart) / (60 * MS_PER_MIN))
      )
    }
  }
  startHour = Math.max(0, startHour)
  endHour = Math.min(24, Math.max(endHour, startHour + 1))

  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i)
  const totalMinutes = (endHour - startHour) * 60

  function place(from: number, to: number, windowStart: number): Positioned | null {
    const fromMin = (from - windowStart) / MS_PER_MIN
    const toMin = (to - windowStart) / MS_PER_MIN
    const clampedFrom = Math.max(0, Math.min(fromMin, totalMinutes))
    const clampedTo = Math.max(0, Math.min(toMin, totalMinutes))
    if (clampedTo <= clampedFrom) return null
    return {
      topPct: (clampedFrom / totalMinutes) * 100,
      // Floor the height so a short block stays visible.
      heightPct: Math.max(((clampedTo - clampedFrom) / totalMinutes) * 100, 2),
    }
  }

  function column(day: ZonedDay) {
    const windowStart = zonedTimeToUtc(day.year, day.month, day.day, startHour, 0, timeZone)
    const dayStart = zonedTimeToUtc(day.year, day.month, day.day, 0, 0, timeZone)
    const dayEnd = dayStart + 24 * 60 * MS_PER_MIN

    const busyPositions: Positioned[] = []
    for (const block of busyBlocks) {
      if (block.end <= dayStart || block.start >= dayEnd) continue
      // Clip to the day so an overnight block renders on both days.
      const pos = place(
        Math.max(block.start, dayStart),
        Math.min(block.end, dayEnd),
        windowStart
      )
      if (pos) busyPositions.push(pos)
    }

    const slotPositions: PositionedSlot[] = []
    for (const slot of slots) {
      if (slot.start < dayStart || slot.start >= dayEnd) continue
      const pos = place(slot.start, slot.end, windowStart)
      if (pos) slotPositions.push({ ...pos, slot })
    }

    const bandTop = ((WORKDAY_START_HOUR - startHour) * 60) / totalMinutes
    const bandBottom = ((WORKDAY_END_HOUR - startHour) * 60) / totalMinutes

    return {
      busyPositions,
      slotPositions,
      hasAllDay: allDayBlocks.some((b) => b.start < dayEnd && b.end > dayStart),
      bandTopPct: Math.max(0, bandTop * 100),
      bandHeightPct: Math.max(0, Math.min(1, bandBottom) * 100 - Math.max(0, bandTop) * 100),
    }
  }

  const columns = days.map((day) => ({ day, ...column(day) }))
  const anyAllDay = columns.some((c) => c.hasAllDay)
  const todayKey = `${days[0].year}-${days[0].month}-${days[0].day}`
  const gridHeight = `${hours.length * HOUR_ROW_REM}rem`

  return (
    <div className="flex flex-col gap-2">
      <div className="min-w-[38rem]">
        <div className="flex gap-1 pl-10">
          {columns.map(({ day }) => {
            const isToday = `${day.year}-${day.month}-${day.day}` === todayKey
            const preferred = preferredDays.includes(day.weekday)
            return (
              <div
                key={`${day.year}-${day.month}-${day.day}`}
                className="flex-1 pb-1 text-center"
              >
                <p
                  className={cn(
                    "text-[0.7rem] uppercase",
                    preferred ? "text-muted-foreground" : "text-muted-foreground/50"
                  )}
                >
                  {DAY_LABELS[day.weekday]}
                </p>
                <p
                  className={cn(
                    "text-sm",
                    isToday ? "font-semibold text-foreground" : "text-muted-foreground",
                    !preferred && "text-muted-foreground/50"
                  )}
                >
                  {day.day}
                </p>
              </div>
            )
          })}
        </div>

        {anyAllDay && (
          <div className="flex gap-1 pb-1 pl-10">
            {columns.map(({ day, hasAllDay }) => (
              <div key={`${day.year}-${day.month}-${day.day}`} className="flex-1">
                {hasAllDay ? (
                  <div className="rounded-sm bg-muted-foreground/25 px-1 py-0.5 text-center text-[0.65rem] text-muted-foreground">
                    All day
                  </div>
                ) : (
                  <div className="py-0.5 text-[0.65rem]">&nbsp;</div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-1">
          <div className="relative w-9 shrink-0" style={{ height: gridHeight }}>
            {hours.map((hour, i) => (
              <div
                key={hour}
                className="absolute right-1 -translate-y-1/2 text-[0.65rem] text-muted-foreground"
                style={{ top: `${(i / hours.length) * 100}%` }}
              >
                {formatHour(hour)}
              </div>
            ))}
          </div>

          {columns.map(
            ({ day, busyPositions, slotPositions, bandTopPct, bandHeightPct }) => {
              const preferred = preferredDays.includes(day.weekday)
              return (
                <div
                  key={`${day.year}-${day.month}-${day.day}`}
                  className={cn(
                    "relative flex-1 overflow-hidden rounded-md border border-border",
                    preferred ? "bg-muted/20" : "bg-muted/50"
                  )}
                  style={{ height: gridHeight }}
                >
                  {/* Bookable band: 9–5 on preferred days only. */}
                  {preferred && bandHeightPct > 0 && (
                    <div
                      className="absolute inset-x-0 bg-background"
                      style={{ top: `${bandTopPct}%`, height: `${bandHeightPct}%` }}
                    />
                  )}
                  {hours.map((hour, i) =>
                    i === 0 ? null : (
                      <div
                        key={hour}
                        className="absolute inset-x-0 border-t border-border/60"
                        style={{ top: `${(i / hours.length) * 100}%` }}
                      />
                    )
                  )}
                  {busyPositions.map((pos, i) => (
                    <div
                      key={`busy-${i}`}
                      className="absolute inset-x-0.5 rounded-sm bg-muted-foreground/30"
                      style={{ top: `${pos.topPct}%`, height: `${pos.heightPct}%` }}
                      title="Busy"
                    />
                  ))}
                  {slotPositions.map(({ slot, topPct, heightPct }) => {
                    const isSelected = selected.includes(slot.start)
                    return (
                      <button
                        key={slot.start}
                        type="button"
                        onClick={() => onSlotClick(slot)}
                        aria-pressed={isSelected}
                        aria-label={`${formatZonedDayLabel(
                          slot.start,
                          timeZone
                        )} ${formatZonedTime(slot.start, timeZone)}`}
                        className={cn(
                          "group absolute inset-x-0.5 flex cursor-pointer items-center justify-center rounded-sm border text-[0.65rem] transition-colors",
                          isSelected
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-transparent text-transparent hover:border-primary/40 hover:bg-primary/10 hover:text-primary"
                        )}
                        style={{ top: `${topPct}%`, height: `${heightPct}%` }}
                      >
                        {formatZonedTime(slot.start, timeZone)}
                      </button>
                    )
                  })}
                </div>
              )
            }
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="inline-block size-2.5 rounded-sm bg-muted-foreground/30" />
          Busy
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block size-2.5 rounded-sm bg-primary" />
          Selected
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block size-2.5 rounded-sm border border-border bg-background" />
          Open {WORKDAY_START_HOUR}:00–{WORKDAY_END_HOUR}:00{" "}
          {timezoneAbbreviation(timeZone)}
        </span>
      </div>
    </div>
  )
}

// ── Forms (UI only — nothing is created or sent yet) ─────────────────────────

function CreateEventForm({
  slot,
  slotMinutes,
  timeZone,
  interviewer,
  onDurationChange,
  onCancel,
}: {
  slot: Slot
  slotMinutes: number
  timeZone: string
  interviewer: string
  onDurationChange: (minutes: number) => void
  onCancel: () => void
}) {
  const [title, setTitle] = React.useState("Interview")
  const [candidate, setCandidate] = React.useState("")
  const [notes, setNotes] = React.useState("")

  return (
    <div className="flex max-w-xl flex-col gap-4 py-2">
      <div className="rounded-md border border-border bg-muted/30 px-3 py-2">
        <p className="text-sm font-medium">
          {formatZonedDayLabel(slot.start, timeZone)} ·{" "}
          {formatZonedTime(slot.start, timeZone)} – {formatZonedTime(slot.end, timeZone)}{" "}
          {timezoneAbbreviation(timeZone)}
        </p>
        <p className="text-xs text-muted-foreground">
          {interviewer.replace(/'s calendar$/, "")}
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="event-title">Title</Label>
        <Input id="event-title" value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="event-duration">Length</Label>
        <Select
          value={String(slotMinutes)}
          onValueChange={(v) => onDurationChange(Number(v))}
        >
          <SelectTrigger id="event-duration" className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DURATIONS.map((minutes) => (
              <SelectItem key={minutes} value={String(minutes)}>
                {minutes} min
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="event-candidate">Candidate email</Label>
        <Input
          id="event-candidate"
          type="email"
          value={candidate}
          onChange={(e) => setCandidate(e.target.value)}
          placeholder="candidate@example.com"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="event-notes">Notes</Label>
        <Textarea
          id="event-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Anything the interviewer should know"
        />
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          onClick={() =>
            toast.success("Interview details captured.", {
              description: "Creating the calendar event isn't wired up yet.",
            })
          }
        >
          Create event
        </Button>
      </div>
    </div>
  )
}

function ProposeTimesForm({
  slots,
  timeZone,
  onCancel,
}: {
  slots: Slot[]
  timeZone: string
  onCancel: () => void
}) {
  const [recipient, setRecipient] = React.useState("")
  const [recipientZone, setRecipientZone] = React.useState(DEFAULT_TIMEZONE)
  const [message, setMessage] = React.useState(
    "Here are a few times that work — let me know which suits you best."
  )

  return (
    <div className="flex max-w-xl flex-col gap-4 py-2">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="propose-recipient">Send to</Label>
        <Input
          id="propose-recipient"
          type="email"
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
          placeholder="candidate@example.com"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="propose-zone">Their timezone</Label>
        <Select value={recipientZone} onValueChange={(v) => setRecipientZone(v as string)}>
          <SelectTrigger id="propose-zone" className="w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TIMEZONES.map((tz) => (
              <SelectItem key={tz.value} value={tz.value}>
                {tz.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="propose-message">Message</Label>
        <Textarea
          id="propose-message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Times ({slots.length})</Label>
        <ul className="flex flex-col gap-1">
          {slots.map((slot) => (
            <li
              key={slot.start}
              className="flex flex-wrap items-baseline justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm"
            >
              <span className="font-medium">
                {formatZonedDayLabel(slot.start, timeZone)}{" "}
                {formatZonedTime(slot.start, timeZone)}{" "}
                <span className="text-xs font-normal text-muted-foreground">
                  {timezoneAbbreviation(timeZone)}
                </span>
              </span>
              {/* The point of the recipient zone: catch a wrong-hour proposal
                  before it's sent, not after they reply confused. */}
              <span className="text-xs text-muted-foreground">
                {formatZonedDayLabel(slot.start, recipientZone)}{" "}
                {formatZonedTime(slot.start, recipientZone)}{" "}
                {timezoneAbbreviation(recipientZone)}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel}>
          Back
        </Button>
        <Button
          onClick={() =>
            toast.success(`${slots.length} times ready to send.`, {
              description: "Sending isn't wired up yet.",
            })
          }
        >
          Send times
        </Button>
      </div>
    </div>
  )
}

function formatHour(hour: number): string {
  if (hour === 0) return "12a"
  if (hour === 12) return "12p"
  return hour < 12 ? `${hour}a` : `${hour - 12}p`
}
