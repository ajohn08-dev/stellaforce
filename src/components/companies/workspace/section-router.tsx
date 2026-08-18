import { ActivitySection } from "@/components/companies/workspace/sections/activity-section"
import { BriefSection } from "@/components/companies/workspace/sections/brief-section"
import { JobsSection } from "@/components/companies/workspace/sections/jobs-section"
import { NarrativeSection } from "@/components/companies/workspace/sections/narrative-section"
import { PolicySection } from "@/components/companies/workspace/sections/policy-section"
import { ProfileSection } from "@/components/companies/workspace/sections/profile-section"
import { TeamsSection } from "@/components/companies/workspace/sections/teams-section"
import { UnansweredSection } from "@/components/companies/workspace/sections/unanswered-section"
import type { SectionDef } from "@/components/companies/workspace/company-sections"
import type { CompanyReadiness } from "@/lib/company-readiness"
import type { Company } from "@/lib/mock-companies"

/**
 * Maps the `?section=` param onto a section component. Kept as its own module so
 * the page stays a thin server shell and the switch has one obvious home.
 */
export function SectionRouter({
  company,
  section,
  readiness,
  today,
  drill,
}: {
  company: Company
  section: SectionDef
  readiness: CompanyReadiness
  today: Date
  /** Sub-selection within a drillable section. */
  drill: { team?: string; job?: string }
}) {
  const common = { company, section, readiness, today }

  switch (section.key) {
    case "profile":
      return <ProfileSection {...common} />

    case "what-they-do":
    case "culture":
    case "why-join":
      return <NarrativeSection {...common} />

    case "locations":
      return (
        <PolicySection
          {...common}
          groups={["employment", "mobility"]}
          emptyPrompt="Remote and office questions are the most common thing candidates ask. Without this, agents escalate all of them."
          questionsEmptyPrompt="Nothing recorded yet. Questions about remote work, office days, and travel belong here."
        />
      )

    case "benefits":
      return (
        <PolicySection
          {...common}
          groups={["benefits"]}
          emptyPrompt="Nothing entered yet, so agents will escalate every benefits question. Note that 'not entered' and 'not offered' are different answers."
          questionsEmptyPrompt="Nothing recorded yet. Questions about health cover, leave, equity, and perks belong here."
        />
      )

    case "work-authorization":
      return (
        <PolicySection
          {...common}
          groups={["immigration"]}
          restrictedKeys={["sponsorship_budget"]}
          standingProhibition="The agent may never guarantee or imply visa sponsorship, visa eligibility, or any immigration outcome or timeline."
          emptyPrompt="Every immigration item needs an explicit value. Until work authorization is confirmed, candidate agents can't be deployed at all."
          questionsEmptyPrompt="Nothing recorded yet. This is the highest-risk topic an agent can get wrong — an approved answer here is worth writing carefully."
        />
      )

    case "compensation":
      return (
        <PolicySection
          {...common}
          groups={["compensation", "internal"]}
          restrictedKeys={["offer_exceptions", "sponsorship_budget"]}
          standingProhibition="The agent may never confirm a figure, suggest a number is negotiable, or imply an exception is possible."
          emptyPrompt="Record how this company talks about pay — the philosophy, not a number."
          questionsEmptyPrompt="Nothing recorded yet. Questions about pay philosophy, bands, and transparency belong here."
        />
      )

    case "teams":
      return <TeamsSection {...common} teamId={drill.team} />

    case "jobs":
      return <JobsSection {...common} jobId={drill.job} />

    case "unanswered":
      return <UnansweredSection {...common} />

    case "brief":
      return <BriefSection {...common} />

    case "activity":
      return <ActivitySection {...common} />
  }
}
