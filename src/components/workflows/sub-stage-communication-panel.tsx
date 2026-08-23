"use client"

import * as React from "react"

import { Label } from "@/components/ui/label"
import { InheritedPolicyRow } from "@/components/workflows/policy-rows"
import { pruneStoredPolicy } from "@/lib/policy-settings"
import {
  SUB_STAGE_COMMUNICATION_SETTINGS,
  resolveCommunicationSetting,
  type CommunicationLayers,
  type StoredCommunicationPolicy,
} from "@/lib/communication-policy"

/**
 * A sub-stage's communication overrides. Offered on the same stages as
 * Scheduling — the ones that put a candidate and an interviewer in a slot —
 * and only for the settings that genuinely vary by stage; see
 * SUB_STAGE_COMMUNICATION_KEYS for why the rest are workflow-wide.
 *
 * Overrides ride in the sub-stage's `config` jsonb, the same escape hatch the
 * External Tool setup and the scheduling overrides use — there's no dedicated
 * column yet.
 */
export function SubStageCommunicationPanel({
  communication,
  workflowPolicy,
  onChange,
}: {
  communication: StoredCommunicationPolicy | undefined
  /** What the workflow's Communication tab has set — the scope directly above this stage. */
  workflowPolicy: StoredCommunicationPolicy | undefined
  onChange: (next: StoredCommunicationPolicy | undefined) => void
}) {
  /** The cascade above this stage — what a setting falls back to when the stage clears its override. */
  const inherited: CommunicationLayers = React.useMemo(
    () => ({ workflow: workflowPolicy }),
    [workflowPolicy]
  )

  function setSetting(key: string, value: string | undefined) {
    const settings = { ...(communication?.settings ?? {}) }
    if (value === undefined) delete settings[key]
    else settings[key] = value
    onChange(pruneStoredPolicy({ ...communication, settings }))
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-0.5">
        <Label>Communication</Label>
        <p className="text-sm text-muted-foreground">
          What candidates and interviewers are sent around this stage. Anything left on Inherit
          follows the workflow.
        </p>
      </div>

      <div className="flex flex-col">
        {SUB_STAGE_COMMUNICATION_SETTINGS.map((setting) => (
          <InheritedPolicyRow
            key={setting.key}
            label={setting.label}
            description={setting.description}
            options={setting.options}
            resolved={resolveCommunicationSetting(setting.key, inherited)}
            override={communication?.settings?.[setting.key]}
            onOverrideChange={(value) => setSetting(setting.key, value)}
          />
        ))}
      </div>
    </div>
  )
}
