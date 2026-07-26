"use client"

import * as React from "react"
import { Info } from "lucide-react"

import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

type Workplace = "onsite" | "hybrid" | "remote"

const WORKPLACE_OPTIONS: {
  value: Workplace
  label: string
  description: string
}[] = [
  {
    value: "onsite",
    label: "On-site",
    description: "Work exclusively from the office",
  },
  {
    value: "hybrid",
    label: "Hybrid",
    description: "Work from both the office and home",
  },
  {
    value: "remote",
    label: "Remote",
    description: "Work exclusively from home",
  },
]

const CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD"]

function FormSection({
  title,
  action,
  children,
}: {
  title: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="rounded-lg border border-border bg-white p-6">
      <div className="flex items-center gap-1.5">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {action}
      </div>
      <div className="mt-4 flex flex-col gap-4">{children}</div>
    </div>
  )
}

function Field({
  label,
  className,
  children,
}: {
  label: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label>{label}</Label>
      {children}
    </div>
  )
}

function FieldRow({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-4">{children}</div>
}

/**
 * Role Definition step content. Fields are unwired placeholders for now —
 * once ingestion is connected, most of these will be pre-populated from the
 * parsed job description rather than typed by hand.
 */
export function RoleDefinitionStep() {
  const [workplace, setWorkplace] = React.useState<Workplace>("onsite")
  const showOfficeLocation = workplace !== "remote"

  return (
    <TooltipProvider>
      <div className="flex flex-col gap-4">
        <FormSection title="Job Details">
          <Field label="Job title">
            <Input placeholder="e.g. Senior Product Designer" />
          </Field>

          <div className="flex flex-col gap-2">
            <Label>Workplace</Label>
            <RadioGroup
              value={workplace}
              onValueChange={(value) => setWorkplace(value as Workplace)}
              className="flex-row gap-3"
            >
              {WORKPLACE_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className="flex flex-1 cursor-pointer items-start gap-2.5"
                >
                  <RadioGroupItem value={option.value} className="mt-0.5" />
                  <span className="flex flex-col">
                    <span className="text-sm font-medium text-foreground">
                      {option.label}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {option.description}
                    </span>
                  </span>
                </label>
              ))}
            </RadioGroup>
          </div>

          {showOfficeLocation && (
            <Field label="Office location">
              <Input placeholder="e.g. 123 Market St, San Francisco, CA" />
            </Field>
          )}
        </FormSection>

        <FormSection title="Job Description">
          <Textarea
            placeholder="Paste the job description here…"
            className="min-h-96"
          />
        </FormSection>

        <FormSection title="Employment Details">
          <FieldRow>
            <Field label="Company">
              <Input placeholder="e.g. Stellaforce" />
            </Field>
            <Field label="Industry">
              <Input placeholder="e.g. Software" />
            </Field>
          </FieldRow>
          <FieldRow>
            <Field label="Job function">
              <Input placeholder="e.g. Product Design" />
            </Field>
            <Field label="Employment type">
              <Input placeholder="e.g. Full-time" />
            </Field>
          </FieldRow>
          <FieldRow>
            <Field label="Experience">
              <Input placeholder="e.g. 5+ years" />
            </Field>
            <Field label="Education">
              <Input placeholder="e.g. Bachelor's degree" />
            </Field>
          </FieldRow>
        </FormSection>

        <FormSection
          title="Annual Salary"
          action={
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    aria-label="Salary visibility settings"
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <Info className="size-3.5" />
                  </button>
                }
              />
              <TooltipContent>
                Visibility can be restricted by role in Settings
              </TooltipContent>
            </Tooltip>
          }
        >
          <FieldRow>
            <Field label="From">
              <Input type="number" placeholder="e.g. 120000" />
            </Field>
            <Field label="To">
              <Input type="number" placeholder="e.g. 150000" />
            </Field>
          </FieldRow>
          <FieldRow>
            <Field label="Currency">
              <Select defaultValue="USD">
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((currency) => (
                    <SelectItem key={currency} value={currency}>
                      {currency}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <div />
          </FieldRow>
        </FormSection>
      </div>
    </TooltipProvider>
  )
}
