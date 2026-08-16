"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight, Plus, X } from "lucide-react"
import { toast } from "sonner"

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
import { SCALE_LABEL, SCALE_OPTIONS, type SubStageScale } from "@/lib/mock-workflows"
import type { JobWorkflowSubStageWithLinks } from "@/lib/data"
import {
  addJobSubStageCompetency,
  addJobSubStageReviewer,
  removeJobSubStageCompetency,
  removeJobSubStageReviewer,
  selectJobWorkflowTemplate,
  updateJobWorkflowSubStage,
} from "@/app/(app)/jobs/actions"

type StageType = "source" | "screen" | "interview" | "offer" | "close"
type InterviewFormat = "phone" | "video" | "onsite" | "async"
type DecisionMode = "single_rater" | "multi_rater"
type InterviewerType = "human" | "ai" | "external"

const STAGE_TYPE_LABEL: Record<StageType, string> = {
  source: "Source",
  screen: "Screen",
  interview: "Interview",
  offer: "Offer",
  close: "Close",
}

const FORMAT_LABEL: Record<InterviewFormat, string> = {
  phone: "Phone",
  video: "Video",
  onsite: "Onsite",
  async: "Async",
}

const DECISION_MODE_LABEL: Record<DecisionMode, string> = {
  single_rater: "Single rater",
  multi_rater: "Multi-rater (panel)",
}

const INTERVIEWER_TYPE_LABEL: Record<InterviewerType, string> = {
  human: "Human",
  ai: "AI agent",
  external: "External",
}

/**
 * The stage's mechanics (name/type/purpose/duration/format/scale) are frozen
 * from whichever workflow template was selected — read-only here. Only the
 * job-specific fields below (competencies, reviewers, questions, outcomes,
 * approval) are actually filled in during the draft.
 */
type WorkflowStage = {
  id: string
  name: string
  type: StageType
  purpose: string
  durationMinutes: number | null
  format: InterviewFormat | null
  scale: SubStageScale | null
  decisionMode: DecisionMode
  interviewerType: InterviewerType
  hireRecommendationEnabled: boolean
  requiredQuestions: string | null
  ownerMemberId: string | null
  templateOwnerRole: string | null
  templateCollaboratorRole: string | null
  competencyIds: string[]
  reviewerIds: string[]
  questions: string
  needsFinalApproval: boolean
}

/** Sourced/Offer/Close are never evaluative and always show an empty
 * Interview Focus panel — default to the first Screen/Interview stage
 * instead so the recruiter immediately sees the auto-filled competencies
 * rather than landing on a stage that's correctly empty by design. */
function defaultSelectedStageId(stages: WorkflowStage[]): string | undefined {
  return (
    stages.find((s) => s.type === "screen" || s.type === "interview")?.id ??
    stages[0]?.id
  )
}

/** Mirrors publishJob's mandatory check: every Screen/Interview stage needs
 * at least one competency, and enough reviewers to run its decision (2+ for
 * a multi-rater panel stage, 1+ otherwise). Non-evaluative stages are always
 * "complete" — there's nothing to fill in for Sourced/Offer/Close. */
function isStageComplete(stage: WorkflowStage): boolean {
  if (stage.type !== "screen" && stage.type !== "interview") return true
  const requiredReviewers = stage.decisionMode === "multi_rater" ? 2 : 1
  return stage.competencyIds.length > 0 && stage.reviewerIds.length >= requiredReviewers
}

function stageFromRow(row: JobWorkflowSubStageWithLinks): WorkflowStage {
  return {
    id: row.id,
    name: row.name,
    type: (row.pipeline_stage?.key ?? "screen") as StageType,
    purpose: row.purpose ?? "",
    durationMinutes: row.duration_minutes,
    format: row.format as InterviewFormat | null,
    scale: row.rating_scale,
    decisionMode: row.decision_mode,
    interviewerType: row.interviewer_type,
    hireRecommendationEnabled: row.hire_recommendation_enabled,
    requiredQuestions: row.required_questions,
    ownerMemberId: row.owner_member_id,
    templateOwnerRole: row.owner_role,
    templateCollaboratorRole: row.collaborator_role,
    competencyIds: row.competency_ids,
    reviewerIds: row.reviewer_ids,
    questions: row.questions ?? "",
    needsFinalApproval: row.needs_final_approval,
  }
}

/**
 * Stage chips across the top select which pipeline stage's config shows
 * below. Stage Info reflects the selected workflow template's real,
 * snapshotted sub-stages and is read-only here; Interview Focus is where the
 * job-specific evaluation setup (competencies, reviewers, questions,
 * outcomes) is filled in, sourced from Evaluation Criteria and Team Members.
 */
