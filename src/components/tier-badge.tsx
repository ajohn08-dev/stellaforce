import { Badge } from "@/components/ui/badge"
import { TIER_BADGE_CLASS, titleCase } from "@/lib/constants"
import { cn } from "@/lib/utils"
import type { CandidateTier } from "@/lib/supabase/types"

export function TierBadge({ tier }: { tier: CandidateTier | null }) {
  if (!tier) return <span className="text-muted-foreground text-sm">—</span>
  return (
    <Badge className={cn("border-transparent", TIER_BADGE_CLASS[tier])}>
      {titleCase(tier)}
    </Badge>
  )
}
