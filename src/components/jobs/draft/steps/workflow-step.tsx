"use client"

import * as React from "react"
import { Pencil, Plus, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
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
import type { Competency } from "@/components/jobs/draft/steps/competency-data"
import type { Member } from "@/components/jobs/draft/steps/team-member-data"

type StageType = "source" | "screen" | "interview" | "offer"
type InterviewFormat = "phone" | "video" | "onsite" | "async"
type RatingScale = "star" | "ten-point" | "hundred-point"
type Outcome = "advance" | "hold" | "reject" | "remove"

const STAGE_TYPE_LABEL: Record<StageType, string> = {
  source: "Source",
  screen: "Screen",
  interview: "Interview",
  offer: "Offer",
}

const FORMAT_LABEL: Record<InterviewFormat, string> = {
  phone: "Phone",
  video: "Video",
  onsite: "Onsite",
  async: "Async",
}

const RATING_SCALE_LABEL: Record<RatingScale, string> = {
  star: "Star rating",
  "ten-point": "10-point scale",
  "hundred-point": "100-point scale",
}

const OUTCOME_META: { value: Outcome; label: string }[] = [
  { value: "advance", label: "Advance" },
  { value: "hold", label: "Hold" },
  { value: "reject", label: "Reject" },
  { value: "remove", label: "Remove" },
]

type WorkflowStage = {
  id: string
  name: string
  type: StageType
  purpose: string
  durationMinutes: number | ""
  format: InterviewFormat | ""
  competencyIds: string[]
  reviewerIds: string[]
  questions: string
  ratingScale: RatingScale | ""
  allowedOutcomes: Outcome[]
  needsFinalApproval: boolean
}

type StageTemplate = {
  id: string
  name: string
  type: StageType
  purpose: string
  durationMinutes: number | ""
  format: InterviewFormat | ""
}

/**
 * Matches the reference pipeline: Source -> Screen -> HR Screening -> two
 * named interviews -> Assessment -> Executive Interview -> Offer. This is
 * the org's standard workflow template — stage mechanics (name/type/
 * purpose/duration/format) aren't configured per-job here, only the
 * interview-specific evaluation setup below is.
 */
const STAGE_TEMPLATES: StageTemplate[] = [
  {
    id: "source",
    name: "Source",
    type: "source",
    purpose: "Identify and engage potential candidates",
    durationMinutes: "",
    format: "",
  },
  {
    id: "screen",
    name: "Screen",
    type: "screen",
    purpose: "Confirm baseline qualifications and interest",
    durationMinutes: 20,
    format: "phone",
  },
  {
    id: "hr-screening",
    name: "HR Screening",
    type: "screen",
    purpose: "Assess culture fit and logistics",
    durationMinutes: 30,
    format: "phone",
  },
  {
    id: "interview-art",
    name: "Interview w/ Art",
    type: "interview",
    purpose: "Evaluate technical execution",
    durationMinutes: 45,
    format: "video",
  },
  {
    id: "interview-yang",
    name: "Interview w/ Yang",
    type: "interview",
    purpose: "Evaluate technical execution",
    durationMinutes: 45,
    format: "video",
  },
  {
    id: "assessment",
    name: "Assessment",
    type: "interview",
    purpose: "Hands-on skills assessment",
    durationMinutes: 60,
    format: "async",
  },
  {
    id: "executive-interview",
    name: "Executive Interview",
    type: "interview",
    purpose: "Final leadership alignment",
    durationMinutes: 30,
    format: "onsite",
  },
  {
    id: "offer",
    name: "Offer",
    type: "offer",
    purpose: "Extend and negotiate the offer",
    durationMinutes: "",
    format: "",
  },
]

/**
 * Source/Offer aren't evaluative stages, so they don't get competencies or
 * reviewers pre-assigned — every Screen/Interview stage does, from whatever
 * already exists in Evaluation Criteria and Team Members.
 */
function createInitialStages(
  competencies: Competency[],
  members: Member[]
): WorkflowStage[] {
  return STAGE_TEMPLATES.map((template) => {
    const isEvaluative = template.type === "screen" || template.type === "interview"
    return {
      ...template,
      competencyIds: isEvaluative ? competencies.map((c) => c.id) : [],
      reviewerIds: isEvaluative ? members.map((m) => m.id) : [],
      questions: "",
      ratingScale: "",
      allowedOutcomes: ["advance", "hold", "reject"],
      needsFinalApproval: false,
    }
  })
}

function blankStage(id: string, name: string): WorkflowStage {
  return {
    id,
    name,
    type: "interview",
    purpose: "",
    durationMinutes: "",
    format: "",
    competencyIds: [],
    reviewerIds: [],
    questions: "",
    ratingScale: "",
    allowedOutcomes: ["advance", "hold", "reject"],
    needsFinalApproval: false,
  }
}

/**
 * Stage chips across the top select which pipeline stage's config shows
 * below. Stage Info reflects the org's standard workflow template and is
 * read-only here; Interview Focus is where the job-specific evaluation
 * setup (competencies, reviewers, questions, outcomes) is configured,
 * sourced from Evaluation Criteria and Team Members — never free-typed.
 */
export function WorkflowStep({
  competencies,
  members,
}: {
  competencies: Competency[]
  members: Member[]
}) {
  const [workflowName, setWorkflowName] = React.useState("A10 Workflow (Product)")
  const [editingName, setEditingName] = React.useState(false)
  const [nameDraft, setNameDraft] = React.useState(workflowName)

  const [stages, setStages] = React.useState<WorkflowStage[]>(() =>
    createInitialStages(competencies, members)
  )
  const [selectedStageId, setSelectedStageId] = React.useState(
    STAGE_TEMPLATES[0].id
  )

  const [addingStage, setAddingStage] = React.useState(false)
  const [newStageName, setNewStageName] = React.useState("")

  const selectedStage = stages.find((s) => s.id === selectedStageId) ?? null

  function updateStage(
    id: string,
    updater: (stage: WorkflowStage) => WorkflowStage
  ) {
    setStages((prev) => prev.map((s) => (s.id === id ? updater(s) : s)))
  }

  function removeStage(id: string) {
    const remaining = stages.filter((s) => s.id !== id)
    setStages(remaining)
    if (selectedStageId === id) {
      setSelectedStageId(remaining[0]?.id ?? "")
    }
  }

  function commitNewStage() {
    const trimmed = newStageName.trim()
    if (trimmed) {
      const stage = blankStage(crypto.randomUUID(), trimmed)
      setStages((prev) => [...prev, stage])
      setSelectedStageId(stage.id)
    }
    setNewStageName("")
    setAddingStage(false)
  }

  function saveWorkflowName() {
    const trimmed = nameDraft.trim()
    setWorkflowName(trimmed || workflowName)
    setNameDraft(trimmed || workflowName)
    setEditingName(false)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        {editingName ? (
          <Input
            autoFocus
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            onBlur={saveWorkflowName}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                saveWorkflowName()
              } else if (e.key === "Escape") {
                setNameDraft(workflowName)
                setEditingName(false)
              }
            }}
            className="max-w-xs"
          />
        ) : (
          <>
            <span className="text-sm text-foreground">{workflowName}</span>
            <button
              type="button"
              aria-label="Edit workflow name"
              onClick={() => {
                setNameDraft(workflowName)
                setEditingName(true)
              }}
              className="text-muted-foreground hover:text-foreground"
            >
              <Pencil className="size-3.5" />
            </button>
          </>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {stages.map((stage) => (
          <button
            key={stage.id}
            type="button"
            onClick={() => setSelectedStageId(stage.id)}
            className={cn(
              "rounded-md border px-3 py-1.5 text-sm font-medium transition-colors",
              stage.id === selectedStageId
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-white text-foreground hover:bg-muted"
            )}
          >
            {stage.name}
          </button>
        ))}

        {addingStage ? (
          <Input
            autoFocus
            value={newStageName}
            onChange={(e) => setNewStageName(e.target.value)}
            onBlur={commitNewStage}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                commitNewStage()
              } else if (e.key === "Escape") {
                setNewStageName("")
                setAddingStage(false)
              }
            }}
            placeholder="Stage name"
            className="h-8 w-40"
          />
        ) : (
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label="Add stage"
            onClick={() => setAddingStage(true)}
            className="text-muted-foreground hover:text-foreground"
          >
            <Plus />
          </Button>
        )}
      </div>

      {selectedStage && (
        <StageConfigForm
          key={selectedStage.id}
          stage={selectedStage}
          competencies={competencies}
          members={members}
          onChange={(updater) => updateStage(selectedStage.id, updater)}
          onRemove={() => removeStage(selectedStage.id)}
        />
      )}
    </div>
  )
}

