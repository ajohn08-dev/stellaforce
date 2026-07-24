"use client"

import * as React from "react"

import { Label } from "@/components/ui/label"
import { RadioCardGroup } from "@/components/workflows/radio-card-group"

type SchedulingPolicy = "recruiter_led" | "candidate_self_scheduling" | "system_auto_schedule"

const SCHEDULING_POLICY_OPTIONS: {
  value: SchedulingPolicy
  label: string
  description: string
}[] = [
  {
    value: "recruiter_led",
    label: "Recruiter-Led",
    description: "A recruiter (or coordinator) manually schedules the interview on behalf of everyone involved.",
  },
  {
    value: "candidate_self_scheduling",
    label: "Candidate Self-Scheduling",
    description:
      "System generates slots (or uses interviewer-provided slots). Candidate chooses slot. Most scalable, preferred globally",
  },
  {
    value: "system_auto_schedule",
    label: "System auto schedule",
    description:
      "System asks interviewer to select 2–5 available windows. Then sends those slots to candidate. Good for busy teams or senior/executive interviews",
  },
]

/** Fields are unwired placeholders — not yet saved anywhere. */
export function WorkflowSchedulingPolicyTab() {
  const [schedulingPolicy, setSchedulingPolicy] = React.useState<SchedulingPolicy>(
    "candidate_self_scheduling"
  )

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
      <div className="flex flex-col gap-2">
        <div className="flex flex-col gap-0.5">
          <Label>Scheduling Policy</Label>
          <p className="text-sm text-muted-foreground">
            Define how the interviews need to be scheduled
          </p>
        </div>
        <RadioCardGroup
          value={schedulingPolicy}
          onValueChange={setSchedulingPolicy}
          options={SCHEDULING_POLICY_OPTIONS}
        />
      </div>

      <div className="flex flex-col gap-0.5">
        <Label>Rescheduling Policy</Label>
        <p className="text-sm text-muted-foreground">
          Define how the interviews need to be scheduled
        </p>
      </div>
    </div>
  )
}
