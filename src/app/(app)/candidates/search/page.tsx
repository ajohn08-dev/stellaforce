import { notFound } from "next/navigation"

import { AdvancedSearchFilters } from "@/components/candidates/advanced-search-filters"
import { AdvancedSearchResults } from "@/components/candidates/advanced-search-results"
import { SetAdvancedSearchBreadcrumb } from "@/components/candidates/set-advanced-search-breadcrumb"
import { getCurrentProfile } from "@/lib/auth"
import { isStellaforceStaff } from "@/lib/permissions"
import {
  emptyCandidateSearchPage,
  parseCandidateSearchParams,
} from "@/lib/candidate-search"
import { getActiveCanonicalRoles, getCandidateCountryCodes } from "@/lib/data"
import { searchCandidates } from "@/lib/server/candidate-search"

/**
 * Advanced Search — structured candidate search, V1.
 *
 * **Internal only.** Stellaforce-side profiles only; a client-side profile gets
 * `notFound()` rather than a redirect, so the route's existence isn't confirmed
 * to someone who may not have it. The guard is repeated inside
 * `searchCandidates` — the candidate-domain RLS policies are permissive
 * (`USING (true)` for every authenticated user), so nothing below this line is
 * caught by the database if the check is skipped.
 *
 * Filter state lives in the URL, matching `/candidates`. That keeps this a
 * Server Component: `searchParams` in, one query, rendered rows out — no client
 * fetching and no second copy of the filter state.
 *
 * The top header stays (carrying "← Back | Advanced Search"); the main side
 * navigation does not — see `SIDEBAR_HIDDEN_ROUTES` in src/lib/nav.ts.
 *
 * Two doors lead here:
 *
 *   Filter ▸ Advanced Filter   opens on the Filters tab with the list's filters
 *   the ask bar on /candidates arrives with `?q=<phrase>` — the rail opens on
 *                              the AI tab, shows the phrase as already sent,
 *                              and runs it without a second submission
 *
 * `?q=` is read by the rail, not here: it is a handoff, not a filter. Whatever
 * it parses to arrives back as the ordinary six filter params, so this page
 * stays a plain `searchParams` → `searchCandidates` render either way.
 *
 * Note `../@modal/search/page.tsx`: arriving here from /candidates is a soft
 * navigation, so without a static segment in that slot the `(.)[id]`
 * interceptor matches "search" and renders a 404 profile sheet over this page.
 */
export default async function CandidateAdvancedSearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const profile = await getCurrentProfile()
  if (!isStellaforceStaff(profile)) notFound()

  const sp = await searchParams
  const { filters, page, pageSize, hasBlockingIssue, unsupportedNotice } =
    parseCandidateSearchParams(sp)

  // An invalid year range must not run a query. The rail already explains why,
  // beside the field that caused it — so the table simply shows nothing rather
  // than repeating the message or, worse, showing stale results that no longer
  // correspond to what's on screen.
  // The Role options and the query run together: both are read server-side,
  // and only active roles are offered so a retired one can't be picked.
  const [results, canonicalRoles, countryCodes] = await Promise.all([
    hasBlockingIssue
      ? emptyCandidateSearchPage(page, pageSize)
      : searchCandidates(filters, { page, pageSize }),
    getActiveCanonicalRoles(),
    getCandidateCountryCodes(),
  ])

  // Slug → label, so the applied-filter summary can name a role the way the
  // menu did. Built here because the taxonomy is already loaded; the results
  // component never looks anything up.
  const roleLabels = Object.fromEntries(
    canonicalRoles.map((role) => [role.slug, role.label])
  )

  return (
    <div
      className="flex overflow-hidden"
      // Inline style, matching /candidates: <main> has no padding of its own,
      // so only the app header (h-14 = 3.5rem) needs subtracting. Fixed height
      // so the rail and the table body scroll independently and the page
      // itself never does.
      style={{ height: "calc(100vh - 3.5rem)" }}
    >
      <SetAdvancedSearchBreadcrumb />

      <aside className="w-[280px] shrink-0 border-r border-border bg-white dark:bg-white">
        <AdvancedSearchFilters
          canonicalRoles={canonicalRoles}
          countryCodes={countryCodes}
        />
      </aside>

      <div className="min-h-0 min-w-0 flex-1 p-4">
        <AdvancedSearchResults
          page={results}
          filters={filters}
          roleLabels={roleLabels}
          unsupportedNotice={unsupportedNotice}
        />
      </div>
    </div>
  )
}
