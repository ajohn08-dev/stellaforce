import { HomeDateRangePicker } from "@/components/home/home-date-range-picker"
import { HomeChatPanel } from "@/components/home/home-chat-panel"
import { ClientHomeFilterButton } from "@/components/home/client-admin/client-home-filter-button"
import { ClientMomentumCard } from "@/components/home/client-admin/client-momentum-card"
import { ClientTodaysFocusCard } from "@/components/home/client-admin/client-todays-focus-card"
import { RisksAccountabilityCard } from "@/components/home/client-admin/risks-accountability-card"
import { CoverageCard } from "@/components/home/client-admin/coverage-card"
import { HiringPerformanceCard } from "@/components/home/client-admin/hiring-performance-card"
import {
  CLIENT_SUGGESTED_PROMPTS,
  MOCK_CLIENT_MOMENTUM,
  MOCK_CLIENT_TODAYS_FOCUS,
  MOCK_COVERAGE,
  MOCK_HIRING_PERFORMANCE,
  MOCK_RISKS_ACCOUNTABILITY,
} from "@/lib/mock-client-home"

/**
 * Oversight-console home page for client-side admins. Same 3-zone shell and
 * component conventions as RecruiterHome (see home.md), reframed around
 * decisions/approvals and accountability instead of recruiter execution.
 */
export function ClientAdminHome() {
  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col gap-4 overflow-hidden p-4">
      <div className="flex shrink-0 items-center justify-end gap-2">
        <ClientHomeFilterButton />
        <HomeDateRangePicker />
      </div>

      <div className="flex shrink-0 flex-col gap-4 lg:h-[497px] lg:flex-row lg:items-stretch">
        <div className="grid gap-4 lg:w-[300px] lg:shrink-0 lg:grid-rows-2">
          <ClientMomentumCard data={MOCK_CLIENT_MOMENTUM} />
          <RisksAccountabilityCard groups={MOCK_RISKS_ACCOUNTABILITY} />
        </div>

        <div className="lg:min-w-0 lg:flex-1">
          <ClientTodaysFocusCard items={MOCK_CLIENT_TODAYS_FOCUS} />
        </div>

        <div className="grid gap-4 lg:w-[300px] lg:shrink-0 lg:grid-rows-2">
          <CoverageCard data={MOCK_COVERAGE} />
          <HiringPerformanceCard data={MOCK_HIRING_PERFORMANCE} />
        </div>
      </div>

      <div className="min-h-0 flex-1">
        <HomeChatPanel prompts={CLIENT_SUGGESTED_PROMPTS} />
      </div>
    </div>
  )
}
