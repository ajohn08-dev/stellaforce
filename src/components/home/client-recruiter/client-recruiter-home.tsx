import { HomeFilterButton } from "@/components/home/home-filter-button"
import { HomeDateRangePicker } from "@/components/home/home-date-range-picker"
import { HomeChatPanel } from "@/components/home/home-chat-panel"
import { MultiSelectFilterChip } from "@/components/home/multi-select-filter-chip"
import { ClientRecruiterMomentumCard } from "@/components/home/client-recruiter/client-recruiter-momentum-card"
import { ClientRecruiterTodaysFocusCard } from "@/components/home/client-recruiter/client-recruiter-todays-focus-card"
import { ClientRecruiterRisksAccountabilityCard } from "@/components/home/client-recruiter/client-recruiter-risks-accountability-card"
import { ClientRecruiterCoverageCard } from "@/components/home/client-recruiter/client-recruiter-coverage-card"
import { FunnelHealthCard } from "@/components/home/client-recruiter/funnel-health-card"
import {
  CLIENT_RECRUITER_SUGGESTED_PROMPTS,
  MOCK_CLIENT_RECRUITER_COVERAGE,
  MOCK_CLIENT_RECRUITER_MOMENTUM,
  MOCK_CLIENT_RECRUITER_RISKS,
  MOCK_CLIENT_RECRUITER_TODAYS_FOCUS,
  MOCK_FUNNEL_HEALTH,
} from "@/lib/mock-client-recruiter-home"

/**
 * Client-delivery-workbench home page for client-side recruiters
 * (client_role = 'recruiter'), who manage recruiting delivery across one or
 * more client accounts. Same 3-zone shell and component conventions as
 * RecruiterHome/ClientAdminHome/InternalAdminHome (see home.md), reframed
 * around follow-up, progression, and blocker resolution across accounts.
 * Reuses HomeFilterButton unchanged — its Client/Req fields already fit a
 * multi-account recruiter, unlike the client-admin view (scoped to one
 * client already).
 */
const ROLE_FILTER_OPTIONS = ["Product Designer", "Marketing Manager", "Backend Engineer", "Customer Success"]

export function ClientRecruiterHome() {
  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col gap-4 overflow-hidden p-4">
      <div className="flex shrink-0 items-center justify-between gap-2">
        <MultiSelectFilterChip label="Roles" options={ROLE_FILTER_OPTIONS} />
        <div className="flex items-center gap-2">
          <HomeFilterButton />
          <HomeDateRangePicker />
        </div>
      </div>

      <div className="flex shrink-0 flex-col gap-4 lg:h-[497px] lg:flex-row lg:items-stretch">
        <div className="grid gap-4 lg:w-[300px] lg:shrink-0 lg:grid-rows-2">
          <ClientRecruiterMomentumCard data={MOCK_CLIENT_RECRUITER_MOMENTUM} />
          <ClientRecruiterRisksAccountabilityCard groups={MOCK_CLIENT_RECRUITER_RISKS} />
        </div>

        <div className="lg:min-w-0 lg:flex-1">
          <ClientRecruiterTodaysFocusCard items={MOCK_CLIENT_RECRUITER_TODAYS_FOCUS} />
        </div>

        <div className="grid gap-4 lg:w-[300px] lg:shrink-0 lg:grid-rows-2">
          <ClientRecruiterCoverageCard data={MOCK_CLIENT_RECRUITER_COVERAGE} />
          <FunnelHealthCard data={MOCK_FUNNEL_HEALTH} />
        </div>
      </div>

      <div className="min-h-0 flex-1">
        <HomeChatPanel prompts={CLIENT_RECRUITER_SUGGESTED_PROMPTS} />
      </div>
    </div>
  )
}
