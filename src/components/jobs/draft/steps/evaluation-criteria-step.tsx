"use client"

import * as React from "react"
import { Pencil, Plus, Wrench, X } from "lucide-react"
import type { LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  COMPETENCY_TYPE_LABEL,
  type Competency,
  type CompetencyType,
  type ProficiencyLevel,
} from "@/components/jobs/draft/steps/competency-data"

const LEVEL_ORDER: ProficiencyLevel[] = ["aware", "proficient", "expert"]

const LEVEL_META: Record<ProficiencyLevel, { rank: number; title: string }> = {
  aware: { rank: 1, title: "Aware" },
  proficient: { rank: 2, title: "Proficient" },
  expert: { rank: 3, title: "Expert" },
}

export function EvaluationCriteriaStep({
  competencies,
  setCompetencies,
}: {
  competencies: Competency[]
  setCompetencies: React.Dispatch<React.SetStateAction<Competency[]>>
}) {
  function removeCompetency(id: string) {
    setCompetencies((prev) => prev.filter((c) => c.id !== id))
  }

  function updateCompetency(
    id: string,
    updater: (competency: Competency) => Competency
  ) {
    setCompetencies((prev) =>
      prev.map((c) => (c.id === id ? updater(c) : c))
    )
  }

  if (competencies.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No competencies yet — they&apos;ll appear here once suggested from
        the job description.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {competencies.map((competency) => (
        <CompetencyCard
          key={competency.id}
          competency={competency}
          onRemove={() => removeCompetency(competency.id)}
          onChange={(updater) => updateCompetency(competency.id, updater)}
        />
      ))}
    </div>
  )
}

function CompetencyCard({
  competency,
  onRemove,
  onChange,
}: {
  competency: Competency
  onRemove: () => void
  onChange: (updater: (competency: Competency) => Competency) => void
}) {
  return (
    <div className="rounded-lg border border-border bg-white p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-2">
          <CompetencyTypeBadge type={competency.type} />
          <p className="text-sm font-medium text-foreground">
            {competency.description}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label="Remove competency"
          onClick={onRemove}
          className="shrink-0 text-muted-foreground hover:text-foreground"
        >
          <X />
        </Button>
      </div>

      <div
        role="radiogroup"
        aria-label="Proficiency level"
        className="mt-4 grid grid-cols-3 gap-3"
      >
        {LEVEL_ORDER.map((level) => (
          <LevelCard
            key={level}
            level={level}
            competency={competency}
            onChange={onChange}
          />
        ))}
      </div>

      <ChipSection
        label="Skills"
        items={competency.skills}
        onAdd={(value) =>
          onChange((c) => ({ ...c, skills: [...c.skills, value] }))
        }
        onRemove={(index) =>
          onChange((c) => ({
            ...c,
            skills: c.skills.filter((_, i) => i !== index),
          }))
        }
        className="mt-6"
      />

      <ChipSection
        label="Tools"
        items={competency.tools}
        icon={Wrench}
        onAdd={(value) =>
          onChange((c) => ({ ...c, tools: [...c.tools, value] }))
        }
        onRemove={(index) =>
          onChange((c) => ({
            ...c,
            tools: c.tools.filter((_, i) => i !== index),
          }))
        }
        className="mt-4"
      />
    </div>
  )
}

function CompetencyTypeBadge({ type }: { type: CompetencyType }) {
  return (
    <span className="inline-flex shrink-0 items-center rounded-md border border-brand-purple-200 bg-brand-purple-50 px-2 py-0.5 text-xs font-medium text-brand-purple-700">
      {COMPETENCY_TYPE_LABEL[type]}
    </span>
  )
}

