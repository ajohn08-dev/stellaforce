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
import { MOCK_WORKFLOW_DEPARTMENTS, type MockWorkflow } from "@/lib/mock-workflows"

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
    <div className="flex max-w-xl flex-col gap-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  )
}

/** Fields are unwired placeholders, prefilled from the mock workflow — not yet saved anywhere. */
export function WorkflowBasicTab({ workflow }: { workflow: MockWorkflow }) {
  const [name, setName] = React.useState(workflow.name)
  const [description, setDescription] = React.useState(workflow.description)
  const [department, setDepartment] = React.useState(workflow.department)
  const [hiringType, setHiringType] = React.useState<string | undefined>(undefined)

  return (
    <div className="flex flex-col gap-6">
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
