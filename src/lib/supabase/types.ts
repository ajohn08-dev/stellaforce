/**
 * Hand-authored database types matching the frozen schema in CLAUDE.md and
 * supabase/migrations/. Keep in sync with migrations. Once the Supabase project
 * is connected you can regenerate this with:
 *
 *   supabase gen types typescript --project-id <ref> > src/lib/supabase/types.ts
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

// ── Enums ────────────────────────────────────────────────────────────────────
export type CandidateTier = "gold" | "silver" | "bronze"
export type DataProvenance = "ai_parsed" | "recruiter_confirmed" | "enriched"
export type SkillType = "hard" | "soft"
export type ProficiencyLevel =
  | "novice"
  | "beginner"
  | "intermediate"
  | "advanced"
  | "expert"
export type ClientStatus = "active" | "paused" | "churned"
export type JobStatus = "open" | "on_hold" | "filled" | "closed"
export type ApplicationStage =
  | "sourced"
  | "screened"
  | "submitted"
  | "interviewing"
  | "offer"
  | "placed"
  | "rejected"
export type PlacementStatus = "active" | "completed" | "fell_through"
export type InteractionType = "call" | "email" | "interview" | "note"
export type NurtureStatus = "active" | "dormant" | "re_engaging"
export type UserRole = "recruiter" | "manager" | "admin"

// ── Domain JSON shapes (advisory; columns are jsonb) ─────────────────────────
export type ContactInfo = {
  email?: string
  phone?: string
  location?: string
  tz?: string
}

export type AiLiteracySignal = {
  tool_used?: string
  how_used?: string
  measurable_outcome?: string
}

export type SalaryRange = {
  min?: number
  max?: number
  currency?: string
  period?: "year" | "hour" | "month"
}

export type EducationEntry = {
  degree?: string
  field_of_study?: string
  institution?: string
  end_date?: string
}

// ── Table row types ──────────────────────────────────────────────────────────
export type CandidateRow = {
  candidate_id: string
  full_name: string
  contact_info: ContactInfo | null
  linkedin_url: string | null
  portfolio_url: string | null
  current_title: string | null
  current_company: string | null
  years_experience: number | null
  education: Json | null
  certifications: Json | null
  languages: string[] | null
  professional_summary: string | null
  source: string | null
  candidate_tier: CandidateTier | null
  tier_rationale: string | null
  embedding_vector: string | null // pgvector serialized as string over the wire
  data_provenance: DataProvenance
  freshness_score: number | null
  last_verified: string | null
  date_added: string
  last_updated: string
  created_at: string
  updated_at: string
}

export type SkillRow = {
  skill_id: string
  candidate_id: string
  skill_name: string
  skill_type: SkillType
  proficiency_level: ProficiencyLevel | null
  assessment_score: number | null
  scorecard: Json | null
  ai_literacy_signal: AiLiteracySignal | null
  created_at: string
  updated_at: string
}

export type ClientRow = {
  client_id: string
  client_name: string
  status: ClientStatus
  notes: string | null
  created_at: string
  updated_at: string
}

export type JobOrderRow = {
  job_id: string
  client_id: string
  title: string
  description: string | null
  required_skills: string[] | null
  salary_range: SalaryRange | null
  status: JobStatus
  created_at: string
  updated_at: string
}

export type ApplicationRow = {
  application_id: string
  candidate_id: string
  job_id: string
  client_id: string
  stage: ApplicationStage
  status_reason: string | null
  human_review_flag: boolean
  date_applied: string
  date_updated: string
  created_at: string
  updated_at: string
}

export type PlacementRow = {
  placement_id: string
  candidate_id: string
  client_id: string
  job_id: string
  role_placed: string | null
  salary: number | null
  placement_date: string | null
  guarantee_period: string | null
  status: PlacementStatus
  created_at: string
  updated_at: string
}

export type InteractionRow = {
  interaction_id: string
  candidate_id: string
  type: InteractionType
  body: string | null
  interaction_at: string
  communication_preferences: Json | null
  consent: boolean
  relationship_strength: number | null
  nurture_status: NurtureStatus
  created_at: string
  updated_at: string
}

export type CandidateClientFitRow = {
  id: string
  candidate_id: string
  client_id: string
  fit_score: number | null
  rationale: string | null
  created_at: string
  updated_at: string
}

export type ProfileRow = {
  id: string
  email: string
  full_name: string | null
  role: UserRole
  created_at: string
  updated_at: string
}

// Helper: an Insert shape — everything optional except the truly-required
// (NOT NULL, no default) columns listed in Req.
type Insert<T, Req extends keyof T> = Partial<T> & Pick<T, Req>

export type Database = {
  public: {
    Tables: {
      candidates: {
        Row: CandidateRow
        Insert: Insert<CandidateRow, "full_name">
        Update: Partial<CandidateRow>
        Relationships: []
      }
      skills: {
        Row: SkillRow
        Insert: Insert<SkillRow, "candidate_id" | "skill_name" | "skill_type">
        Update: Partial<SkillRow>
        Relationships: []
      }
      clients: {
        Row: ClientRow
        Insert: Insert<ClientRow, "client_name">
        Update: Partial<ClientRow>
        Relationships: []
      }
      job_orders: {
        Row: JobOrderRow
        Insert: Insert<JobOrderRow, "client_id" | "title">
        Update: Partial<JobOrderRow>
        Relationships: []
      }
      applications: {
        Row: ApplicationRow
        Insert: Insert<ApplicationRow, "candidate_id" | "job_id" | "client_id">
        Update: Partial<ApplicationRow>
        Relationships: []
      }
      placements: {
        Row: PlacementRow
        Insert: Insert<PlacementRow, "candidate_id" | "client_id" | "job_id">
        Update: Partial<PlacementRow>
        Relationships: []
      }
      interactions: {
        Row: InteractionRow
        Insert: Insert<InteractionRow, "candidate_id" | "type">
        Update: Partial<InteractionRow>
        Relationships: []
      }
      candidate_client_fit: {
        Row: CandidateClientFitRow
        Insert: Insert<CandidateClientFitRow, "candidate_id" | "client_id">
        Update: Partial<CandidateClientFitRow>
        Relationships: []
      }
      profiles: {
        Row: ProfileRow
        Insert: Insert<ProfileRow, "id" | "email">
        Update: Partial<ProfileRow>
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: {
      candidate_tier: CandidateTier
      data_provenance: DataProvenance
      skill_type: SkillType
      proficiency_level: ProficiencyLevel
      client_status: ClientStatus
      job_status: JobStatus
      application_stage: ApplicationStage
      placement_status: PlacementStatus
      interaction_type: InteractionType
      nurture_status: NurtureStatus
      user_role: UserRole
    }
    CompositeTypes: Record<string, never>
  }
}
