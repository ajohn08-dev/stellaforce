import { Workflow } from "lucide-react"

import { Badge } from "@/components/ui/badge"

export default function WorkflowsPage() {
  return (
    <div className="space-y-6 p-4">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <Workflow className="size-6 text-brand-purple-600" />
          Workflows
        </h1>
        <p className="text-sm text-muted-foreground">
          Manage reusable hiring pipeline templates.
        </p>
      </div>

      <div className="flex items-center gap-2">
        <Badge variant="outline">TODO — stub</Badge>
        <p className="text-sm text-muted-foreground">
          Not wired up yet — this page exists so the Workflows nav item has
          somewhere to land.
        </p>
      </div>
    </div>
  )
}
