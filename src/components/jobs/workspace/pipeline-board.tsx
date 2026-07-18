"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"

import { Tabs, TabsList, TabsPanel, TabsTab } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { PipelineStagePanel } from "@/components/jobs/workspace/pipeline-stage-panel"
import type { SubStage } from "@/lib/pipeline-candidates"

const SCROLL_STEP = 240

/** Sub-stage tabs (Source, Recruiter Screen, Technical Interview 1, ...) — varies per job. */
export function PipelineBoard({ stages }: { stages: SubStage[] }) {
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
    <Tabs defaultValue={stages[0]?.key} className="flex h-full min-h-0 flex-col gap-3">
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

      {stages.map((stage) => (
        <TabsPanel key={stage.key} value={stage.key} className="min-h-0 flex-1">
          <PipelineStagePanel candidates={stage.candidates} />
        </TabsPanel>
      ))}
    </Tabs>
  )
}