function LevelCard({
  level,
  competency,
  onChange,
}: {
  level: ProficiencyLevel
  competency: Competency
  onChange: (updater: (competency: Competency) => Competency) => void
}) {
  const isSelected = competency.selectedLevel === level
  const isRecommended = competency.recommendedLevel === level
  const meta = LEVEL_META[level]
  const savedText = competency.levelDescriptions[level]

  const [isEditing, setIsEditing] = React.useState(false)
  const [draft, setDraft] = React.useState(savedText)

  function select() {
    if (!isSelected) onChange((c) => ({ ...c, selectedLevel: level }))
  }

  function startEditing(e: React.SyntheticEvent) {
    e.stopPropagation()
    setDraft(savedText)
    setIsEditing(true)
  }

  function save() {
    onChange((c) => ({
      ...c,
      levelDescriptions: { ...c.levelDescriptions, [level]: draft },
    }))
    setIsEditing(false)
  }

  function cancel() {
    setDraft(savedText)
    setIsEditing(false)
  }

  return (
    <div
      role="radio"
      aria-checked={isSelected}
      tabIndex={0}
      onClick={select}
      onKeyDown={(e) => {
        if ((e.key === "Enter" || e.key === " ") && e.target === e.currentTarget) {
          e.preventDefault()
          select()
        }
      }}
      className={cn(
        "flex flex-col items-start gap-1.5 rounded-lg border p-4 text-left transition-colors",
        isSelected
          ? "border-brand-orange-200 bg-brand-orange-50"
          : "cursor-pointer border-border hover:bg-muted"
      )}
    >
      <div className="flex w-full items-start justify-between gap-2">
        <span className="flex flex-wrap items-center gap-2 text-sm font-medium text-foreground">
          Level {meta.rank} - {meta.title}
          {isRecommended && (
            <span className="text-xs font-medium text-primary">
              Recommended
            </span>
          )}
        </span>
        <button
          type="button"
          aria-label={`Edit ${meta.title} description`}
          onClick={startEditing}
          className="shrink-0 text-muted-foreground hover:text-foreground"
        >
          <Pencil className="size-3.5" />
        </button>
      </div>

      {isEditing ? (
        <Textarea
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            e.stopPropagation()
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault()
              save()
            } else if (e.key === "Escape") {
              e.preventDefault()
              cancel()
            }
          }}
          onBlur={save}
          className="min-h-24 resize-none border-0 bg-transparent p-0 text-sm text-muted-foreground focus-visible:ring-0"
        />
      ) : (
        <p className="line-clamp-4 text-sm text-muted-foreground">
          {savedText}
        </p>
      )}
    </div>
  )
}

function ChipSection({
  label,
  items,
  icon: Icon,
  onAdd,
  onRemove,
  className,
}: {
  label: string
  items: string[]
  icon?: LucideIcon
  onAdd: (value: string) => void
  onRemove: (index: number) => void
  className?: string
}) {
  const [adding, setAdding] = React.useState(false)
  const [value, setValue] = React.useState("")

  function commit() {
    const trimmed = value.trim()
    if (trimmed) onAdd(trimmed)
    setValue("")
    setAdding(false)
  }

  return (
    <div className={className}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-foreground">{label}</span>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={`Add ${label.toLowerCase()}`}
          onClick={() => setAdding(true)}
          className="text-muted-foreground hover:text-foreground"
        >
          <Plus />
        </Button>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {items.map((item, index) => (
          <span
            key={`${item}-${index}`}
            className="inline-flex items-center gap-1.5 rounded-full bg-secondary py-1 pr-1.5 pl-3 text-sm text-secondary-foreground"
          >
            {Icon && <Icon className="size-3.5 text-muted-foreground" />}
            {item}
            <button
              type="button"
              aria-label={`Remove ${item}`}
              onClick={() => onRemove(index)}
              className="rounded-full p-0.5 text-muted-foreground hover:bg-background hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          </span>
        ))}

        {adding && (
          <Input
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                commit()
              } else if (e.key === "Escape") {
                setValue("")
                setAdding(false)
              }
            }}
            className="h-7 w-36"
          />
        )}
      </div>
    </div>
  )
}
