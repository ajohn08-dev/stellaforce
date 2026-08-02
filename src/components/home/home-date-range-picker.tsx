"use client"

import * as React from "react"
import type { DateRange } from "react-day-picker"
import { CalendarDays, ChevronDown } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

function startOfDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

function formatRangeLabel(range: DateRange | undefined): string {
  if (!range?.from) return "Select dates"
  const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
  if (!range.to || range.to.getTime() === range.from.getTime()) return fmt(range.from)
  return `${fmt(range.from)} – ${fmt(range.to)}`
}

type Preset = {
  label: string
  getRange: () => DateRange
}

function buildPresets(): Preset[] {
  const today = startOfDay(new Date())
  return [
    { label: "Today", getRange: () => ({ from: today, to: today }) },
    {
      label: "This week",
      getRange: () => ({ from: today, to: addDays(today, 8) }),
    },
    {
      label: "Last 7 days",
      getRange: () => ({ from: addDays(today, -6), to: today }),
    },
    {
      label: "Last 30 days",
      getRange: () => ({ from: addDays(today, -29), to: today }),
    },
    {
      label: "This month",
      getRange: () => ({
        from: new Date(today.getFullYear(), today.getMonth(), 1),
        to: new Date(today.getFullYear(), today.getMonth() + 1, 0),
      }),
    },
  ]
}

/**
 * UI-only — selection is local state and doesn't drive any data on the page
 * yet. Defaults to "This week" (today through +8 days) to match the design's
 * mock content ("Aug 2 - Aug 10").
 */
export function HomeDateRangePicker() {
  const presets = React.useMemo(() => buildPresets(), [])
  const [open, setOpen] = React.useState(false)
  const [appliedRange, setAppliedRange] = React.useState<DateRange | undefined>(
    () => presets[1].getRange()
  )
  const [draftRange, setDraftRange] = React.useState<DateRange | undefined>(appliedRange)

  function handleOpenChange(next: boolean) {
    if (next) setDraftRange(appliedRange)
    setOpen(next)
  }

  function handleApply() {
    setAppliedRange(draftRange)
    setOpen(false)
  }

  function handleCancel() {
    setDraftRange(appliedRange)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        render={
          <Button type="button" variant="outline" className="gap-1.5">
            <CalendarDays className="size-4" />
            {formatRangeLabel(appliedRange)}
            <ChevronDown className="size-4" />
          </Button>
        }
      />
      <PopoverContent align="end" className="w-auto p-0">
        <div className="flex">
          <div className="flex w-36 flex-col gap-0.5 p-2">
            {presets.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => setDraftRange(preset.getRange())}
                className={cn(
                  "rounded-md px-2 py-1.5 text-left text-sm outline-hidden select-none hover:bg-accent hover:text-accent-foreground"
                )}
              >
                {preset.label}
              </button>
            ))}
          </div>
          <Separator orientation="vertical" className="h-auto" />
          <div className="p-2.5">
            <Calendar
              mode="range"
              defaultMonth={draftRange?.from}
              selected={draftRange}
              onSelect={setDraftRange}
              numberOfMonths={2}
            />
            <Separator className="my-2.5" />
            <div className="flex items-center justify-end gap-2 px-0.5 pb-0.5">
              <Button type="button" variant="outline" size="sm" onClick={handleCancel}>
                Cancel
              </Button>
              <Button type="button" size="sm" onClick={handleApply}>
                Apply
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