function Section({
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
      <div className="flex items-center justify-between gap-2">
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

function CheckboxField({
  id,
  label,
  checked,
  disabled,
  onCheckedChange,
}: {
  id: string
  label: string
  checked: boolean
  disabled?: boolean
  onCheckedChange?: (checked: boolean) => void
}) {
  return (
    <div className="flex items-center gap-2">
      <Checkbox
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={(c) => onCheckedChange?.(!!c)}
      />
      <Label htmlFor={id} className="font-normal">
        {label}
      </Label>
    </div>
  )
}

function EntityChipPicker<T extends { id: string }>({
  label,
  items,
  selectedIds,
  getLabel,
  onAdd,
  onRemove,
}: {
  label: string
  items: T[]
  selectedIds: string[]
  getLabel: (item: T) => string
  onAdd: (id: string) => void
  onRemove: (id: string) => void
}) {
  const selected = items.filter((item) => selectedIds.includes(item.id))
  const available = items.filter((item) => !selectedIds.includes(item.id))
  const [picking, setPicking] = React.useState(false)

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        {available.length > 0 && !picking && (
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={`Add ${label.toLowerCase()}`}
            onClick={() => setPicking(true)}
            className="text-muted-foreground hover:text-foreground"
          >
            <Plus />
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {selected.map((item) => (
          <span
            key={item.id}
            className="inline-flex items-center gap-1.5 rounded-full bg-secondary py-1 pr-1.5 pl-3 text-sm text-secondary-foreground"
          >
            {getLabel(item)}
            <button
              type="button"
              aria-label={`Remove ${getLabel(item)}`}
              onClick={() => onRemove(item.id)}
              className="rounded-full p-0.5 text-muted-foreground hover:bg-background hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          </span>
        ))}

        {selected.length === 0 && !picking && (
          <p className="text-sm text-muted-foreground">None selected.</p>
        )}

        {picking && (
          <Select
            defaultOpen
            onOpenChange={(open) => setPicking(open)}
            onValueChange={(value) => {
              onAdd(value as string)
              setPicking(false)
            }}
          >
            <SelectTrigger className="h-7 w-56">
              <SelectValue placeholder={`Select ${label.toLowerCase()}`} />
            </SelectTrigger>
            <SelectContent>
              {available.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {getLabel(item)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
    </div>
  )
}

function StageConfigForm({
  stage,
  competencies,
  members,
  onChange,
  onRemove,
}: {
  stage: WorkflowStage
  competencies: Competency[]
  members: Member[]
  onChange: (updater: (stage: WorkflowStage) => WorkflowStage) => void
  onRemove: () => void
}) {
  return (
    <div className="flex flex-col gap-4">
      <Section
        title="Stage Info"
        action={
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label="Remove stage"
            onClick={onRemove}
            className="text-muted-foreground hover:text-foreground"
          >
            <X />
          </Button>
        }
      >
        <FieldRow>
          <Field label="Name">
            <Input value={stage.name} disabled />
          </Field>
          <Field label="Type">
            <Select value={stage.type} disabled>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(STAGE_TYPE_LABEL) as StageType[]).map((t) => (
                  <SelectItem key={t} value={t}>
                    {STAGE_TYPE_LABEL[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </FieldRow>

        <FieldRow>
          <Field label="Purpose">
            <Input value={stage.purpose} disabled />
          </Field>
          <Field label="Duration (min)">
            <Input value={stage.durationMinutes} placeholder="N/A" disabled />
          </Field>
        </FieldRow>

        <FieldRow>
          <Field label="Format">
            <Select value={stage.format} disabled>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="N/A" />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(FORMAT_LABEL) as InterviewFormat[]).map((f) => (
                  <SelectItem key={f} value={f}>
                    {FORMAT_LABEL[f]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <div />
        </FieldRow>
      </Section>

      <Section title="Interview Focus">
        <EntityChipPicker
          label="Competencies evaluated"
          items={competencies}
          selectedIds={stage.competencyIds}
          getLabel={(c) => c.description}
          onAdd={(id) =>
            onChange((s) => ({
              ...s,
              competencyIds: [...s.competencyIds, id],
            }))
          }
          onRemove={(id) =>
            onChange((s) => ({
              ...s,
              competencyIds: s.competencyIds.filter((x) => x !== id),
            }))
          }
        />

        <EntityChipPicker
          label="Reviewers"
          items={members}
          selectedIds={stage.reviewerIds}
          getLabel={(m) => m.name}
          onAdd={(id) =>
            onChange((s) => ({ ...s, reviewerIds: [...s.reviewerIds, id] }))
          }
          onRemove={(id) =>
            onChange((s) => ({
              ...s,
              reviewerIds: s.reviewerIds.filter((x) => x !== id),
            }))
          }
        />

        <Field label="Questions">
          <Textarea
            value={stage.questions}
            onChange={(e) =>
              onChange((s) => ({ ...s, questions: e.target.value }))
            }
            placeholder="What will be asked in this stage…"
            className="min-h-32"
          />
        </Field>

        <Field label="Rating scale">
          <Select
            value={stage.ratingScale}
            onValueChange={(value) =>
              onChange((s) => ({ ...s, ratingScale: value as RatingScale }))
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select rating scale" />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(RATING_SCALE_LABEL) as RatingScale[]).map((r) => (
                <SelectItem key={r} value={r}>
                  {RATING_SCALE_LABEL[r]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <CheckboxField
          id={`${stage.id}-notes`}
          label="Notes required"
          checked
          disabled
        />

        <div className="flex flex-col gap-1.5">
          <Label>Allowed outcomes</Label>
          <div className="flex flex-wrap gap-2">
            {OUTCOME_META.map((outcome) => {
              const isOn = stage.allowedOutcomes.includes(outcome.value)
              return (
                <button
                  key={outcome.value}
                  type="button"
                  aria-pressed={isOn}
                  onClick={() =>
                    onChange((s) => ({
                      ...s,
                      allowedOutcomes: isOn
                        ? s.allowedOutcomes.filter((o) => o !== outcome.value)
                        : [...s.allowedOutcomes, outcome.value],
                    }))
                  }
                  className={cn(
                    "rounded-full border px-3 py-1 text-sm font-medium transition-colors",
                    isOn
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:bg-muted"
                  )}
                >
                  {outcome.label}
                </button>
              )
            })}
          </div>
        </div>

        <CheckboxField
          id={`${stage.id}-approval`}
          label="Needs final approval"
          checked={stage.needsFinalApproval}
          onCheckedChange={(checked) =>
            onChange((s) => ({ ...s, needsFinalApproval: checked }))
          }
        />
      </Section>
    </div>
  )
}
