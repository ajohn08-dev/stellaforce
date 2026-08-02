import { AlertTriangle, Clock, Hourglass, UserX } from "lucide-react"

import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import type {
  RiskAccountabilityGroup,
  RiskAccountabilityGroupKey,
  RiskAccountabilityItem,
} from "@/lib/mock-client-home"

const GROUP_ICON: Record<RiskAccountabilityGroupKey, typeof AlertTriangle> = {
  breaching: AlertTriangle,
  blockedByHm: UserX,
  pendingApproval: Hourglass,
  aging: Clock,
}

type FlatRiskItem = RiskAccountabilityItem & { groupKey: RiskAccountabilityGroupKey; groupLabel: string }

/**
 * Client-admin analog of the recruiter home page's RisksCard, with one
 * addition: each row surfaces its delay owner as an outline badge, since
 * this widget's purpose is to make accountability explicit, not just
 * flag what's late.
 */
export function RisksAccountabilityCard({ groups }: { groups: RiskAccountabilityGroup[] }) {
  const items: FlatRiskItem[] = groups.flatMap((group) =>
    group.items.map((item) => ({ ...item, groupKey: group.key, groupLabel: group.label }))
  )

  return (
    <Card className="h-full" size="sm">
      <CardHeader className="shrink-0">
        <CardTitle>Risks & Accountability</CardTitle>
        <CardAction className="self-center">
          <Badge className="border-transparent bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200">
            {items.length}
          </Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="min-h-0 flex-1 overflow-y-auto no-scrollbar">
        <TooltipProvider>
          <ul className="flex flex-col">
            {items.map((item) => {
              const Icon = GROUP_ICON[item.groupKey]
              return (
                <li
                  key={item.text}
                  className="flex items-start gap-2 border-b border-border py-2 last:border-b-0"
                >
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <span className="mt-0.5 inline-flex shrink-0" aria-label={item.groupLabel}>
                          <Icon className="size-3.5 text-amber-600 dark:text-amber-400" />
                        </span>
                      }
                    />
                    <TooltipContent>{item.groupLabel}</TooltipContent>
                  </Tooltip>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-foreground">{item.text}</p>
                    <p className="truncate text-xs text-muted-foreground">{item.contextText}</p>
                  </div>
                  <Badge variant="outline" className="mt-0.5 shrink-0">
                    {item.owner}
                  </Badge>
                </li>
              )
            })}
          </ul>
        </TooltipProvider>
      </CardContent>
    </Card>
  )
}
