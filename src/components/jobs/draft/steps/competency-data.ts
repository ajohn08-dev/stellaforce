export type ProficiencyLevel = "aware" | "proficient" | "expert"

export type CompetencyType = "technical" | "behavioral" | "hybrid" | "leadership"

export const COMPETENCY_TYPE_LABEL: Record<CompetencyType, string> = {
  technical: "Technical",
  behavioral: "Behavioral",
  hybrid: "Hybrid",
  leadership: "Leadership",
}

export type Competency = {
  id: string
  type: CompetencyType
  description: string
  recommendedLevel: ProficiencyLevel
  selectedLevel: ProficiencyLevel
  levelDescriptions: Record<ProficiencyLevel, string>
  skills: string[]
  tools: string[]
}

/**
 * Seeded with a plausible AI-suggested example so the interaction pattern is
 * visible before real ingestion (competency/skill/tool suggestion from the
 * parsed job description) is wired up. Shared between the Evaluation
 * Criteria and Score Card steps so both reference the same competency list —
 * the score card must not invent competencies beyond this set.
 */
export const INITIAL_COMPETENCIES: Competency[] = [
  {
    id: "internal-tools",
    type: "technical",
    description: "Designs and ships production-ready internal tools",
    recommendedLevel: "proficient",
    selectedLevel: "proficient",
    levelDescriptions: {
      aware:
        "Knows the basic concepts; may have built small internal tools with guidance; can speak about approach but has limited production experience.",
      proficient:
        "Can independently design, build, and ship internal tools in your stack for typical business problems; handles standard edge cases; tools are maintainable and monitored; collaborates with stakeholders on scope.",
      expert:
        "Sets the standard for internal tooling; anticipates edge cases and scale needs before they arise; mentors others and establishes reusable patterns across the team.",
    },
    skills: ["Data modeling", "API design", "Error handling", "Automated tests"],
    tools: ["Supabase", "React", "Postgres", "Git"],
  },
  {
    id: "stakeholder-communication",
    type: "behavioral",
    description:
      "Communicates technical tradeoffs clearly to non-technical stakeholders",
    recommendedLevel: "proficient",
    selectedLevel: "proficient",
    levelDescriptions: {
      aware:
        "Can explain what was built, but leans on others to translate tradeoffs for non-technical audiences.",
      proficient:
        "Frames technical tradeoffs in terms of business impact; adjusts explanations for the audience; handles pushback without getting defensive.",
      expert:
        "Shapes how the org talks about technical risk; trusted to represent engineering in cross-functional decisions.",
    },
    skills: ["Written communication", "Stakeholder management"],
    tools: ["Notion", "Slack"],
  },
]
