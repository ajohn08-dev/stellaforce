import type { CompanySection } from "@/lib/company-readiness"
import type { Clearance } from "@/lib/company-visibility"

/**
 * The left-rail structure — the single source of truth for section order,
 * labels, grouping, and each section's clearance.
 *
 * Four collapsible groups, collapsed by default except the one you're in, plus a
 * standalone Unanswered inbox. Fifteen flat items in five always-open groups was
 * more navigation than content; this reads as four things a recruiter already has
 * a mental model for.
 *
 * Names are the words an HR or recruiting person says out loud. Earlier passes
 * used "Narrative", "Policies", and "Working here" — none of which anyone could
 * decode without being told, and the first reads as marketing for a knowledge
 * base that must be accurate.
 */

export type SectionDef = {
  key: CompanySection
  label: string
  /** One line under the section title explaining what belongs here. */
  purpose: string
  clearance: Clearance
  /** True when the section drills into a child (department, job). */
  drillable?: boolean
}

export type SectionGroup = {
  key: string
  label: string
  /** Internal groups get a divider and stay visually distinct. */
  internal?: boolean
  sections: SectionDef[]
}

export const SECTION_GROUPS: SectionGroup[] = [
  {
    key: "about",
    label: "About the company",
    sections: [
      {
        key: "profile",
        label: "Profile",
        purpose: "Who this company is — the facts every job and agent starts from.",
        clearance: "cleared_for_candidates",
      },
      {
        key: "what-they-do",
        label: "What they do",
        purpose:
          "The description, product, customers, and story an agent uses to introduce the company.",
        clearance: "cleared_for_candidates",
      },
      {
        key: "culture",
        label: "Culture & working style",
        purpose:
          "How people actually work here, and what the company offers someone weighing a competing offer.",
        clearance: "cleared_for_candidates",
      },
      {
        key: "why-hiring",
        label: "Why they're hiring",
        purpose:
          "What changed at the company, what makes it distinct, and why now — asked in almost every screen.",
        clearance: "cleared_for_candidates",
      },
    ],
  },
  {
    key: "pay-benefits",
    label: "Pay, benefits & policies",
    sections: [
      {
        key: "locations",
        label: "Locations & work model",
        purpose:
          "Where people work, how often they're in an office, and where the company can hire.",
        clearance: "cleared_for_candidates",
      },
      {
        key: "benefits",
        label: "Benefits",
        purpose:
          "Health, leave, retirement, equity, and perks — with the exact wording candidates hear.",
        clearance: "cleared_for_candidates",
      },
      {
        key: "work-authorization",
        label: "Work authorization",
        purpose:
          "Sponsorship and visa policy. Every value is explicit; anything unconfirmed routes to you.",
        clearance: "cleared_for_candidates",
      },
      {
        key: "compensation",
        label: "Compensation approach",
        purpose:
          "How the company pays and what it will say about it. Never a specific number.",
        clearance: "cleared_for_candidates",
      },
    ],
  },
  {
    key: "teams-hiring",
    label: "Teams & hiring",
    sections: [
      {
        key: "teams",
        label: "Departments & teams",
        purpose: "Created only when a job needs context the company profile can't provide.",
        clearance: "cleared_for_candidates",
        drillable: true,
      },
      {
        key: "jobs",
        // "Open jobs" named a filter the list never applied — it showed every
        // status, and the rail counted open + draft. The app says "Jobs"
        // everywhere else; a third word for one thing helped nobody.
        label: "Jobs",
        purpose:
          "Which jobs this company's knowledge feeds, what each one is still missing, and what it overrides.",
        clearance: "cleared_for_candidates",
        drillable: true,
      },
      {
        key: "interview-process",
        label: "Interview process",
        // The stages belong to the job, which snapshots its own pipeline at
        // publish. What's company-level is the fallback for a conversation with
        // no role in play — so the purpose line says that rather than promising
        // a single process this company doesn't have.
        purpose:
          "Each role runs its own pipeline. This is what a candidate hears when no role is in play — and never a commitment.",
        clearance: "cleared_for_candidates",
      },
    ],
  },
  {
    key: "internal",
    label: "Internal notes",
    internal: true,
    sections: [
      {
        key: "brief",
        label: "Recruiter brief",
        purpose:
          "Account strategy, hiring-manager preferences, and search constraints. None of it reaches candidates.",
        clearance: "recruiters_only",
      },
      {
        key: "activity",
        label: "Activity log",
        purpose: "Every change and verification, append-only.",
        clearance: "recruiters_only",
      },
    ],
  },
]

/**
 * Sits above the groups on its own, because it's an inbox rather than reference
 * material — questions candidates asked that nothing here could answer.
 */
export const INBOX_SECTION: SectionDef = {
  key: "unanswered",
  label: "Unanswered questions",
  purpose: "What candidates asked that approved knowledge couldn't cover.",
  clearance: "cleared_for_candidates",
}

export const ALL_SECTIONS: SectionDef[] = [
  INBOX_SECTION,
  ...SECTION_GROUPS.flatMap((g) => g.sections),
]

export const DEFAULT_SECTION: CompanySection = "profile"

export function findSection(key: string | undefined): SectionDef {
  return (
    ALL_SECTIONS.find((s) => s.key === key) ??
    ALL_SECTIONS.find((s) => s.key === DEFAULT_SECTION)!
  )
}

/** The group a section belongs to, so the rail can open it on load. */
export function groupKeyForSection(key: CompanySection): string | null {
  return SECTION_GROUPS.find((g) => g.sections.some((s) => s.key === key))?.key ?? null
}

/** Section keys that only internal staff may see. */
export const INTERNAL_SECTIONS: CompanySection[] = SECTION_GROUPS.filter(
  (g) => g.internal
).flatMap((g) => g.sections.map((s) => s.key))
