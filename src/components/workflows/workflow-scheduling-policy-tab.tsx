"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { RadioCardGroup } from "@/components/workflows/radio-card-group"
import { WorkflowSubNav } from "@/components/workflows/workflow-sub-nav"
import { PolicySettingSection } from "@/components/workflows/policy-rows"
import {
  AVAILABILITY_SETTINGS,
  BOOKING_SETTINGS,
  CALENDAR_SETTINGS,
  RESCHEDULE_SETTINGS,
  SCHEDULING_MODE_OPTIONS,
  schedulingPolicyWithDefaults,
  type StoredSchedulingPolicy,
} from "@/lib/scheduling-policy"

const SUB_NAV_ITEMS = [
  "Scheduling Policy",
  "Booking Rules",
  "Reschedule & Cancel",
  "Availability",
  "Calendar",
] as const
type SubNavItem = (typeof SUB_NAV_ITEMS)[number]

/**
 * Fields are unwired placeholders — not yet saved anywhere. `policy` is
 * whatever the workflow has stored; anything it doesn't carry (which for a
 * newly created workflow is everything) comes from
 * `DEFAULT_SCHEDULING_POLICY`, so this tab is never blank on a new workflow.
 */
export function WorkflowSchedulingPolicyTab({
  policy,
}: {
  policy?: StoredSchedulingPolicy
}) {
  const initial = React.useMemo(() => schedulingPolicyWithDefaults(policy), [policy])

  const [activeSubNav, setActiveSubNav] = React.useState<SubNavItem>("Scheduling Policy")
  const [schedulingEnabled, setSchedulingEnabled] = React.useState(initial.enabled)
  const [schedulingMode, setSchedulingMode] = React.useState(initial.mode)
  const [values, setValues] = React.useState<Record<string, string>>(initial.settings)

  function setValue(key: string, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <div className="mx-auto flex h-full w-full max-w-4xl flex-col gap-6">
      {/*
        The master switch: everything below is one pipeline's scheduling
        configuration, and none of it means anything if Stellaforce isn't
        scheduling at all — so it sits above the rail, not inside a section,
        and `inert` blocks interaction (and focus) with the rest when off.
      */}
      <div className="flex shrink-0 items-center justify-between gap-6 border-b border-border pb-6">
        <div className="flex flex-col gap-0.5">
          <Label>Scheduling enabled</Label>
          <p className="text-sm text-muted-foreground">
            Whether Stellaforce can schedule interviews for jobs on this pipeline
          </p>
        </div>
        <Switch
          checked={schedulingEnabled}
          onCheckedChange={setSchedulingEnabled}
          className="shrink-0"
        />
      </div>

      <div
        inert={!schedulingEnabled}
        className={cn("flex min-h-0 flex-1 gap-8", !schedulingEnabled && "opacity-50")}
      >
        <WorkflowSubNav
          items={SUB_NAV_ITEMS}
          value={activeSubNav}
          onValueChange={setActiveSubNav}
          className="w-44"
        />

        <div className="h-full min-w-0 flex-1 overflow-y-auto">
          {activeSubNav === "Scheduling Policy" ? (
            <div className="flex flex-col gap-2">
              <div className="flex flex-col gap-0.5">
                <Label>Default scheduling mode</Label>
                <p className="text-sm text-muted-foreground">
                  How interviews are coordinated unless a stage overrides it
                </p>
              </div>
              <RadioCardGroup
                value={schedulingMode}
                onValueChange={setSchedulingMode}
                options={SCHEDULING_MODE_OPTIONS}
              />
            </div>
          ) : activeSubNav === "Booking Rules" ? (
            <PolicySettingSection
              title="Booking Rules"
              description="What candidates can book, how far out, and how slots are offered"
              settings={BOOKING_SETTINGS}
              values={values}
              onValueChange={setValue}
            />
          ) : activeSubNav === "Reschedule & Cancel" ? (
            <PolicySettingSection
              title="Rescheduling & Cancellation"
              description="What a candidate may change once an interview is confirmed"
              settings={RESCHEDULE_SETTINGS}
              values={values}
              onValueChange={setValue}
            />
          ) : activeSubNav === "Availability" ? (
            <PolicySettingSection
              title="Availability & Conflicts"
              description="Which calendar events block a slot, and what happens when none are free"
              settings={AVAILABILITY_SETTINGS}
              values={values}
              onValueChange={setValue}
            />
          ) : (
            <PolicySettingSection
              title="Calendar"
              description="How the calendar event is written once an interview is confirmed"
              settings={CALENDAR_SETTINGS}
              values={values}
              onValueChange={setValue}
            />
          )}
        </div>
      </div>
    </div>
  )
}
