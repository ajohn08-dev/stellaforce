"use client"

import * as React from "react"
import { CalendarClock, Check, Loader2, Phone } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  confirmBooking,
  holdSlot,
  releaseHold,
  type BookingView,
  type SlotOption,
} from "@/app/book/actions"

/**
 * What a candidate actually does: pick a timezone, pick a time (or start now),
 * and confirm.
 *
 * Two rules shape this component:
 *
 *  1. **Everything is an absolute instant until it is rendered.** Slots arrive
 *     as ISO strings generated in the *agent's* operating timezone; the picker
 *     only changes how they are formatted. Generating a grid per viewer would
 *     give two candidates in different zones misaligned slots for the same
 *     agent, and the agent's capacity would fragment into unbookable slivers.
 *  2. **A hold is taken on selection, not on confirm.** Clicking a time reserves
 *     the agent's lane for a few minutes, so the candidate reading the
 *     confirmation screen doesn't lose it to someone faster. Navigating away
 *     releases it — a browsing candidate must not consume an agent's capacity.
 */
export function BookingPage({ token, view }: { token: string; view: BookingView }) {
  // `candidates.timezone` is nullable and is the only timezone column in the
  // schema, so the server's suggestion may be the agent's zone rather than the
  // candidate's. The browser knows better — read as an external value rather
  // than synced into state by an effect, which would cascade a render and
  // mismatch on hydration.
  const browserTimezone = React.useSyncExternalStore(
    () => () => {},
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || view.candidateTimezone,
    () => view.candidateTimezone
  )
  const [chosenTimezone, setChosenTimezone] = React.useState<string | null>(null)
  const timezone = chosenTimezone ?? browserTimezone

  const [selected, setSelected] = React.useState<string | null>(null)
  const [holdId, setHoldId] = React.useState<string | null>(null)
  const [holdExpiresAt, setHoldExpiresAt] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [pending, startTransition] = React.useTransition()
  const [confirmed, setConfirmed] = React.useState<{
    scheduledAt: string
    startNow: boolean
  } | null>(null)

  // Give the lane back if the candidate closes the tab mid-decision.
  React.useEffect(() => {
    if (!holdId) return
    const release = () => {
      void releaseHold(token)
    }
    window.addEventListener("pagehide", release)
    return () => window.removeEventListener("pagehide", release)
  }, [holdId, token])

  if (view.booked || confirmed) {
    const at = confirmed?.scheduledAt ?? view.booked!.scheduledAt
    return (
      <Confirmation
        scheduledAt={at}
        timezone={view.booked?.timezone ?? timezone}
        startNow={confirmed?.startNow ?? false}
        view={view}
      />
    )
  }

  const byDay = groupByDay(view.slots, timezone)

  function pick(slot: SlotOption) {
    setError(null)
    startTransition(async () => {
      const result = await holdSlot(token, slot.start)
      if (!result.ok) {
        setError(result.message)
        setSelected(null)
        setHoldId(null)
        return
      }
      setSelected(slot.start)
      setHoldId(result.holdId)
      setHoldExpiresAt(result.expiresAt)
    })
  }

  function confirm(startNow: boolean) {
    setError(null)
    startTransition(async () => {
      const result = await confirmBooking({
        token,
        holdId: startNow ? null : holdId,
        timezone,
        startNow,
      })
      if (!result.ok) {
        setError(result.message)
        // The held slot is gone either way; make the candidate re-pick rather
        // than leaving a dead selection highlighted.
        setSelected(null)
        setHoldId(null)
        return
      }
      setConfirmed({ scheduledAt: result.scheduledAt, startNow: result.startNow })
    })
  }

  return (
    <div className="space-y-4">
      <header className="rounded-xl border border-border bg-white p-6 shadow-sm">
        <h1 className="text-lg font-semibold text-foreground">
          {view.candidateFirstName
            ? `Hi ${view.candidateFirstName} — let's book your interview`
            : "Let's book your interview"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {view.stageName} for {view.jobTitle}
          {view.companyName ? ` at ${view.companyName}` : ""} · {view.slotMinutes} minutes
        </p>
        <p className="mt-3 text-sm text-muted-foreground">
          This is a phone interview with an AI interviewer. Pick a time that suits you and
          we&apos;ll call you.
        </p>
      </header>

      <TimezonePicker value={timezone} onChange={setChosenTimezone} />

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"
        >
          {error}
        </div>
      )}

      {view.allowStartNow && (
        <section className="rounded-xl border border-border bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <h2 className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Phone className="size-4 shrink-0 text-muted-foreground" />
                Start now
              </h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {view.canStartNow
                  ? "We'll call you in the next minute or so."
                  : "Not available right now — pick a time below instead."}
              </p>
            </div>
            <Button
              type="button"
              disabled={!view.canStartNow || pending}
              onClick={() => confirm(true)}
              className="shrink-0"
            >
              {pending ? <Loader2 className="size-4 animate-spin" /> : "Call me now"}
            </Button>
          </div>
        </section>
      )}

      <section className="rounded-xl border border-border bg-white p-5 shadow-sm">
        <h2 className="flex items-center gap-2 text-sm font-medium text-foreground">
          <CalendarClock className="size-4 shrink-0 text-muted-foreground" />
          Choose a time
        </h2>

        {byDay.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            There are no times available at the moment. We&apos;ll be in touch.
          </p>
        ) : (
          <div className="mt-4 space-y-5">
            {byDay.map(({ day, slots }) => (
              <div key={day} className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">{day}</p>
                <div className="flex flex-wrap gap-2">
                  {slots.map((slot) => (
                    <button
                      key={slot.start}
                      type="button"
                      disabled={pending}
                      aria-pressed={selected === slot.start}
                      onClick={() => pick(slot)}
                      className={cn(
                        "rounded-md border px-3 py-1.5 text-sm transition-colors",
                        selected === slot.start
                          ? "border-foreground bg-foreground text-background"
                          : "border-border hover:bg-muted/60",
                        pending && "opacity-60"
                      )}
                    >
                      {formatTime(slot.start, timezone)}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {selected && holdId && (
        <section className="rounded-xl border border-border bg-white p-5 shadow-sm">
          <p className="text-sm text-foreground">
            {formatFull(selected, timezone)}
          </p>
          {holdExpiresAt && <HoldCountdown expiresAt={holdExpiresAt} />}
          <Button
            type="button"
            className="mt-3 w-full"
            disabled={pending}
            onClick={() => confirm(false)}
          >
            {pending ? <Loader2 className="size-4 animate-spin" /> : "Confirm this time"}
          </Button>
        </section>
      )}
    </div>
  )
}

function Confirmation({
  scheduledAt,
  timezone,
  startNow,
  view,
}: {
  scheduledAt: string
  timezone: string | null
  startNow: boolean
  view: BookingView
}) {
  const tz = timezone ?? view.candidateTimezone
  return (
    <div className="rounded-xl border border-border bg-white p-8 text-center shadow-sm">
      <div className="mx-auto flex size-10 items-center justify-center rounded-full bg-foreground text-background">
        <Check className="size-5" />
      </div>
      <h1 className="mt-4 text-lg font-semibold text-foreground">
        {startNow ? "We're calling you now" : "You're booked"}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {startNow
          ? "Keep your phone nearby — the call should arrive within a minute."
          : formatFull(scheduledAt, tz)}
      </p>
      <p className="mt-4 text-sm text-muted-foreground">
        {view.stageName} for {view.jobTitle}
        {view.companyName ? ` at ${view.companyName}` : ""} · {view.slotMinutes} minutes
      </p>
      <p className="mt-4 text-xs text-muted-foreground">
        Need to change this? Reply to the email you received and we&apos;ll sort it out.
      </p>
    </div>
  )
}

/**
 * The lease clock.
 *
 * Shown because a slot silently disappearing is worse than one that visibly
 * counts down: the candidate can see they have a moment to decide, and why the
 * time went away if they don't.
 */
function HoldCountdown({ expiresAt }: { expiresAt: string }) {
  const [left, setLeft] = React.useState(() => remaining(expiresAt))
  React.useEffect(() => {
    const id = setInterval(() => setLeft(remaining(expiresAt)), 1000)
    return () => clearInterval(id)
  }, [expiresAt])

  if (left <= 0) {
    return (
      <p className="mt-1 text-xs text-destructive">
        This time is no longer held — pick again to reserve it.
      </p>
    )
  }
  const m = Math.floor(left / 60)
  const s = left % 60
  return (
    <p className="mt-1 text-xs text-muted-foreground">
      Held for you for {m}:{String(s).padStart(2, "0")}
    </p>
  )
}

function remaining(expiresAt: string): number {
  return Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000))
}

/**
 * Timezones from `Intl` rather than the app's 7-entry `TIMEZONES` list — that is
 * fine for internal use and embarrassing on a page a candidate anywhere might
 * open. Falls back to the app list where `supportedValuesOf` is unavailable.
 */
function TimezonePicker({
  value,
  onChange,
}: {
  value: string
  onChange: (tz: string) => void
}) {
  const zones = React.useMemo(() => {
    try {
      const all = Intl.supportedValuesOf("timeZone")
      return all.includes(value) ? all : [value, ...all]
    } catch {
      return [value]
    }
  }, [value])

  return (
    <label className="flex items-center justify-between gap-3 rounded-xl border border-border bg-white px-5 py-3 text-sm shadow-sm">
      <span className="text-muted-foreground">Times shown in</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-w-0 flex-1 truncate rounded-md border border-border bg-transparent px-2 py-1 text-right text-sm"
      >
        {zones.map((z) => (
          <option key={z} value={z}>
            {z.replace(/_/g, " ")}
          </option>
        ))}
      </select>
    </label>
  )
}

// ── Formatting. Always through Intl with the zone name — never an offset,
//    which would be wrong on the far side of a DST boundary.

function formatTime(iso: string, timeZone: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
  })
}

function formatFull(iso: string, timeZone: string): string {
  return new Date(iso).toLocaleString("en-US", {
    timeZone,
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  })
}

function groupByDay(
  slots: SlotOption[],
  timeZone: string
): { day: string; slots: SlotOption[] }[] {
  const out: { day: string; slots: SlotOption[] }[] = []
  for (const slot of slots) {
    const day = new Date(slot.start).toLocaleDateString("en-US", {
      timeZone,
      weekday: "long",
      month: "long",
      day: "numeric",
    })
    const last = out[out.length - 1]
    if (last && last.day === day) last.slots.push(slot)
    else out.push({ day, slots: [slot] })
  }
  return out
}
