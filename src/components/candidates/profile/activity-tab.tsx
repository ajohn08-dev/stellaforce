import type { AddedByProfile } from "@/lib/data"

function formatActivityDate(at: string): string {
  return new Date(at).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

export function ActivityTab({
  addedBy,
  dateAdded,
}: {
  addedBy: AddedByProfile | null
  dateAdded: string
}) {
  const addedByName = addedBy?.full_name ?? addedBy?.email ?? "Unknown"

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm">Added by {addedByName}</span>
        <span className="shrink-0 text-xs text-muted-foreground">
          {formatActivityDate(dateAdded)}
        </span>
      </div>
    </div>
  )
}
