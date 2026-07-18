import { Fragment } from "react"

import { Separator } from "@/components/ui/separator"
import type { PipelineCounts } from "@/lib/mock-jobs"

const STAGES: { key: keyof PipelineCounts; label: string }[] = [
  { key: "source", label: "source" },
  { key: "screen", label: "screen" },
  { key: "interview", label: "interview" },
  { key: "offer", label: "offer" },
  { key: "close", label: "close" },
]

/** Candidate headcount per pipeline stage — an unboxed row, columns split by hairline separators. */
export function JobPipelineStages({ pipeline }: { pipeline: PipelineCounts }) {
  return (
    <div className="flex items-stretch">
      {STAGES.map(({ key, label }, i) => (
        <Fragment key={key}>
          {i > 0 && <Separator orientation="vertical" className="mx-4" />}
          <div className="flex-1 text-center">
            <p className="text-sm font-medium">{pipeline[key]}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{label}</p>
          </div>
        </Fragment>
      ))}
    </div>
  )
}
