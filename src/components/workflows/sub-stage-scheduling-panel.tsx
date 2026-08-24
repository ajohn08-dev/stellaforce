"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { Label } from "@/components/ui/label"
import { InheritedPolicyRow } from "@/components/workflows/policy-rows"
import { pruneStoredPolicy } from "@/lib/policy-settings"
import {
  SCHEDULING_MODE_OPTIONS,
  SUB_STAGE_SCHEDULING_SETTINGS,
  resolveSchedulingEnabled,
  resolveSchedulingMode,
  resolveSchedulingSetting,
  type SchedulingLayers,
  type SchedulingMode,
  type StoredSchedulingPolicy,
} from "@/lib/scheduling-policy"

const ENABLED_OPTIONS = [
  { value: "enabled", label: "Enabled" },
  { value: "disabled", label: "Disabled" },
]

const MODE_OPTIONS = SCHEDULING_MODE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))

/**
 * A sub-stage's scheduling overrides. Only offered on Screening and Interview
 * stages (the ones that actually put a candidate and an interviewer in the
 * same slot), and only for the settings that genuinely vary by stage — see
 * SUB_STAGE_SCHEDULING_KEYS for why the rest are workflow-wide.
 *
 * Overrides ride in the sub-stage's `config` jsonb, the same escape hatch the
 * External Tool setup uses — there's no dedicated column yet.
 */
export function SubStageSchedulingPanel({
  scheduling,
  workflowPolicy,
  onChange,
}: {
  scheduling: StoredSchedulingPolicy | undefined
  /** What the workflow's Scheduling Policy tab has set — the scope directly above this stage. */
  workflowPolicy: StoredSchedulingPolicy | undefined
  onChange: (next: StoredSchedulingPolicy | undefined) => void
}) {
  const layers: SchedulingLayers = React.useMemo(
    () => ({ workflow: workflowPolicy, sub_stage: scheduling }),
    [workflowPolicy, scheduling]
  )
  /** The cascade above this stage — what a setting falls back to when the stage clears its override. */
  const inherited: SchedulingLayers = React.useMemo(
    () => ({ workflow: workflowPolicy }),
    [workflowPolicy]
  )

  /** Drops keys that are back to inheriting, so an untouched stage stores nothing at all. */
  function update(next: StoredSchedulingPolicy) {
    onChange(pruneStoredPolicy(next))
  }

  function setSetting(key: string, value: string | undefined) {
    const settings = { ...(scheduling?.settings ?? {}) }
    if (value === undefined) delete settings[key]
    else settings[key] = value
    update({ ...scheduling, settings })
  }

  const enabled = resolveSchedulingEnabled(inherited)
  const mode = resolveSchedulingMode(inherited)
  const stageEnabled = resolveSchedulingEnabled(layers).value

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-0.5">
        <Label>Scheduling</Label>
        <p className="text-sm text-muted-foreground">
          How this stage&apos;s interviews get booked. Anything left on Inherit follows the
          workflow.
        </p>
      </div>

      <div className="flex flex-col">
        <InheritedPolicyRow
          label="Scheduling enabled"
          description="Whether Stellaforce books interviews for this stage"
          options={ENABLED_OPTIONS}
          resolved={{ value: enabled.value ? "enabled" : "disabled", source: enabled.source }}
          override={
            scheduling?.enabled === undefined
              ? undefined
              : scheduling.enabled
                ? "enabled"
                : "disabled"
          }
          onOverrideChange={(value) =>
            update({ ...scheduling, enabled: value === undefined ? undefined : value === "enabled" })
          }
        />

        <InheritedPolicyRow
          label="Scheduling mode"
          description="How this stage is coordinated"
          options={MODE_OPTIONS}
          resolved={mode}
          override={scheduling?.mode}
          onOverrideChange={(value) =>
            update({ ...scheduling, mode: value as SchedulingMode | undefined })
          }
        />
      </div>

      <div
        inert={!stageEnabled}
        className={cn("flex flex-col", !stageEnabled && "opacity-50")}
      >
        {SUB_STAGE_SCHEDULING_SETTINGS.map((setting) => (
          <InheritedPolicyRow
            key={setting.key}
            label={setting.label}
            description={setting.description}
            options={setting.options}
            resolved={resolveSchedulingSetting(setting.key, inherited)}
            override={scheduling?.settings?.[setting.key]}
            onOverrideChange={(value) => setSetting(setting.key, value)}
          />
        ))}
      </div>
    </div>
  )
}
