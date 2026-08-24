"use client"

import * as React from "react"

import { WorkflowSubNav } from "@/components/workflows/workflow-sub-nav"
import { PolicySettingSection } from "@/components/workflows/policy-rows"
import {
  INTERVIEWER_PREP_SETTINGS,
  INVITE_SETTINGS,
  REMINDER_SETTINGS,
  communicationPolicyWithDefaults,
  type StoredCommunicationPolicy,
} from "@/lib/communication-policy"

const SUB_NAV_ITEMS = ["Invites", "Reminders", "Interviewer Prep"] as const
type SubNavItem = (typeof SUB_NAV_ITEMS)[number]

/**
 * Fields are unwired placeholders — not yet saved anywhere. `policy` is
 * whatever the workflow has stored; anything it doesn't carry (which for a
 * newly created workflow is everything) comes from
 * `DEFAULT_COMMUNICATION_POLICY`, so this tab is never blank on a new
 * workflow.
 */
export function WorkflowCommunicationTab({
  policy,
}: {
  policy?: StoredCommunicationPolicy
}) {
  const initial = React.useMemo(() => communicationPolicyWithDefaults(policy), [policy])

  const [activeSubNav, setActiveSubNav] = React.useState<SubNavItem>("Invites")
  const [values, setValues] = React.useState<Record<string, string>>(initial.settings)

  function setValue(key: string, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <div className="mx-auto flex h-full w-full max-w-4xl gap-8">
      <WorkflowSubNav
        items={SUB_NAV_ITEMS}
        value={activeSubNav}
        onValueChange={setActiveSubNav}
        className="w-44"
      />

      <div className="h-full min-w-0 flex-1 overflow-y-auto">
        {activeSubNav === "Invites" ? (
          <PolicySettingSection
            title="Invites & confirmations"
            description="How the booking request reaches a candidate, and what they get back once they book"
            settings={INVITE_SETTINGS}
            values={values}
            onValueChange={setValue}
          />
        ) : activeSubNav === "Reminders" ? (
          <PolicySettingSection
            title="Reminders"
            description="Chasing an unbooked link, and the run-up to a booked interview"
            settings={REMINDER_SETTINGS}
            values={values}
            onValueChange={setValue}
          />
        ) : (
          <PolicySettingSection
            title="Interviewer prep"
            description="What interviewers get before the interview, and when they're chased for feedback"
            settings={INTERVIEWER_PREP_SETTINGS}
            values={values}
            onValueChange={setValue}
          />
        )}
      </div>
    </div>
  )
}
