import { Building2 } from "lucide-react"

import { formatMonth, type WorkHistoryEntry } from "@/lib/work-history"

export function HighlightCallout({ entry }: { entry: WorkHistoryEntry }) {
  return (
    <div className="inline-flex max-w-sm items-start gap-3 rounded-lg border border-brand-orange-200 bg-brand-orange-50 p-4 dark:border-brand-orange-900 dark:bg-brand-orange-950">
      <Building2 className="mt-0.5 size-4 shrink-0 text-brand-orange-600" />
      <div>
        <p className="text-sm font-medium">Notable employer</p>
        <p className="text-sm text-muted-foreground">
          Worked at {entry.company}{" "}
          {entry.end_date
            ? `until ${formatMonth(entry.end_date)}`
            : "— current role"}
        </p>
      </div>
    </div>
  )
}
