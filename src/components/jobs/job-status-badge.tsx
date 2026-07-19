import { Badge } from "@/components/ui/badge"
import { JOB_STATUS_BADGE_CLASS, titleCase } from "@/lib/constants"
import { cn } from "@/lib/utils"
import type { MockJobStatus } from "@/lib/mock-jobs"

const DRAFT_BADGE_CLASS = "bg-muted text-muted-foreground"

export function JobStatusBadge({ status }: { status: MockJobStatus }) {
  const badgeClass =
    status === "draft" ? DRAFT_BADGE_CLASS : JOB_STATUS_BADGE_CLASS[status]

  return (
    <Badge className={cn("border-transparent", badgeClass)}>
      {titleCase(status)}
    </Badge>
  )
}
