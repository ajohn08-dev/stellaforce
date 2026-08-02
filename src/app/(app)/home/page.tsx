import { getCurrentProfile } from "@/lib/auth"
import { GenericHomeOverview } from "@/components/home/generic-home-overview"
import { HomeFilterButton } from "@/components/home/home-filter-button"
import { HomeDateRangePicker } from "@/components/home/home-date-range-picker"
import { MomentumCard } from "@/components/home/momentum-card"
import { TodaysFocusCard } from "@/components/home/todays-focus-card"
import { RisksCard } from "@/components/home/risks-card"
import { BenchStrengthCard } from "@/components/home/bench-strength-card"
import { AgentHealthCard } from "@/components/home/agent-health-card"
import { HomeChatPanel } from "@/components/home/home-chat-panel"
import {
  MOCK_AGENT_HEALTH,
  MOCK_BENCH_STRENGTH,
  MOCK_MOMENTUM,
  MOCK_RISKS,
  MOCK_TODAYS_FOCUS,
  SUGGESTED_PROMPTS,
} from "@/lib/mock-home"

export default async function HomePage() {
  const profile = await getCurrentProfile()
  const isStellaforceRecruiter = profile?.side === "stellaforce" && profile?.role === "recruiter"

  if (!isStellaforceRecruiter) {
    return <GenericHomeOverview />
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col gap-4 overflow-hidden p-4">
      <div className="flex shrink-0 items-center justify-end gap-2">
        <HomeFilterButton />
        <HomeDateRangePicker />
      </div>

      <div className="flex shrink-0 flex-col gap-4 lg:h-[497px] lg:flex-row lg:items-stretch">
        <div className="grid gap-4 lg:w-[300px] lg:shrink-0 lg:grid-rows-2">
          <MomentumCard data={MOCK_MOMENTUM} />
          <RisksCard groups={MOCK_RISKS} />
        </div>

        <div className="lg:min-w-0 lg:flex-1">
          <TodaysFocusCard items={MOCK_TODAYS_FOCUS} />
        </div>

        <div className="grid gap-4 lg:w-[300px] lg:shrink-0 lg:grid-rows-2">
          <BenchStrengthCard data={MOCK_BENCH_STRENGTH} />
          <AgentHealthCard data={MOCK_AGENT_HEALTH} />
        </div>
      </div>

      <div className="min-h-0 flex-1">
        <HomeChatPanel prompts={SUGGESTED_PROMPTS} />
      </div>
    </div>
  )
}
