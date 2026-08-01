"use client"

import * as React from "react"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  MOCK_WORKFLOW_CLIENTS,
  MOCK_WORKFLOW_DEPARTMENTS,
  type MockWorkflow,
} from "@/lib/mock-workflows"
import { updateWorkflowTemplate } from "@/app/(app)/workflows/actions"
import { useWorkflowEditTab, type TabSaveResult } from "@/components/workflows/workflow-edit-provider"
import type { EmploymentType } from "@/lib/supabase/types"

const NO_CLIENT_VALUE = "__none__"

const HIRING_TYPE_OPTIONS = [
  "full-time",
  "part-time",
  "contract",
  "freelance",
  "internship",
] as const

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  )
}

/**
 * Name/Description/Department/Hiring Type save via `updateWorkflowTemplate`
 * (see the workflow-edit save/dirty wiring below). Client stays an unwired
 * placeholder — `updateWorkflowTemplate` has no `client_id` field yet, and
 * the dropdown's options are hardcoded mock company names
 * (`MOCK_WORKFLOW_CLIENTS`), not real `clients.client_id` rows — so there's
 * nowhere real for a change here to go yet.
 */
export function WorkflowBasicTab({ workflow }: { workflow: MockWorkflow }) {
  const [name, setName] = React.useState(workflow.name)
  const [description, setDescription] = React.useState(workflow.description)
  const [client, setClient] = React.useState(workflow.client_name ?? NO_CLIENT_VALUE)
  const [department, setDepartment] = React.useState(workflow.department)
  const [hiringType, setHiringType] = React.useState<string | undefined>(undefined)

  const [baseline, setBaseline] = React.useState({
    name: workflow.name,
    description: workflow.description,
    department: workflow.department,
    hiringType: undefined as string | undefined,
  })

  const isDirty =
    name !== baseline.name ||
    description !== baseline.description ||
    department !== baseline.department ||
    hiringType !== baseline.hiringType

  const save = React.useCallback(async (): Promise<TabSaveResult> => {
    const res = await updateWorkflowTemplate(workflow.workflow_id, {
      name: name.trim(),
      description,
      department,
      hiring_type: (hiringType as EmploymentType | undefined) ?? null,
    })
    if (!res.ok) return res
    setBaseline({ name, description, department, hiringType })
    return { ok: true }
  }, [workflow.workflow_id, name, description, department, hiringType])

  useWorkflowEditTab("basic", isDirty, save)

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
      <Field label="Workflow Name">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Default Main"
        />
      </Field>

      <div className="flex max-w-xl flex-col gap-1.5">
        <Field label="Description">
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Placeholder"
          />
        </Field>
        <p className="text-sm text-muted-foreground">This is an input description.</p>
      </div>

      <Field label="Client">
        <Select value={client} onValueChange={(value) => value && setClient(value)}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_CLIENT_VALUE}>No client</SelectItem>
            {MOCK_WORKFLOW_CLIENTS.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field label="Department">
        <Select
          value={department}
          onValueChange={(value) => value && setDepartment(value)}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MOCK_WORKFLOW_DEPARTMENTS.map((d) => (
              <SelectItem key={d} value={d}>
                {d}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field label="Hiring Type">
        <Select
          value={hiringType}
          onValueChange={(value) => setHiringType(value ?? undefined)}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select Hiring Type" />
          </SelectTrigger>
          <SelectContent>
            {HIRING_TYPE_OPTIONS.map((type) => (
              <SelectItem key={type} value={type}>
                {type}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
    </div>
  )
}
