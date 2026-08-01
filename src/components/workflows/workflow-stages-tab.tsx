"use client"

import * as React from "react"
import { ChevronDown, ChevronUp, GripVertical, MoreVertical, Plus } from "lucide-react"

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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Checkbox } from "@/components/ui/checkbox"
import { Switch } from "@/components/ui/switch"
import { RadioCardGroup } from "@/components/workflows/radio-card-group"
import { useScrollbarOnScroll } from "@/lib/use-scrollbar-on-scroll"
import {
  SCALE_OPTIONS,
  type MainStageKey,
  type MockWorkflow,
  type MockWorkflowStage,
  type SubStageScale,
} from "@/lib/mock-workflows"
import {
  saveTemplateSubStages,
  type TemplateSubStageInput,
} from "@/app/(app)/workflows/actions"
import {
  useWorkflowEditTab,
  type TabSaveResult,
} from "@/components/workflows/workflow-edit-provider"
import type { WorkflowTemplateSubStageWithStage } from "@/lib/data"

const MAIN_STAGES: { key: MainStageKey; label: string }[] = [
  { key: "source", label: "Sourced" },
  { key: "screen", label: "Screening" },
  { key: "interview", label: "Interview" },
  { key: "offer", label: "Offer" },
  { key: "close", label: "Close" },
]

type Visibility = "internal" | "candidate_facing"
type EntryCondition = "manual" | "automatic"
type InterviewerType = "human" | "ai" | "external"
type InteractionMode = "phone" | "video" | "in_person" | "async"
type QuestionSource = "manual" | "structured" | "ai_assisted"
type DecisionMode = "single_rater" | "multi_rater"

/** A Tier-2 sub-stage — variable per workflow, grouped under one of the fixed main stages above. */
type SubStage = {
  id: string
  mainStage: MainStageKey
  name: string
  purpose: string
  visibility: Visibility
  owner: string
  collaborator: string
  /** Multi-select — a stage can be entered either manually or automatically, not exclusively one or the other. */
  entryConditions: EntryCondition[]
  interviewerType: InterviewerType
  interactionMode: InteractionMode
  questionSource: QuestionSource
  requiredQuestionsEnabled: boolean
  requiredQuestions: string
  captureFeedbackForm: boolean
  captureTranscript: boolean
  decisionMode: DecisionMode
  decisionOwner: string
  /** Not applicable to the offer stage — see hireRecommendationEnabled instead. */
  decisionScale: SubStageScale
  /** Offer-stage sub-stages capture a hire recommendation instead of a rating scale. */
  hireRecommendationEnabled: boolean
  overrideEnabled: boolean
  overrideRoles: string
}

const OWNER_OPTIONS = ["Recruiter", "Hiring Manager", "Coordinator", "Sourcer"]
const COLLABORATOR_OPTIONS = ["Admin", "Interviewer", "Hiring Manager", "Approver"]

const DECISION_OWNER_OPTIONS = [
  "Stage Owner (Recruiter)",
  "Hiring Manager",
  "Panel Consensus",
]
const OVERRIDE_ROLE_OPTIONS = [
  "Admin, Hiring Manager",
  "Admin Only",
  "Admin, Hiring Manager, Recruiter",
]

/** "both" is a UI-only convenience for picking the two-element array — stored/DB entry conditions are always "manual" and/or "automatic", never "both". */
type EntryConditionOption = EntryCondition | "both"

const ENTRY_CONDITION_OPTIONS: { value: EntryConditionOption; label: string }[] = [
  { value: "manual", label: "Manual" },
  { value: "automatic", label: "Automatic" },
  { value: "both", label: "Both" },
]

function entryConditionOptionFor(conditions: EntryCondition[]): EntryConditionOption {
  const hasManual = conditions.includes("manual")
  const hasAutomatic = conditions.includes("automatic")
  if (hasManual && hasAutomatic) return "both"
  if (hasAutomatic) return "automatic"
  return "manual"
}

