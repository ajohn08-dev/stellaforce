"use client"

import * as React from "react"
import { Info, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
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

type TargetCompany = { name: string; source: "extracted" | "ai_suggested" | "recruiter" }

/** Initial values loaded from the draft job (intake + AI "generate-role" webhook). */
export type RoleInitialValues = {
  title?: string | null
  workplace_type?: "on-site" | "hybrid" | "remote" | null
  office_location?: string | null
  description?: string | null
  company?: string | null
  industry?: string | null
  job_function?: string | null
  employment_type?: string | null
  experience_required?: string | null
  education_required?: string | null
  salary_from?: number | null
  salary_to?: number | null
  salary_currency?: string | null
  target_companies?: TargetCompany[]
}

/** DB workplace_type ("on-site") → the step's radio value ("onsite"). */
function toWorkplace(v: RoleInitialValues["workplace_type"]): Workplace {
  if (v === "hybrid") return "hybrid"
  if (v === "remote") return "remote"
  return "onsite"
}

/**
 * Role Definition step — controlled + pre-filled from the draft job's persisted
 * values (title/description from intake; the rest from the AI generate-role
 * webhook; target companies from job_target_companies). Edits are local for now;
 * saving on publish is a later pass.
 */
export function RoleDefinitionStep({ initial }: { initial?: RoleInitialValues }) {
  const [title, setTitle] = React.useState(initial?.title ?? "")
  const [workplace, setWorkplace] = React.useState<Workplace>(toWorkplace(initial?.workplace_type))
  const [officeLocation, setOfficeLocation] = React.useState(initial?.office_location ?? "")
  const [description, setDescription] = React.useState(initial?.description ?? "")
  const [company, setCompany] = React.useState(initial?.company ?? "")
  const [industry, setIndustry] = React.useState(initial?.industry ?? "")
  const [jobFunction, setJobFunction] = React.useState(initial?.job_function ?? "")
  const [employmentType, setEmploymentType] = React.useState(initial?.employment_type ?? "")
  const [experience, setExperience] = React.useState(initial?.experience_required ?? "")
  const [education, setEducation] = React.useState(initial?.education_required ?? "")
  const [salaryFrom, setSalaryFrom] = React.useState(
    initial?.salary_from != null ? String(initial.salary_from) : ""
  )
  const [salaryTo, setSalaryTo] = React.useState(
    initial?.salary_to != null ? String(initial.salary_to) : ""
  )
  const [currency, setCurrency] = React.useState(initial?.salary_currency ?? "USD")

  const showOfficeLocation = workplace !== "remote"

  const [targetCompanies, setTargetCompanies] = React.useState<TargetCompany[]>(
    initial?.target_companies ?? []
  )
  const [newCompany, setNewCompany] = React.useState("")

  function addCompany() {
    const name = newCompany.trim()
    if (!name) return
    if (targetCompanies.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
      setNewCompany("")
      return
    }
    setTargetCompanies((prev) => [...prev, { name, source: "recruiter" }])
    setNewCompany("")
  }

  function removeCompany(name: string) {
    setTargetCompanies((prev) => prev.filter((c) => c.name !== name))
  }

  return (
    <TooltipProvider>
      <div className="flex flex-col gap-4">
        <FormSection title="Job Details">
          <Field label="Job title">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Senior Product Designer"
            />
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
              <Input
                value={officeLocation}
                onChange={(e) => setOfficeLocation(e.target.value)}
                placeholder="e.g. 123 Market St, San Francisco, CA"
              />
            </Field>
          )}
        </FormSection>

        <FormSection title="Job Description">
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Paste the job description here…"
            className="min-h-96"
          />
        </FormSection>

        <FormSection title="Employment Details">
          <FieldRow>
            <Field label="Company">
              <Input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="e.g. Stellaforce" />
            </Field>
            <Field label="Industry">
              <Input value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder="e.g. Software" />
            </Field>
          </FieldRow>
          <FieldRow>
            <Field label="Job function">
              <Input value={jobFunction} onChange={(e) => setJobFunction(e.target.value)} placeholder="e.g. Product Design" />
            </Field>
            <Field label="Employment type">
              <Input value={employmentType} onChange={(e) => setEmploymentType(e.target.value)} placeholder="e.g. full-time" />
            </Field>
          </FieldRow>
          <FieldRow>
            <Field label="Experience">
              <Input value={experience} onChange={(e) => setExperience(e.target.value)} placeholder="e.g. 5+ years" />
            </Field>
            <Field label="Education">
              <Input value={education} onChange={(e) => setEducation(e.target.value)} placeholder="e.g. Bachelor's degree" />
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
              <Input
                type="number"
                value={salaryFrom}
                onChange={(e) => setSalaryFrom(e.target.value)}
                placeholder="e.g. 120000"
              />
            </Field>
            <Field label="To">
              <Input
                type="number"
                value={salaryTo}
                onChange={(e) => setSalaryTo(e.target.value)}
                placeholder="e.g. 150000"
              />
            </Field>
          </FieldRow>
          <FieldRow>
            <Field label="Currency">
              <Select value={currency} onValueChange={(v) => v && setCurrency(v)}>
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

        <FormSection title="Target Companies">
          <p className="-mt-1 text-sm text-muted-foreground">
            Companies to source candidates from — pulled from your notes or suggested by AI
            (similar companies in this space). Add your own too.
          </p>
          <div className="flex gap-2">
            <Input
              value={newCompany}
              onChange={(e) => setNewCompany(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  addCompany()
                }
              }}
              placeholder="e.g. Ashby, Greenhouse, Gem…"
            />
            <Button type="button" variant="outline" onClick={addCompany}>
              Add
            </Button>
          </div>
          {targetCompanies.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {targetCompanies.map((c) => (
                <span
                  key={c.name}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary py-1 pr-1.5 pl-3 text-sm"
                >
                  {c.name}
                  <button
                    type="button"
                    aria-label={`Remove ${c.name}`}
                    onClick={() => removeCompany(c.name)}
                    className="rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <X className="size-3.5" />
                  </button>
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No target companies yet.</p>
          )}
        </FormSection>
      </div>
    </TooltipProvider>
  )
}
