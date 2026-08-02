import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { ClientFocusItem } from "@/lib/mock-client-home"

function FocusItemRow({ item, rank }: { item: ClientFocusItem; rank: number }) {
  return (
    <li className="flex items-center justify-between gap-4 border-b border-border py-2 transition-colors last:border-b-0 hover:bg-muted/30">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-foreground">{item.primaryText}</p>
        <p className="truncate text-xs text-muted-foreground">{item.contextText}</p>
      </div>
      <Button
        type="button"
        size="sm"
        variant={rank === 1 ? "default" : "outline"}
        className="shrink-0"
      >
        {item.cta}
      </Button>
    </li>
  )
}

export function ClientTodaysFocusCard({ items }: { items: ClientFocusItem[] }) {
  return (
    <Card className="h-full" size="sm">
      <CardHeader className="shrink-0">
        <CardTitle>Today&apos;s Focus</CardTitle>
        <CardAction className="self-center">
          <Badge variant="secondary">{items.length}</Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="min-h-0 flex-1 overflow-y-auto no-scrollbar">
        <ul className="flex flex-col">
          {items.map((item, index) => (
            <FocusItemRow key={item.id} item={item} rank={index + 1} />
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