function entryConditionsFor(option: EntryConditionOption): EntryCondition[] {
  return option === "both" ? ["manual", "automatic"] : [option]
}

const INTERVIEWER_OPTIONS: { value: InterviewerType; label: string; description: string }[] = [
  {
    value: "human",
    label: "Human Interviewer",
    description: "A team member conducts the interview or assessment.",
  },
  {
    value: "ai",
    label: "AI Interviewer",
    description: "An AI agent conducts the interaction and captures responses for human review.",
  },
  {
    value: "external",
    label: "External Tool",
    description: "A third-party system runs this stage (for example, an assessment or assignment platform).",
  },
]

const INTERACTION_MODE_OPTIONS: { value: InteractionMode; label: string; description: string }[] = [
  { value: "phone", label: "Phone Call", description: "The interaction happens over a phone call." },
  { value: "video", label: "Video Interview", description: "The interaction happens over a video call." },
  { value: "in_person", label: "In-Person", description: "The interaction happens face to face." },
  {
    value: "async",
    label: "Async",
    description: "The interaction happens asynchronously (take-home assignments or written responses).",
  },
]

const QUESTION_SOURCE_OPTIONS: { value: QuestionSource; label: string; description: string }[] = [
  {
    value: "manual",
    label: "Manually Added",
    description: "Interviewers add their own questions for this stage.",
  },
  {
    value: "structured",
    label: "Structured Set",
    description: "Use a fixed set of predefined questions that must be asked in this stage.",
  },
  {
    value: "ai_assisted",
    label: "AI Assisted",
    description: "Use AI to suggest interview questions based on role competencies and stage context.",
  },
]

const DEFAULT_REQUIRED_QUESTIONS = [
  '"Walk me through your most recent project."',
  '"Describe a time you handled a difficult stakeholder."',
].join("\n")

const SUB_NAV_ITEMS = ["Overview", "Setup", "Evaluation", "Decision", "Automation"] as const
type SubNavItem = (typeof SUB_NAV_ITEMS)[number]

function makeSubStage(
  mainStage: MainStageKey,
  name: string,
  purpose = "",
  scale: SubStageScale = SCALE_OPTIONS[0].value,
  hireRecommendationEnabled = mainStage === "offer"
): SubStage {
  return {
    id: crypto.randomUUID(),
    mainStage,
    name,
    purpose,
    visibility: "internal",
    owner: OWNER_OPTIONS[0],
    collaborator: COLLABORATOR_OPTIONS[0],
    entryConditions: ["manual"],
    interviewerType: "human",
    interactionMode: "phone",
    questionSource: "ai_assisted",
    requiredQuestionsEnabled: true,
    requiredQuestions: DEFAULT_REQUIRED_QUESTIONS,
    captureFeedbackForm: true,
    captureTranscript: true,
    decisionMode: "single_rater",
    decisionOwner: DECISION_OWNER_OPTIONS[0],
    decisionScale: scale,
    hireRecommendationEnabled,
    overrideEnabled: true,
    overrideRoles: OVERRIDE_ROLE_OPTIONS[0],
  }
}

/** Seeds a sub-stage from the workflow template's stored master stage — this is the source of truth a job draft later reads its Scale from. */
function subStageFromMock(mock: MockWorkflowStage): SubStage {
  return {
    ...makeSubStage(
      mock.mainStage,
      mock.name,
      mock.purpose,
      mock.scale,
      mock.hireRecommendationEnabled
    ),
    id: mock.id,
  }
}

/** `format`'s DB values are "phone"|"video"|"onsite"|"async" — only the middle name differs from the local InteractionMode ("in_person" vs "onsite"). */
function interactionModeFromFormat(format: WorkflowTemplateSubStageWithStage["format"]): InteractionMode {
  if (format === "onsite") return "in_person"
  return format ?? "phone"
}
function formatFromInteractionMode(mode: InteractionMode): "phone" | "video" | "onsite" | "async" {
  return mode === "in_person" ? "onsite" : mode
}