export function WorkflowStep({
  jobId,
  label,
  description,
  competencies,
  members,
  templates,
  selectedTemplateId,
  onSelectTemplate,
  subStagesInitial,
  templateLocked = false,
}: {
  jobId: string
  label: string
  description: string
  competencies: Competency[]
  members: Member[]
  templates: { id: string; name: string; status: string }[]
  selectedTemplateId?: string
  onSelectTemplate: (id: string) => void
  subStagesInitial: JobWorkflowSubStageWithLinks[]
  /** True once a candidate is in this job's pipeline — replacing the
   * template would delete job_workflow_sub_stages rows their application
   * already points at, so the picker locks instead of being hidden. */
  templateLocked?: boolean
}) {
  const [stages, setStages] = React.useState<WorkflowStage[]>(() =>
    subStagesInitial.map(stageFromRow)
  )
  const [selectedStageId, setSelectedStageId] = React.useState(() =>
    defaultSelectedStageId(subStagesInitial.map(stageFromRow))
  )
  const [loadingTemplate, setLoadingTemplate] = React.useState(false)

  const selectedStage = stages.find((s) => s.id === selectedStageId) ?? null

  async function selectWorkflowTemplate(templateId: string | null) {
    if (!templateId) return
    onSelectTemplate(templateId)
    setLoadingTemplate(true)
    const res = await selectJobWorkflowTemplate(jobId, templateId)
    setLoadingTemplate(false)
    if (!res.ok) {
      toast.error(res.error)
      return
    }
    const nextStages = res.subStages.map(stageFromRow)
    setStages(nextStages)
    setSelectedStageId(defaultSelectedStageId(nextStages))
  }

  function updateStage(id: string, updater: (stage: WorkflowStage) => WorkflowStage) {
    setStages((prev) => prev.map((s) => (s.id === id ? updater(s) : s)))
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">{label}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
        <Field label="Workflow Template" className="w-64 shrink-0">
          <Select
            value={selectedTemplateId}
            onValueChange={selectWorkflowTemplate}
            disabled={templateLocked}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select a workflow template">
                {(id: string) => {
                  const t = templates.find((x) => x.id === id)
                  if (!t) return id
                  return `${t.name}${t.status === "draft" ? " (draft)" : ""}`
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {templates.length === 0 && (
                <div className="px-2 py-1.5 text-sm text-muted-foreground">
                  No templates yet — create one in Workflows.
                </div>
              )}
              {templates.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                  {t.status === "draft" ? " (draft)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {templateLocked && (
            <p className="text-xs text-muted-foreground">
              Locked — a candidate is already in this job&apos;s pipeline.
            </p>
          )}
        </Field>
      </div>

      {loadingTemplate ? (
        <p className="text-sm text-muted-foreground">Loading stages…</p>
      ) : stages.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Select a workflow template above to configure its stages.
        </p>
      ) : (
        <>
          <StageChipRow
            stages={stages}
            selectedStageId={selectedStageId}
            onSelect={setSelectedStageId}
          />

          {selectedStage && (
            <StageConfigForm
              key={selectedStage.id}
              jobId={jobId}
              stage={selectedStage}
              competencies={competencies}
              members={members}
              onChange={(updater) => updateStage(selectedStage.id, updater)}
            />
          )}
        </>
      )}
    </div>
  )
}

const STAGE_SCROLL_STEP = 240

/** Stage chips never wrap — a template's real stage count can run long, so
 * they scroll horizontally instead, with chevrons that only render when
 * there's more to scroll to (mirrors JobWorkspaceTabs' tab scroller). */
function StageChipRow({
  stages,
  selectedStageId,
  onSelect,
}: {
  stages: WorkflowStage[]
  selectedStageId: string | undefined
  onSelect: (id: string) => void
}) {
  const scrollerRef = React.useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = React.useState(false)
  const [canScrollRight, setCanScrollRight] = React.useState(false)

  const updateScrollState = React.useCallback(() => {
    const el = scrollerRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 0)
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1)
  }, [])

  React.useEffect(() => {
    updateScrollState()
    const el = scrollerRef.current
    if (!el) return
    const observer = new ResizeObserver(updateScrollState)
    observer.observe(el)
    el.addEventListener("scroll", updateScrollState)
    return () => {
      observer.disconnect()
      el.removeEventListener("scroll", updateScrollState)
    }
  }, [updateScrollState, stages])

  function scrollBy(delta: number) {
    scrollerRef.current?.scrollBy({ left: delta, behavior: "smooth" })
  }

  return (
    <div className="flex items-center gap-1">
      {canScrollLeft && (
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0"
          aria-label="Scroll stages left"
          onClick={() => scrollBy(-STAGE_SCROLL_STEP)}
        >
          <ChevronLeft className="size-4" />
        </Button>
      )}

      <div
        ref={scrollerRef}
        className="no-scrollbar flex min-w-0 flex-nowrap items-center gap-2 overflow-x-auto"
      >
        {stages.map((stage) => (
          <button
            key={stage.id}
            type="button"
            onClick={() => onSelect(stage.id)}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors",
              stage.id === selectedStageId
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-white text-foreground hover:bg-muted"
            )}
          >
            {stage.name}
            {!isStageComplete(stage) && (
              <span
                aria-label="Missing required competencies or reviewers"
                title="Missing required competencies or reviewers"
                className="size-1.5 shrink-0 rounded-full bg-destructive"
              />
            )}
          </button>
        ))}
      </div>

      {canScrollRight && (
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0"
          aria-label="Scroll stages right"
          onClick={() => scrollBy(STAGE_SCROLL_STEP)}
        >
          <ChevronRight className="size-4" />
        </Button>
      )}
    </div>
  )
}

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-lg border border-border bg-white p-6">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
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
  required,
  hint,
  items,
  selectedIds,
  getLabel,
  onAdd,
  onRemove,
}: {
  label: string
  required?: boolean
  /** Read-only role-label suggestion carried over from the workflow
   * template (e.g. collaborator_role) — context only, not enforced. */
  hint?: string | null
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
        <Label>
          {label}
          {required && (
            <span className="text-destructive" aria-hidden="true">
              {" "}
              *
            </span>
          )}
        </Label>
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
      {hint && <p className="text-xs text-muted-foreground">Template suggests: {hint}</p>}

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

/** Stage owner is a single real person for this job (unlike Reviewers, which
 * is many) — the template only carries a free-text owner_role label with no
 * reliable mapping to an actual person, so this is always assigned
 * explicitly per job, never auto-suggested. */
function StageOwnerPicker({
  members,
  ownerMemberId,
  hint,
  onChange,
}: {
  members: Member[]
  ownerMemberId: string | null
  /** Read-only role-label suggestion carried over from the workflow
   * template (owner_role) — context only, not enforced. */
  hint?: string | null
  onChange: (memberId: string | null) => void
}) {
  const owner = members.find((m) => m.id === ownerMemberId) ?? null

  return (
    <div className="flex flex-col gap-1.5">
      <Label>Stage Owner</Label>
      {hint && <p className="text-xs text-muted-foreground">Template suggests: {hint}</p>}
      {owner ? (
        <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-secondary py-1 pr-1.5 pl-3 text-sm text-secondary-foreground">
          {owner.name}
          <button
            type="button"
            aria-label={`Remove ${owner.name} as stage owner`}
            onClick={() => onChange(null)}
            className="rounded-full p-0.5 text-muted-foreground hover:bg-background hover:text-foreground"
          >
            <X className="size-3.5" />
          </button>
        </span>
      ) : members.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Add team members in the previous step to assign a stage owner.
        </p>
      ) : (
        <Select onValueChange={(value) => onChange(value as string)}>
          <SelectTrigger className="w-56">
            <SelectValue placeholder="Select stage owner" />
          </SelectTrigger>
          <SelectContent>
            {members.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  )
}

function StageConfigForm({
  jobId,
  stage,
  competencies,
  members,
  onChange,
}: {
  jobId: string
  stage: WorkflowStage
  competencies: Competency[]
  members: Member[]
  onChange: (updater: (stage: WorkflowStage) => WorkflowStage) => void
}) {
  const [questionsDraft, setQuestionsDraft] = React.useState(stage.questions)
  const isEvaluative = stage.type === "screen" || stage.type === "interview"

  async function addCompetency(competencyId: string) {
    const res = await addJobSubStageCompetency(stage.id, competencyId)
    if (!res.ok) {
      toast.error(res.error)
      return
    }
    onChange((s) => ({ ...s, competencyIds: [...s.competencyIds, competencyId] }))
  }

  async function removeCompetency(competencyId: string) {
    const res = await removeJobSubStageCompetency(stage.id, competencyId)
    if (!res.ok) {
      toast.error(res.error)
      return
    }
    onChange((s) => ({
      ...s,
      competencyIds: s.competencyIds.filter((x) => x !== competencyId),
    }))
  }

  async function addReviewer(memberId: string) {
    const res = await addJobSubStageReviewer(stage.id, memberId)
    if (!res.ok) {
      toast.error(res.error)
      return
    }
    onChange((s) => ({ ...s, reviewerIds: [...s.reviewerIds, memberId] }))
  }

  async function removeReviewer(memberId: string) {
    const res = await removeJobSubStageReviewer(stage.id, memberId)
    if (!res.ok) {
      toast.error(res.error)
      return
    }
    onChange((s) => ({
      ...s,
      reviewerIds: s.reviewerIds.filter((x) => x !== memberId),
    }))
  }

  async function setStageOwner(memberId: string | null) {
    const res = await updateJobWorkflowSubStage(stage.id, { owner_member_id: memberId })
    if (!res.ok) {
      toast.error(res.error)
      return
    }
    onChange((s) => ({ ...s, ownerMemberId: memberId }))
  }

  async function saveQuestions() {
    if (questionsDraft === stage.questions) return
    const res = await updateJobWorkflowSubStage(stage.id, { questions: questionsDraft })
    if (!res.ok) {
      toast.error(res.error)
      return
    }
    onChange((s) => ({ ...s, questions: questionsDraft }))
  }

  async function toggleApproval(checked: boolean) {
    const res = await updateJobWorkflowSubStage(stage.id, {
      needs_final_approval: checked,
    })
    if (!res.ok) {
      toast.error(res.error)
      return
    }
    onChange((s) => ({ ...s, needsFinalApproval: checked }))
  }

  return (
    <div className="flex flex-col gap-4">
      <Section title="Stage Info">
        <FieldRow>
          <Field label="Name">
            <Input value={stage.name} disabled />
          </Field>
          <Field label="Type">
            <Select value={stage.type} disabled>
              <SelectTrigger className="w-full">
                <SelectValue>
                  {(value: StageType) => STAGE_TYPE_LABEL[value] ?? value}
                </SelectValue>
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
            <Input value={stage.durationMinutes ?? ""} placeholder="N/A" disabled />
          </Field>
        </FieldRow>

        <FieldRow>
          <Field label="Format">
            <Select value={stage.format ?? undefined} disabled>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="N/A">
                  {(value: InterviewFormat) => FORMAT_LABEL[value] ?? value}
                </SelectValue>
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
          <Field label="Interviewer Type">
            <Input value={INTERVIEWER_TYPE_LABEL[stage.interviewerType]} disabled />
          </Field>
        </FieldRow>

        {isEvaluative && (
          <FieldRow>
            <Field label="Decision Mode">
              <Input value={DECISION_MODE_LABEL[stage.decisionMode]} disabled />
            </Field>
            <div />
          </FieldRow>
        )}

        {stage.hireRecommendationEnabled && (
          <p className="inline-flex w-fit items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
            Hire recommendation stage
          </p>
        )}
      </Section>

      <Section title="Interview Focus">
        {isEvaluative && (
          <>
            <EntityChipPicker
              label="Competencies evaluated"
              required
              items={competencies}
              selectedIds={stage.competencyIds}
              getLabel={(c) => c.description}
              onAdd={addCompetency}
              onRemove={removeCompetency}
            />

            <div>
              <EntityChipPicker
                label={stage.decisionMode === "multi_rater" ? "Reviewers (2 required)" : "Reviewers"}
                required
                hint={stage.templateCollaboratorRole}
                items={members}
                selectedIds={stage.reviewerIds}
                getLabel={(m) => m.name}
                onAdd={addReviewer}
                onRemove={removeReviewer}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Who evaluates and scores candidates at this stage.
              </p>
            </div>
            {stage.decisionMode === "multi_rater" && stage.reviewerIds.length < 2 && (
              <p className="-mt-2 text-xs text-destructive">
                This is a panel stage — assign at least 2 reviewers.
              </p>
            )}
          </>
        )}

        <div>
          <StageOwnerPicker
            members={members}
            ownerMemberId={stage.ownerMemberId}
            hint={stage.templateOwnerRole}
            onChange={setStageOwner}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Who&apos;s accountable for this stage — can also be a reviewer.
          </p>
        </div>

        {isEvaluative && (
          <>
            {stage.requiredQuestions && (
              <Field label="Required questions (from template)">
                <Textarea value={stage.requiredQuestions} disabled className="min-h-20" />
              </Field>
            )}

            <Field label="Questions">
              <Textarea
                value={questionsDraft}
                onChange={(e) => setQuestionsDraft(e.target.value)}
                onBlur={saveQuestions}
                placeholder="What will be asked in this stage…"
                className="min-h-32"
              />
            </Field>

            <Field label="Scale">
              <Select value={stage.scale ?? undefined} disabled>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Set by the selected workflow template">
                    {(value: SubStageScale) => SCALE_LABEL[value] ?? value}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {SCALE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </>
        )}

        <CheckboxField
          id={`${jobId}-${stage.id}-approval`}
          label="Needs final approval"
          checked={stage.needsFinalApproval}
          onCheckedChange={toggleApproval}
        />
      </Section>
    </div>
  )
}
