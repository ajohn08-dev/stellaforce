"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { CANDIDATE_TIERS, titleCase } from "@/lib/constants"
import {
  addCandidate,
  createCandidateFromParsed,
  parseCandidate,
} from "@/app/(app)/candidates/actions"
import type { ParsedCandidate } from "@/lib/ai/parse"

type Mode = "manual" | "ingest"

export function NewCandidate() {
  const [mode, setMode] = React.useState<Mode>("manual")
  return (
    <div className="space-y-6">
      <div className="inline-flex rounded-lg border border-border p-1">
        <ModeButton active={mode === "manual"} onClick={() => setMode("manual")}>
          Manual entry
        </ModeButton>
        <ModeButton active={mode === "ingest"} onClick={() => setMode("ingest")}>
          AI ingestion
        </ModeButton>
      </div>
      {mode === "manual" ? <ManualForm /> : <IngestFlow />}
    </div>
  )
}

function ModeButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "px-4 py-1.5 rounded-md text-sm transition-colors",
        active
          ? "bg-muted text-foreground font-medium"
          : "text-muted-foreground hover:text-foreground"
      )}
    >
      {children}
    </button>
  )
}

// ── Workflow 1: manual entry (native form → Server Action) ───────────────────
function ManualForm() {
  return (
    <form action={addCandidate} className="space-y-4 max-w-2xl">
      <p className="text-sm text-muted-foreground">
        Writes a candidate with{" "}
        <code className="font-mono">data_provenance = recruiter_confirmed</code>.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField name="full_name" label="Full name *" required />
        <TextField name="email" label="Email" type="email" />
        <TextField name="phone" label="Phone" />
        <TextField name="location" label="Location" />
        <TextField name="tz" label="Timezone" placeholder="e.g. America/New_York" />
        <TextField name="current_title" label="Current title" />
        <TextField name="current_company" label="Current company" />
        <TextField name="years_experience" label="Years experience" type="number" />
        <div className="grid gap-1.5">
          <Label htmlFor="candidate_tier">Tier</Label>
          <select
            id="candidate_tier"
            name="candidate_tier"
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            defaultValue=""
          >
            <option value="">—</option>
            {CANDIDATE_TIERS.map((t) => (
              <option key={t} value={t}>
                {titleCase(t)}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="professional_summary">Professional summary</Label>
        <Textarea
          id="professional_summary"
          name="professional_summary"
          className="min-h-24"
        />
      </div>
      <Button type="submit">Save candidate</Button>
    </form>
  )
}

// ── Workflow 2: AI ingestion (paste → parse → edit → confirm) ────────────────
function IngestFlow() {
  const router = useRouter()
  const [rawText, setRawText] = React.useState("")
  const [parsed, setParsed] = React.useState<ParsedCandidate | null>(null)
  const [parsing, startParse] = React.useTransition()
  const [saving, startSave] = React.useTransition()

  function handleParse() {
    startParse(async () => {
      const res = await parseCandidate(rawText)
      if (res.ok) {
        setParsed(res.data)
        toast.success("Parsed. Review and confirm below.")
      } else {
        toast.error(res.error)
      }
    })
  }

  function handleConfirm() {
    if (!parsed) return
    startSave(async () => {
      const res = await createCandidateFromParsed(parsed)
      if (res.ok) {
        toast.success("Candidate saved.")
        router.push(res.id ? `/candidates/${res.id}` : "/candidates")
      } else {
        toast.error(res.error)
      }
    })
  }

  if (!parsed) {
    return (
      <div className="space-y-4 max-w-2xl">
        <p className="text-sm text-muted-foreground">
          Paste raw text (résumé, LinkedIn export, notes). Claude extracts a draft
          profile (<code className="font-mono">data_provenance = ai_parsed</code>)
          that you review and confirm before saving.
        </p>
        <Textarea
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
          placeholder="Paste candidate text here…"
          className="min-h-56"
        />
        <Button onClick={handleParse} disabled={parsing || !rawText.trim()}>
          {parsing ? "Parsing…" : "Parse with AI"}
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="flex items-center gap-2">
        <Badge variant="outline">AI draft — review before saving</Badge>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <EditField
          label="Full name *"
          value={parsed.full_name}
          onChange={(v) => setParsed({ ...parsed, full_name: v })}
        />
        <EditField
          label="Email"
          value={parsed.contact_info.email}
          onChange={(v) =>
            setParsed({
              ...parsed,
              contact_info: { ...parsed.contact_info, email: v },
            })
          }
        />
        <EditField
          label="Phone"
          value={parsed.contact_info.phone}
          onChange={(v) =>
            setParsed({
              ...parsed,
              contact_info: { ...parsed.contact_info, phone: v },
            })
          }
        />
        <EditField
          label="Location"
          value={parsed.contact_info.location}
          onChange={(v) =>
            setParsed({
              ...parsed,
              contact_info: { ...parsed.contact_info, location: v },
            })
          }
        />
        <EditField
          label="Current title"
          value={parsed.current_title}
          onChange={(v) => setParsed({ ...parsed, current_title: v })}
        />
        <EditField
          label="Current company"
          value={parsed.current_company}
          onChange={(v) => setParsed({ ...parsed, current_company: v })}
        />
        <EditField
          label="Years experience"
          type="number"
          value={String(parsed.years_experience ?? "")}
          onChange={(v) =>
            setParsed({ ...parsed, years_experience: Number(v) || 0 })
          }
        />
        <div className="grid gap-1.5">
          <Label>Tier</Label>
          <Select
            value={parsed.candidate_tier}
            onValueChange={(v) =>
              setParsed({
                ...parsed,
                candidate_tier: v as ParsedCandidate["candidate_tier"],
              })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CANDIDATE_TIERS.map((t) => (
                <SelectItem key={t} value={t}>
                  {titleCase(t)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-1.5">
        <Label>Professional summary</Label>
        <Textarea
          value={parsed.professional_summary}
          onChange={(e) =>
            setParsed({ ...parsed, professional_summary: e.target.value })
          }
          className="min-h-24"
        />
      </div>

      <div className="grid gap-1.5">
        <Label>Tier rationale</Label>
        <Textarea
          value={parsed.tier_rationale}
          onChange={(e) =>
            setParsed({ ...parsed, tier_rationale: e.target.value })
          }
          className="min-h-16"
        />
      </div>

      <div className="space-y-2">
        <Label>Skills ({parsed.skills.length})</Label>
        <div className="flex flex-wrap gap-2">
          {parsed.skills.map((s, i) => (
            <Badge key={i} variant="secondary" className="gap-1">
              {s.skill_name}
              <button
                type="button"
                aria-label={`Remove ${s.skill_name}`}
                className="ml-1 text-muted-foreground hover:text-foreground"
                onClick={() =>
                  setParsed({
                    ...parsed,
                    skills: parsed.skills.filter((_, j) => j !== i),
                  })
                }
              >
                ×
              </button>
            </Badge>
          ))}
          {parsed.skills.length === 0 && (
            <span className="text-sm text-muted-foreground">
              No skills parsed.
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={handleConfirm} disabled={saving}>
          {saving ? "Saving…" : "Confirm & save"}
        </Button>
        <Button variant="outline" onClick={() => setParsed(null)} disabled={saving}>
          Discard draft
        </Button>
      </div>
    </div>
  )
}

function TextField({
  name,
  label,
  type = "text",
  required,
  placeholder,
}: {
  name: string
  label: string
  type?: string
  required?: boolean
  placeholder?: string
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
      />
    </div>
  )
}

function EditField({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
}) {
  return (
    <div className="grid gap-1.5">
      <Label>{label}</Label>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  )
}
