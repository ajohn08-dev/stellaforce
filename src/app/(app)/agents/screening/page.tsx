import { Bot } from "lucide-react"

import { Badge } from "@/components/ui/badge"

export default function ScreeningAgentPage() {
  return (
    <div className="space-y-6 p-4">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <Bot className="size-6 text-brand-purple-600" />
          Screening Agent
        </h1>
        <p className="text-sm text-muted-foreground">
          AI-assisted first-pass candidate screening.
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
