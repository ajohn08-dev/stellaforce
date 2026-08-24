"use client"

import * as React from "react"
import { ArrowRight, Loader2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { moveCandidate } from "@/app/(app)/jobs/actions"

/**
 * Move a candidate to another sub-stage.
 *
 * `moveCandidate` has existed and worked since the workflow-templates pass and
 * **had no caller** — the pipeline board was entirely read-only, so no candidate
 * could be advanced through the UI at all. That mattered more once stage entry
 * became a trigger: "candidate reaches an agent interview stage" is what sends a
 * booking link, and nothing could make it happen.
 *
 * The Server Action is a thin wrapper over `moveApplicationToStage`, the same
 * command `/api/applications/[id]/move-stage` calls — so this button and an n8n
 * webhook produce identical rows and identical events.
 */
export function MoveCandidateControl({
  applicationId,
  currentStageId,
  stages,
}: {
  applicationId: string
  currentStageId: string | null
  stages: { id: string; name: string }[]
}) {
  const [target, setTarget] = React.useState<string>("")
  const [isPending, startTransition] = React.useTransition()

  const options = stages.filter((s) => s.id !== currentStageId)
  if (options.length === 0) return null

  function move() {
    if (!target) return
    startTransition(async () => {
      const result = await moveCandidate(applicationId, target)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      const name = options.find((s) => s.id === target)?.name ?? "the next stage"
      // Deliberately vague about the booking link: whether one goes out depends
      // on the stage's configuration and the automation gate, and promising it
      // here would be a second source of truth for a decision made server-side.
      toast.success(`Moved to ${name}.`)
      setTarget("")
    })
  }

  return (
    <div className="flex items-center gap-2">
      <Select value={target} onValueChange={(value) => setTarget(value ?? "")}>
        <SelectTrigger className="h-8 w-48">
          <SelectValue placeholder="Move to stage…" />
        </SelectTrigger>
        <SelectContent>
          {options.map((s) => (
            <SelectItem key={s.id} value={s.id}>
              {s.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={!target || isPending}
        onClick={move}
      >
        {isPending ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <>
            Move
            <ArrowRight data-icon="inline-end" className="size-3.5" />
          </>
        )}
      </Button>
    </div>
  )
}
