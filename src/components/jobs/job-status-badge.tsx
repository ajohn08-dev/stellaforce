import { Badge } from "@/components/ui/badge"
import { JOB_STATUS_BADGE_CLASS, titleCase } from "@/lib/constants"
import { cn } from "@/lib/utils"
import type { JobStatus } from "@/lib/supabase/types"

export function JobStatusBadge({ status }: { status: JobStatus }) {
  return (
    <Badge className={cn("border-transparent", JOB_STATUS_BADGE_CLASS[status])}>
      {titleCase(status)}
    </Badge>
  )
}
