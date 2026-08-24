import { MOCK_COMPANIES, type Company } from "@/lib/mock-companies"
import type { ProfileSide } from "@/lib/supabase/types"

/**
 * Who a viewer may see in the company knowledge base.
 *
 * Stellaforce-side staff work across every account, so they get the list and
 * every profile. **Client-side profiles see exactly one company — their own —
 * and nothing anywhere may imply otherwise**: no list, no count of other
 * accounts, no "Companies" plural in the nav, no breadcrumb back to an index
 * they can't open. For them the destination is a single page about themselves,
 * so it's named `Company Profile` and linked straight to it.
 *
 * ⚠️ The client→company join doesn't exist yet. Company profiles are mock
 * (`src/lib/mock-companies.ts`) and share no key with `clients` — see the
 * warning in CLAUDE.md. Until the DB pass, a client is matched to a profile
 * **by name**, and when nothing matches it falls back to the first fixture
 * carrying the client's real name (`isStandIn`), so the page a client-side
 * user lands on is at least titled with their own organization rather than
 * someone else's. That fallback is a scaffold for the UI, not a permission
 * model: real isolation is RLS on `clients`/`companies`, and none of this is a
 * substitute for it.
 */
export type CompanyAccess =
  | { scope: "all" }
  | { scope: "own"; companyId: string; companyName: string }

/** The minimum a viewer has to carry — structural so client components can use it too. */
export type CompanyViewer = {
  side: ProfileSide
  client_name: string | null
} | null

function matchCompany(clientName: string | null): Company {
  const needle = clientName?.trim().toLowerCase()
  const hit = needle
    ? MOCK_COMPANIES.find(
        (c) =>
          c.preferredName.toLowerCase() === needle || c.legalName?.toLowerCase() === needle
      )
    : undefined
  return hit ?? MOCK_COMPANIES[0]
}

export function companyAccessFor(viewer: CompanyViewer): CompanyAccess {
  // No profile resolved (signed out, or a request that never reaches the app
  // shell) is treated as Stellaforce-side, matching every other nav surface —
  // `src/proxy.ts` has already redirected anyone who isn't signed in.
  if (!viewer || viewer.side === "stellaforce") return { scope: "all" }
  const company = matchCompany(viewer.client_name)
  return {
    scope: "own",
    companyId: company.id,
    companyName: viewer.client_name ?? company.preferredName,
  }
}

/**
 * The company a client-side viewer is looking at, with its identity replaced by
 * the client's real name when the fixture is only standing in — so nobody is
 * shown another customer's name on a page that is supposed to be about them.
 */
export function ownCompanyFor(viewer: CompanyViewer): Company | null {
  const access = companyAccessFor(viewer)
  if (access.scope === "all") return null
  const company = matchCompany(viewer?.client_name ?? null)
  if (company.preferredName === access.companyName) return company
  return { ...company, preferredName: access.companyName, legalName: null }
}
