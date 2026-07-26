import { Mic } from "lucide-react"

import { Badge } from "@/components/ui/badge"

export default function InterviewAgentPage() {
  return (
    <div className="space-y-6 p-4">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <Mic className="size-6 text-brand-purple-600" />
          Interview Agent
        </h1>
        <p className="text-sm text-muted-foreground">
          AI-assisted interview scheduling, live note-taking, and debrief summaries.
        </p>
      </div>

      <div className="flex items-center gap-2">
        <Badge variant="outline">TODO — stub</Badge>
        <p className="text-sm text-muted-foreground">
          Not wired up yet — this page exists so the Agents nav section has
          somewhere to land.
        </p>
      </div>
    </div>
  )
}
