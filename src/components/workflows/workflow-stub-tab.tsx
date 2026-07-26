import { Badge } from "@/components/ui/badge"

/** Shared placeholder for workflow-detail tabs not specified yet. */
export function WorkflowStubTab({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2">
      <Badge variant="outline">TODO — stub</Badge>
      <p className="text-sm text-muted-foreground">
        {label} isn&apos;t wired up yet — coming later.
      </p>
    </div>
  )
}
