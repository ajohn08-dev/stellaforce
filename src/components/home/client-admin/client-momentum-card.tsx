import { CheckCircle2, TrendingUp } from "lucide-react"

import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { ClientMomentumData } from "@/lib/mock-client-home"

export function ClientMomentumCard({ data }: { data: ClientMomentumData }) {
  return (
    <Card className="h-full" size="sm">
      <CardHeader className="shrink-0">
        <CardTitle>Momentum</CardTitle>
        <CardAction className="self-center">
          <Badge variant="secondary">{data.proofPoints.length + 1}</Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto no-scrollbar">
        <p className="text-sm font-semibold text-foreground">{data.heroText}</p>
        <ul className="flex flex-col gap-1">
          {data.proofPoints.map((point) => (
            <li key={point} className="flex items-start gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span>{point}</span>
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
          <TrendingUp className="size-3.5" />
          {data.trendText}
        </div>
      </CardContent>
    </Card>
  )
}
