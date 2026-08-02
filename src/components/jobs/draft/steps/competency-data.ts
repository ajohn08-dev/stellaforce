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