/** Hydrates a sub-stage from a real, persisted workflow_template_sub_stages row. */
function subStageFromTemplateRow(row: WorkflowTemplateSubStageWithStage): SubStage {
  return {
    id: row.id,
    mainStage: (row.pipeline_stage?.key ?? "screen") as MainStageKey,
    name: row.name,
    purpose: row.purpose ?? "",
    visibility: row.visibility,
    owner: row.owner_role ?? OWNER_OPTIONS[0],
    collaborator: row.collaborator_role ?? COLLABORATOR_OPTIONS[0],
    entryConditions: row.entry_conditions.length ? row.entry_conditions : ["manual"],
    interviewerType: row.interviewer_type,
    interactionMode: interactionModeFromFormat(row.format),
    questionSource: row.question_source ?? "ai_assisted",
    requiredQuestionsEnabled: row.required_questions !== null,
    requiredQuestions: row.required_questions ?? DEFAULT_REQUIRED_QUESTIONS,
    captureFeedbackForm: row.capture_feedback_form,
    captureTranscript: row.capture_transcript,
    decisionMode: row.decision_mode,
    decisionOwner: row.decision_owner ?? DECISION_OWNER_OPTIONS[0],
    decisionScale: row.rating_scale ?? SCALE_OPTIONS[0].value,
    hireRecommendationEnabled: row.hire_recommendation_enabled,
    overrideEnabled: row.override_enabled,
    overrideRoles: row.override_roles ?? OVERRIDE_ROLE_OPTIONS[0],
  }
}

/** Reverse of subStageFromTemplateRow, for saving back via saveTemplateSubStages. */
function toTemplateSubStageInput(s: SubStage, displayOrder: number): TemplateSubStageInput {
  return {
    pipeline_stage_key: s.mainStage,
    name: s.name,
    purpose: s.purpose || null,
    format: formatFromInteractionMode(s.interactionMode),
    visibility: s.visibility,
    owner_role: s.owner || null,
    collaborator_role: s.collaborator || null,
    entry_conditions: s.entryConditions,
    interviewer_type: s.interviewerType,
    question_source: s.questionSource,
    required_questions: s.requiredQuestionsEnabled ? s.requiredQuestions : null,
    capture_feedback_form: s.captureFeedbackForm,
    capture_transcript: s.captureTranscript,
    decision_mode: s.decisionMode,
    decision_owner: s.decisionOwner || null,
    // Mutually exclusive per stage — see the SubStage.decisionScale/hireRecommendationEnabled comments.
    rating_scale: s.mainStage === "offer" ? null : s.decisionScale,
    hire_recommendation_enabled: s.mainStage === "offer" ? s.hireRecommendationEnabled : false,
    override_enabled: s.overrideEnabled,
    override_roles: s.overrideEnabled ? s.overrideRoles : null,
    display_order: displayOrder,
  }
}

/**
 * Two-column Stages editor: fixed main stages on the left (each holding a
 * variable, reorderable list of sub-stages — same Tier-1/Tier-2 shape as
 * pipeline_stages/job_workflow_sub_stages in CLAUDE.md). Selecting a
 * sub-stage opens its settings on the right. Drag a card by its handle onto
 * another card (or a group header) to reorder within a group or move it
 * into a different main stage entirely — dropping on a card inserts before
 * it; dropping on a header appends to the end of that group.
 */
