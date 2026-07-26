"use client"

import * as React from "react"
import { Plus, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { Competency } from "@/components/jobs/draft/steps/competency-data"

type ScoreCardCategory = {
  id: string
  name: string
  weight: number
  competencyIds: string[]
}

/**
 * Seeded to cover both competencies from the Evaluation Criteria step, with
 * weights that add up to 100%.
 */
const INITIAL_SCORE_CARD: ScoreCardCategory[] = [
  {
    id: "technical-execution",
    name: "Technical Execution",
    weight: 60,
    competencyIds: ["internal-tools"],
  },
  {
    id: "communication-collaboration",
    name: "Communication & Collaboration",
    weight: 40,
    competencyIds: ["stakeholder-communication"],
  },
]

/**
 * Score card categories reference competencies by id rather than duplicating
 * their text, so this step can only ever reflect what's defined in
 * Evaluation Criteria — never additional, invented competencies.
 */
export function ScoreCardStep({ competencies }: { competencies: Competency[] }) {
  const [categories, setCategories] = React.useState(INITIAL_SCORE_CARD)

  function removeCategory(id: string) {
    setCategories((prev) => prev.filter((c) => c.id !== id))
  }

  function updateCategory(
    id: string,
    updater: (category: ScoreCardCategory) => ScoreCardCategory
  ) {
    setCategories((prev) => prev.map((c) => (c.id === id ? updater(c) : c)))
  }

  return (
    <div className="flex flex-col gap-4">
      {categories.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No score card categories yet.
        </p>
      ) : (
        categories.map((category) => (
          <ScoreCardCategoryCard
            key={category.id}
            category={category}
            competencies={competencies}
            onRemove={() => removeCategory(category.id)}
            onChange={(updater) => updateCategory(category.id, updater)}
          />
        ))
      )}
    </div>
  )
}

function ScoreCardCategoryCard({
  category,
  competencies,
  onRemove,
  onChange,
}: {
  category: ScoreCardCategory
  competencies: Competency[]
  onRemove: () => void
  onChange: (updater: (category: ScoreCardCategory) => ScoreCardCategory) => void
}) {
  const assigned = competencies.filter((c) =>
    category.competencyIds.includes(c.id)
  )
  const available = competencies.filter(
    (c) => !category.competencyIds.includes(c.id)
  )
  const [picking, setPicking] = React.useState(false)

  return (
    <div className="rounded-lg border border-border bg-white p-6">
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-sm font-semibold text-foreground">
          {category.name}
        </h3>
        <div className="flex shrink-0 items-center gap-3">
          <div className="flex items-center gap-1">
            <Input
              type="number"
              min={0}
              max={100}
              value={category.weight}
              onChange={(e) =>
                onChange((c) => ({
                  ...c,
                  weight: Number(e.target.value),
                }))
              }
              className="h-7 w-16 text-right"
            />
            <span className="text-sm text-muted-foreground">%</span>
          </div>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label="Remove score card category"
            onClick={onRemove}
            className="text-muted-foreground hover:text-foreground"
          >
            <X />
          </Button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {assigned.map((competency) => (
          <span
            key={competency.id}
            className="inline-flex items-center gap-1.5 rounded-full bg-secondary py-1 pr-1.5 pl-3 text-sm text-secondary-foreground"
          >
            {competency.description}
            <button
              type="button"
              aria-label={`Remove ${competency.description}`}
              onClick={() =>
                onChange((c) => ({
                  ...c,
                  competencyIds: c.competencyIds.filter(
                    (id) => id !== competency.id
                  ),
                }))
              }
              className="rounded-full p-0.5 text-muted-foreground hover:bg-background hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          </span>
        ))}

        {available.length > 0 &&
          (picking ? (
            <Select
              defaultOpen
              onOpenChange={(open) => setPicking(open)}
              onValueChange={(value) => {
                onChange((c) => ({
                  ...c,
                  competencyIds: [...c.competencyIds, value as string],
                }))
                setPicking(false)
              }}
            >
              <SelectTrigger className="h-7 w-56">
                <SelectValue placeholder="Select competency" />
              </SelectTrigger>
              <SelectContent>
                {available.map((competency) => (
                  <SelectItem key={competency.id} value={competency.id}>
                    {competency.description}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label="Add competency"
              onClick={() => setPicking(true)}
              className="text-muted-foreground hover:text-foreground"
            >
              <Plus />
            </Button>
          ))}
      </div>
    </div>
  )
}
