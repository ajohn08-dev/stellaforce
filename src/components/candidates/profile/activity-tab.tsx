import { Mail, MessageSquare, Phone, Users, type LucideIcon } from "lucide-react"

import { titleCase } from "@/lib/constants"
import { MOCK_ACTIVITY } from "@/lib/mock-activity"
import type { InteractionType } from "@/lib/supabase/types"

const ICONS: Record<InteractionType, LucideIcon> = {
  call: Phone,
  email: Mail,
  note: MessageSquare,
  interview: Users,
}

function formatActivityDate(at: string): string {
  return new Date(at).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

export function ActivityTab({ candidateId }: { candidateId: string }) {
  const entries = [...(MOCK_ACTIVITY[candidateId] ?? [])].sort((a, b) =>
    b.at.localeCompare(a.at)
  )

  if (entries.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
    )
  }

  return (
    <div className="space-y-4">
      {entries.map((entry, i) => {
        const Icon = ICONS[entry.type]
        return (
          <div key={i} className="flex gap-3">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted">
              <Icon className="size-4 text-muted-foreground" />
            </div>
            <div className="flex-1 space-y-0.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">{titleCase(entry.type)}</span>
                <span className="text-xs text-muted-foreground">
                  {formatActivityDate(entry.at)}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">{entry.body}</p>
              <p className="text-xs text-muted-foreground">{entry.author}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
