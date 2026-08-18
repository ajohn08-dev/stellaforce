import type { ReadinessStatus } from "@/lib/company-readiness"
import type { CompanyStage } from "@/lib/mock-companies"

/**
 * The view model both company views render from — deliberately flat and narrow,
 * so the server page computes readiness once and hands down a summary rather
 * than three full `Company` objects with their whole knowledge graph attached.
 *
 * Lives in its own module because the table and the card grid both need it and
 * each other's imports would otherwise cross.
 */
export type CompanyListItem = {
  id: string
  name: string
  logoPath: string | null
  industry: string | null
  stage: CompanyStage | null
  headquarters: string | null
  accountOwner: string
  activeJobCount: number
  completeness: number
  readiness: ReadinessStatus
  readinessHeadline: string
  lastVerified: string | null
}
