import { Fragment } from "react"

import { Separator } from "@/components/ui/separator"
import { PIPELINE_STAGES } from "@/lib/pipeline-candidates"
import type { PipelineCounts } from "@/lib/mock-jobs"

/** Candidate headcount per pipeline stage — an unboxed row, columns split by hairline separators. */
export function JobPipelineStages({ pipeline }: { pipeline: PipelineCounts }) {
  return (
    <div className="flex items-stretch">
      {PIPELINE_STAGES.map(({ key, label }, i) => (
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
