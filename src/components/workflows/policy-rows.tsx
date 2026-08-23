"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  POLICY_SCOPE_LABEL,
  type PolicySettingDef,
  type PolicySettingOption,
  type Resolved,
} from "@/lib/policy-settings"

/** Picking this clears the scope's override and hands the setting back to the cascade. */
export const INHERIT = "__inherit__"

function RowShell({
  label,
  description,
  note,
  children,
}: {
  label: string
  description: string
  note?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-6 border-b border-border py-4 first:pt-0 last:border-b-0">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-sm font-medium text-foreground">{label}</span>
        <span className="text-sm text-muted-foreground">{description}</span>
        {note}
      </div>
      {children}
    </div>
  )
}

/** One setting at the scope that owns it — no inheritance, the value is simply set here. */
export function PolicySettingRow({
  setting,
  value,
  onValueChange,
}: {
  setting: PolicySettingDef
  value: string
  onValueChange: (value: string) => void
}) {
  return (
    <RowShell label={setting.label} description={setting.description}>
      {/* `items` is what lets the trigger show the option's label — without it Base UI renders the raw value. */}
      <Select items={setting.options} value={value} onValueChange={(v) => v && onValueChange(v)}>
        <SelectTrigger className="w-60 shrink-0">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {setting.options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </RowShell>
  )
}

/** A titled group of settings, as the workflow-level policy tabs render them. */
export function PolicySettingSection({
  title,
  description,
  settings,
  values,
  onValueChange,
}: {
  title: string
  description: string
  settings: PolicySettingDef[]
  values: Record<string, string>
  onValueChange: (key: string, value: string) => void
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-0.5">
        <Label>{title}</Label>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="flex flex-col">
        {settings.map((setting) => (
          <PolicySettingRow
            key={setting.key}
            setting={setting}
            value={values[setting.key] ?? setting.defaultValue}
            onValueChange={(value) => onValueChange(setting.key, value)}
          />
        ))}
      </div>
    </div>
  )
}

/**
 * One setting at a scope that inherits — the resolved value, where it came
 * from, and an override written directly under it. Same inverted read the
 * company workspace uses on a job: one answer, one badge, one place to change
 * it.
 */
export function InheritedPolicyRow({
  label,
  description,
  options,
  resolved,
  override,
  onOverrideChange,
}: {
  label: string
  description: string
  options: PolicySettingOption[]
  /** What this setting resolves to from the scopes *above* this one. */
  resolved: Resolved<string>
  override: string | undefined
  onOverrideChange: (value: string | undefined) => void
}) {
  const resolvedLabel = options.find((o) => o.value === resolved.value)?.label ?? resolved.value
  const items = React.useMemo(
    () => [{ value: INHERIT, label: `Inherit · ${resolvedLabel}` }, ...options],
    [options, resolvedLabel]
  )

  return (
    <RowShell
      label={label}
      description={description}
      note={
        <span className="text-xs text-muted-foreground">
          {override !== undefined
            ? "Set for this stage"
            : `From ${POLICY_SCOPE_LABEL[resolved.source].toLowerCase()}`}
        </span>
      }
    >
      <Select
        items={items}
        value={override ?? INHERIT}
        onValueChange={(v) => v && onOverrideChange(v === INHERIT ? undefined : v)}
      >
        <SelectTrigger
          className={cn("w-60 shrink-0", override === undefined && "text-muted-foreground")}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {items.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </RowShell>
  )
}