export function WorkflowStagesTab({
  workflow,
  initialSubStages,
}: {
  workflow: MockWorkflow
  /** Real DB rows to hydrate from and save back to — null for the MOCK_WORKFLOWS fallback (legacy wf-* ids), which has no real template row to persist against. */
  initialSubStages: WorkflowTemplateSubStageWithStage[] | null
}) {
  const isRealTemplate = initialSubStages !== null

  const [subStages, setSubStages] = React.useState<SubStage[]>(() =>
    initialSubStages ? initialSubStages.map(subStageFromTemplateRow) : workflow.stages.map(subStageFromMock)
  )
  const [baseline, setBaseline] = React.useState(subStages)
  const isDirty = JSON.stringify(subStages) !== JSON.stringify(baseline)

  const save = React.useCallback(async (): Promise<TabSaveResult> => {
    if (!isRealTemplate) return { ok: true }
    const res = await saveTemplateSubStages(
      workflow.workflow_id,
      subStages.map((s, i) => toTemplateSubStageInput(s, i))
    )
    if (!res.ok) return res
    setBaseline(subStages)
    return { ok: true }
  }, [isRealTemplate, workflow.workflow_id, subStages])

  useWorkflowEditTab("stages", isDirty, save)
  const [selectedId, setSelectedId] = React.useState<string | null>(subStages[0]?.id ?? null)
  const [collapsed, setCollapsed] = React.useState<Set<MainStageKey>>(new Set())
  const [dragId, setDragId] = React.useState<string | null>(null)

  const selected = subStages.find((s) => s.id === selectedId) ?? null

  function updateSelected(updater: (s: SubStage) => SubStage) {
    if (!selectedId) return
    setSubStages((prev) => prev.map((s) => (s.id === selectedId ? updater(s) : s)))
  }

  function addSubStage(mainStage: MainStageKey) {
    const stage = makeSubStage(mainStage, "New Sub-stage")
    setSubStages((prev) => [...prev, stage])
    setSelectedId(stage.id)
    setCollapsed((prev) => {
      const next = new Set(prev)
      next.delete(mainStage)
      return next
    })
  }

  function removeSubStage(id: string) {
    setSubStages((prev) => prev.filter((s) => s.id !== id))
    setSelectedId((current) => (current === id ? null : current))
  }

  function toggleCollapsed(mainStage: MainStageKey) {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(mainStage)) next.delete(mainStage)
      else next.add(mainStage)
      return next
    })
  }

  /**
   * Moves `draggedId` into `targetMainStage` (reassigning it if it came from
   * a different group), inserted just before `targetId` — or appended to
   * the end of that group when `targetId` is null (dropped on a header).
   */
  function moveSubStage(
    draggedId: string,
    targetMainStage: MainStageKey,
    targetId: string | null
  ) {
    setSubStages((prev) => {
      const dragged = prev.find((s) => s.id === draggedId)
      if (!dragged || draggedId === targetId) return prev

      const rest = prev.filter((s) => s.id !== draggedId)
      const moved: SubStage = { ...dragged, mainStage: targetMainStage }

      if (targetId === null) {
        let lastIndexInGroup = -1
        rest.forEach((s, i) => {
          if (s.mainStage === targetMainStage) lastIndexInGroup = i
        })
        if (lastIndexInGroup === -1) return [...rest, moved]
        return [
          ...rest.slice(0, lastIndexInGroup + 1),
          moved,
          ...rest.slice(lastIndexInGroup + 1),
        ]
      }

      const targetIndex = rest.findIndex((s) => s.id === targetId)
      if (targetIndex === -1) return [...rest, moved]
      return [...rest.slice(0, targetIndex), moved, ...rest.slice(targetIndex)]
    })
  }

  return (
    <div className="flex h-full gap-8">
      <div className="scrollbar-light flex h-full w-[380px] shrink-0 flex-col overflow-y-auto border-r border-border">
        {MAIN_STAGES.map((stage) => {
          const stageSubStages = subStages.filter((s) => s.mainStage === stage.key)
          const isCollapsed = collapsed.has(stage.key)
          return (
            <div key={stage.key}>
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault()
                  if (dragId) moveSubStage(dragId, stage.key, null)
                  setDragId(null)
                }}
                className="flex items-center justify-between border-b border-border bg-muted px-6 py-2"
              >
                <span className="text-sm font-medium">{stage.label}</span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label={`Add sub-stage to ${stage.label}`}
                    onClick={() => addSubStage(stage.key)}
                  >
                    <Plus className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label={isCollapsed ? `Expand ${stage.label}` : `Collapse ${stage.label}`}
                    onClick={() => toggleCollapsed(stage.key)}
                  >
                    {isCollapsed ? (
                      <ChevronDown className="size-4" />
                    ) : (
                      <ChevronUp className="size-4" />
                    )}
                  </Button>
                </div>
              </div>

              {!isCollapsed && (
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault()
                    if (dragId) moveSubStage(dragId, stage.key, null)
                    setDragId(null)
                  }}
                  className="flex flex-col gap-2 p-2"
                >
                  {stageSubStages.length === 0 && (
                    <p className="px-1 py-2 text-xs text-muted-foreground">No sub-stages yet.</p>
                  )}
                  {stageSubStages.map((sub) => (
                    <div
                      key={sub.id}
                      draggable
                      onDragStart={() => setDragId(sub.id)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        if (dragId) moveSubStage(dragId, stage.key, sub.id)
                        setDragId(null)
                      }}
                      onClick={() => setSelectedId(sub.id)}
                      className={cn(
                        "flex cursor-pointer flex-col gap-1 rounded-lg border bg-white p-3",
                        sub.id === selectedId
                          ? "border-foreground"
                          : "border-border hover:bg-muted/60"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <GripVertical className="size-4 shrink-0 cursor-grab text-muted-foreground" />
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={
                              <Button
                                variant="ghost"
                                size="icon-xs"
                                aria-label={`${sub.name} actions`}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <MoreVertical className="size-4" />
                              </Button>
                            }
                          />
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation()
                                removeSubStage(sub.id)
                              }}
                            >
                              Remove
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      <span className="text-sm font-semibold">{sub.name}</span>
                      <span className="text-xs text-muted-foreground">{sub.purpose}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="h-full min-w-0 flex-1 overflow-hidden py-4 pr-4">
        {selected ? (
          <SubStageSettingsPanel key={selected.id} subStage={selected} onChange={updateSelected} />
        ) : (
          <p className="text-sm text-muted-foreground">Select a sub-stage to view its settings.</p>
        )}
      </div>
    </div>
  )
}

function SubStageSettingsPanel({
  subStage,
  onChange,
}: {
  subStage: SubStage
  onChange: (updater: (s: SubStage) => SubStage) => void
}) {
  const [activeSubNav, setActiveSubNav] = React.useState<SubNavItem>("Overview")
  const contentScrollbar = useScrollbarOnScroll()

  return (
    <div className="flex h-full gap-8">
      <div className="flex w-40 shrink-0 flex-col gap-1">
        {SUB_NAV_ITEMS.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setActiveSubNav(item)}
            className={cn(
              "rounded-md px-3 py-2 text-left text-sm",
              activeSubNav === item
                ? "bg-brand-orange-100 font-medium text-foreground"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
            )}
          >
            {item}
          </button>
        ))}
      </div>

      <div
        onScroll={contentScrollbar.onScroll}
        className={cn(
          "scrollbar-hover mx-auto h-full max-w-xl flex-1 overflow-y-auto",
          contentScrollbar.isScrolling && "is-scrolling"
        )}
      >
        {activeSubNav === "Overview" ? (
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-1.5">
              <Label>Stage Name</Label>
              <Input
                value={subStage.name}
                onChange={(e) => onChange((s) => ({ ...s, name: e.target.value }))}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Stage Purpose</Label>
              <Textarea
                value={subStage.purpose}
                onChange={(e) => onChange((s) => ({ ...s, purpose: e.target.value }))}
                placeholder="What is this stage for?"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label>Visibility</Label>
              <RadioGroup
                value={subStage.visibility}
                onValueChange={(value) =>
                  onChange((s) => ({ ...s, visibility: value as Visibility }))
                }
              >
                <label className="flex cursor-pointer items-start gap-2.5">
                  <RadioGroupItem value="internal" className="mt-0.5" />
                  <span className="flex flex-col">
                    <span className="text-sm font-medium text-foreground">Internal Only</span>
                    <span className="text-sm text-muted-foreground">
                      This stage is only visible to internal team members. Candidates will not
                      see it.
                    </span>
                  </span>
                </label>
                <label className="flex cursor-pointer items-start gap-2.5">
                  <RadioGroupItem value="candidate_facing" className="mt-0.5" />
                  <span className="flex flex-col">
                    <span className="text-sm font-medium text-foreground">Candidate Facing</span>
                    <span className="text-sm text-muted-foreground">
                      This stage is visible to candidates (for example, in status updates or
                      communications).
                    </span>
                  </span>
                </label>
              </RadioGroup>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Stage Owner(s)</Label>
              <Select
                value={subStage.owner}
                onValueChange={(value) => value && onChange((s) => ({ ...s, owner: value }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OWNER_OPTIONS.map((o) => (
                    <SelectItem key={o} value={o}>
                      {o}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Collaborators</Label>
              <Select
                value={subStage.collaborator}
                onValueChange={(value) =>
                  value && onChange((s) => ({ ...s, collaborator: value }))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COLLABORATOR_OPTIONS.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        ) : activeSubNav === "Setup" ? (
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-1.5">
              <Label>Entry Condition</Label>
              <Select
                value={entryConditionOptionFor(subStage.entryConditions)}
                onValueChange={(value) =>
                  value &&
                  onChange((s) => ({
                    ...s,
                    entryConditions: entryConditionsFor(value as EntryConditionOption),
                  }))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ENTRY_CONDITION_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex flex-col gap-0.5">
                <Label>Interviewer</Label>
                <p className="text-sm text-muted-foreground">
                  Select who is allowed to run this stage
                </p>
              </div>
              <RadioCardGroup
                value={subStage.interviewerType}
                onValueChange={(value) => onChange((s) => ({ ...s, interviewerType: value }))}
                options={INTERVIEWER_OPTIONS}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label>Interaction Mode</Label>
              <RadioCardGroup
                value={subStage.interactionMode}
                onValueChange={(value) => onChange((s) => ({ ...s, interactionMode: value }))}
                options={INTERACTION_MODE_OPTIONS}
              />
            </div>
          </div>
        ) : activeSubNav === "Evaluation" ? (
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <div className="flex flex-col gap-0.5">
                <Label>Questions</Label>
                <p className="text-sm text-muted-foreground">
                  Choose how interview questions are defined and presented during this stage.
                </p>
              </div>
              <RadioCardGroup
                value={subStage.questionSource}
                onValueChange={(value) => onChange((s) => ({ ...s, questionSource: value }))}
                options={QUESTION_SOURCE_OPTIONS}
              />
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-4">
                <Label>Required Questions</Label>
                <Switch
                  checked={subStage.requiredQuestionsEnabled}
                  onCheckedChange={(checked) =>
                    onChange((s) => ({ ...s, requiredQuestionsEnabled: checked }))
                  }
                />
              </div>
              <p className="text-sm text-muted-foreground">
                Add questions that must always be asked, regardless of how other questions are
                generated.
              </p>
              {subStage.requiredQuestionsEnabled && (
                <Textarea
                  value={subStage.requiredQuestions}
                  onChange={(e) =>
                    onChange((s) => ({ ...s, requiredQuestions: e.target.value }))
                  }
                  className="min-h-48"
                  placeholder='"Walk me through your most recent project."'
                />
              )}
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-0.5">
                <Label>Evidence to Capture</Label>
                <p className="text-sm text-muted-foreground">
                  Choose what evidence should be captured during this stage to support review
                  and decision-making.
                </p>
              </div>

              <label className="flex cursor-pointer items-start gap-2.5">
                <Checkbox
                  className="mt-0.5"
                  checked={subStage.captureFeedbackForm}
                  onCheckedChange={(checked) =>
                    onChange((s) => ({ ...s, captureFeedbackForm: checked === true }))
                  }
                />
                <span className="flex flex-col">
                  <span className="text-sm font-medium text-foreground">Feedback form</span>
                  <span className="text-sm text-muted-foreground">
                    Collect structured feedback from interviewers after the interaction
                  </span>
                </span>
              </label>

              <label className="flex cursor-pointer items-start gap-2.5">
                <Checkbox
                  className="mt-0.5"
                  checked={subStage.captureTranscript}
                  onCheckedChange={(checked) =>
                    onChange((s) => ({ ...s, captureTranscript: checked === true }))
                  }
                />
                <span className="flex flex-col">
                  <span className="text-sm font-medium text-foreground">Transcript</span>
                  <span className="text-sm text-muted-foreground">
                    Capture a transcript of the interaction to enable review, summaries, and
                    downstream analysis.
                  </span>
                </span>
              </label>
            </div>
          </div>
        ) : activeSubNav === "Decision" ? (
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <div className="flex flex-col gap-0.5">
                <Label>Decision Mode</Label>
                <p className="text-sm text-muted-foreground">
                  Select who is allowed to run this stage
                </p>
              </div>
              <RadioGroup
                value={subStage.decisionMode}
                onValueChange={(value) =>
                  onChange((s) => ({ ...s, decisionMode: value as DecisionMode }))
                }
                className="grid grid-cols-2 gap-6"
              >
                <label className="flex cursor-pointer items-start gap-2.5">
                  <RadioGroupItem value="single_rater" className="mt-0.5" />
                  <span className="flex flex-col">
                    <span className="text-sm font-medium text-foreground">Single-Rater</span>
                    <span className="text-sm text-muted-foreground">
                      One designated owner reviews the evidence and records the final decision.
                    </span>
                  </span>
                </label>
                <label className="flex cursor-pointer items-start gap-2.5">
                  <RadioGroupItem value="multi_rater" className="mt-0.5" />
                  <span className="flex flex-col">
                    <span className="text-sm font-medium text-foreground">Multi-Rater</span>
                    <span className="text-sm text-muted-foreground">
                      Multiple reviewers submit feedback, which is combined to inform the final
                      decision.
                    </span>
                  </span>
                </label>
              </RadioGroup>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Decision Owner</Label>
              <Select
                value={subStage.decisionOwner}
                onValueChange={(value) => value && onChange((s) => ({ ...s, decisionOwner: value }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DECISION_OWNER_OPTIONS.map((o) => (
                    <SelectItem key={o} value={o}>
                      {o}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {subStage.mainStage === "offer" ? (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-4">
                  <Label>Hire Recommendation</Label>
                  <Switch
                    checked={subStage.hireRecommendationEnabled}
                    onCheckedChange={(checked) =>
                      onChange((s) => ({ ...s, hireRecommendationEnabled: checked }))
                    }
                  />
                </div>
                <p className="text-sm text-muted-foreground">
                  Offer-stage decisions capture a hire recommendation instead of a rating
                  scale.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                <Label>Scale</Label>
                <Select
                  value={subStage.decisionScale}
                  onValueChange={(value) =>
                    value && onChange((s) => ({ ...s, decisionScale: value as SubStageScale }))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SCALE_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-4">
                <Label>Override</Label>
                <Switch
                  checked={subStage.overrideEnabled}
                  onCheckedChange={(checked) =>
                    onChange((s) => ({ ...s, overrideEnabled: checked }))
                  }
                />
              </div>
              <p className="text-sm text-muted-foreground">Allow decision override</p>
              {subStage.overrideEnabled && (
                <Select
                  value={subStage.overrideRoles}
                  onValueChange={(value) =>
                    value && onChange((s) => ({ ...s, overrideRoles: value }))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {OVERRIDE_ROLE_OPTIONS.map((o) => (
                      <SelectItem key={o} value={o}>
                        {o}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
        ) : (
          <p className="pt-2 text-sm text-muted-foreground">
            {activeSubNav} isn&apos;t wired up yet — coming later.
          </p>
        )}
      </div>
    </div>
  )
}
