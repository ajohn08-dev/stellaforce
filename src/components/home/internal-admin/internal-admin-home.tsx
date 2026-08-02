import { HomeDateRangePicker } from "@/components/home/home-date-range-picker"
import { HomeChatPanel } from "@/components/home/home-chat-panel"
import { InternalAdminFilterButton } from "@/components/home/internal-admin/internal-admin-filter-button"
import { InternalAdminMomentumCard } from "@/components/home/internal-admin/internal-admin-momentum-card"
import { InternalAdminTodaysFocusCard } from "@/components/home/internal-admin/internal-admin-todays-focus-card"
import { AdminRisksAccountabilityCard } from "@/components/home/internal-admin/admin-risks-accountability-card"
import { PlatformHealthCard } from "@/components/home/internal-admin/platform-health-card"
import { TeamClientPerformanceCard } from "@/components/home/internal-admin/team-client-performance-card"
import {
  INTERNAL_ADMIN_SUGGESTED_PROMPTS,
  MOCK_ADMIN_RISKS_ACCOUNTABILITY,
  MOCK_INTERNAL_ADMIN_MOMENTUM,
  MOCK_INTERNAL_ADMIN_TODAYS_FOCUS,
  MOCK_PLATFORM_HEALTH,
  MOCK_TEAM_CLIENT_PERFORMANCE,
} from "@/lib/mock-internal-admin-home"

/**
 * Operations-command-center home page for Stellaforce-side internal admins
 * — most of whom are also active recruiters. Same 3-zone shell and
 * component conventions as RecruiterHome/ClientAdminHome (see home.md),
 * reframed around intervention and supervision across recruiters, clients,
 * and the platform itself, in addition to the admin's own recruiting work.
 */
export function InternalAdminHome() {
  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col gap-4 overflow-hidden p-4">
      <div className="flex shrink-0 items-center justify-end gap-2">
        <InternalAdminFilterButton />
        <HomeDateRangePicker />
      </div>

      <div className="flex shrink-0 flex-col gap-4 lg:h-[497px] lg:flex-row lg:items-stretch">
        <div className="grid gap-4 lg:w-[300px] lg:shrink-0 lg:grid-rows-2">
          <InternalAdminMomentumCard data={MOCK_INTERNAL_ADMIN_MOMENTUM} />
          <AdminRisksAccountabilityCard groups={MOCK_ADMIN_RISKS_ACCOUNTABILITY} />
        </div>

        <div className="lg:min-w-0 lg:flex-1">
          <InternalAdminTodaysFocusCard items={MOCK_INTERNAL_ADMIN_TODAYS_FOCUS} />
        </div>

        <div className="grid gap-4 lg:w-[300px] lg:shrink-0 lg:grid-rows-2">
          <PlatformHealthCard data={MOCK_PLATFORM_HEALTH} />
          <TeamClientPerformanceCard data={MOCK_TEAM_CLIENT_PERFORMANCE} />
        </div>
      </div>

      <div className="min-h-0 flex-1">
        <HomeChatPanel prompts={INTERNAL_ADMIN_SUGGESTED_PROMPTS} />
      </div>
    </div>
  )
}
