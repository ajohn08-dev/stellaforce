"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsPanel, TabsTab } from "@/components/ui/tabs"
import { JobPulseTab } from "@/components/jobs/workspace/job-pulse-tab"
import { PipelineStagePanel } from "@/components/jobs/workspace/pipeline-stage-panel"
import type { JobEvalContext } from "@/lib/job-adapter"
import type { PulseAction, PulseEvent, PulseStat } from "@/lib/job-pulse"
import type { SubStage } from "@/lib/pipeline-candidates"

const SCROLL_STEP = 240
const PULSE_TAB = "pulse"

/**
 * The published job workspace's single tab strip: **Pulse** (where the job
 * stands overall) followed by every sub-stage of the job's snapshotted
 * pipeline in order (Sourced, Pre-Screening, Recruiter Screen, …). One row,
 * not a row of sections over a row of stages — the sub-stages *are* the
 * sections. Pulse leads, so the workspace opens on the summary rather than on
 * the first sub-stage's candidate list.
 *
 * The strip scrolls horizontally with chevrons once the stages overflow, since
 * a job can carry a dozen of them.
 */
export function JobWorkspaceTabs({
  stats,
  events,
  actions,
  stageOptions,
  candidateOptions,
  stages,
  jobEvalContext,
}: {
  stats: PulseStat[]
  events: PulseEvent[]
  actions: PulseAction[]
  stageOptions: { id: string; name: string }[]
  candidateOptions: { id: string; name: string }[]
  stages: SubStage[]
  jobEvalContext: JobEvalContext
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
    <Tabs defaultValue={PULSE_TAB} className="flex h-full min-h-0 flex-col gap-3">
      <div className="shrink-0 flex items-center gap-1 border-b border-border">
        {canScrollLeft && (
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0"
            aria-label="Scroll tabs left"
            onClick={() => scrollBy(-SCROLL_STEP)}
          >
            <ChevronLeft className="size-4" />
          </Button>
        )}

        <div ref={scrollerRef} className="no-scrollbar min-w-0 overflow-x-auto">
          <TabsList className="border-b-0">
            <TabsTab value={PULSE_TAB} className="inline-flex shrink-0 items-center">
              Pulse
            </TabsTab>
            {stages.map((stage) => (
              <TabsTab
                key={stage.key}
                value={stage.key}
                className="inline-flex shrink-0 items-center gap-1.5"
              >
                {stage.name}
                <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
                  {stage.candidates.length}
                </span>
              </TabsTab>
            ))}
          </TabsList>
        </div>

        {canScrollRight && (
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0"
            aria-label="Scroll tabs right"
            onClick={() => scrollBy(SCROLL_STEP)}
          >
            <ChevronRight className="size-4" />
          </Button>
        )}
      </div>

      <TabsPanel value={PULSE_TAB} className="min-h-0 flex-1 overflow-y-auto">
        <JobPulseTab
          stats={stats}
          events={events}
          actions={actions}
          stageOptions={stageOptions}
          candidateOptions={candidateOptions}
        />
      </TabsPanel>

      {stages.map((stage) => (
        <TabsPanel key={stage.key} value={stage.key} className="min-h-0 flex-1">
          <PipelineStagePanel candidates={stage.candidates} jobEvalContext={jobEvalContext} />
        </TabsPanel>
      ))}
    </Tabs>
  )
}
