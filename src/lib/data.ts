import "server-only"

import { createClient } from "@/lib/supabase/server"
import { isSupabaseConfigured } from "@/lib/env"
import type {
  ApplicationRow,
  CandidateCertificationRow,
  CandidateEducationRow,
  CandidateRow,
  CandidateSkillWithSkill,
  CandidateWorkExperienceRow,
  ClientRow,
  JobOrderRow,
} from "@/lib/supabase/types"

/** A candidate list row decorated with its current role + primary education —
 * both now live in child tables (candidate_work_experiences/candidate_education)
 * rather than flat columns, so list/grid views need this to render a title/
 * company/education line without a per-row query. */
export type CandidateListItem = CandidateRow & {
  currentRole: { title: string; company_name: string; location: string | null } | null
  primaryEducation: CandidateEducationRow | null
}
import type { WorkHistoryEntry } from "@/lib/work-history"

/**
 * Server-side read helpers used by Server Components. Every function degrades
 * gracefully to empty/null when Supabase isn't configured yet, so the app runs
 * with `pnpm dev` before the project is connected. All reads go through the
 * request-scoped anon client, so RLS applies.
 */

export type CandidateFilters = {
  tiers?: string[]
  skill?: string
  location?: string
  q?: string
}

/** date (YYYY-MM-DD) -> the "YYYY-MM" shape WorkHistoryEntry expects. */
function toWorkHistoryEntry(row: CandidateWorkExperienceRow): WorkHistoryEntry {
  return {
    company: row.company_name,
    title: row.title,
    location: row.location ?? undefined,
    start_date: row.start_date.slice(0, 7),
    end_date: row.end_date ? row.end_date.slice(0, 7) : null,
    description: row.description ?? undefined,
  }
}

export async function getCandidates(
  filters: CandidateFilters = {}
): Promise<CandidateListItem[]> {
  if (!isSupabaseConfigured) return []
  const supabase = await createClient()

  let query = supabase
    .from("candidates")
    .select("*")
    .order("date_added", { ascending: false })

  if (filters.tiers && filters.tiers.length > 0)
    query = query.in(
      "candidate_tier",
      filters.tiers as NonNullable<CandidateRow["candidate_tier"]>[]
    )
  if (filters.q) query = query.ilike("full_name", `%${filters.q}%`)
  if (filters.location)
    query = query.ilike("location_raw", `%${filters.location}%`)

  const { data, error } = await query
  if (error) {
    console.error("getCandidates error:", error.message)
    return []
  }

  let rows = data ?? []

  // Skill filter requires two joins (skills -> candidate_skills); do the
  // lookup and filter in memory for the demo (fine at this scale). Structured
  // skill search moves server-side later.
  if (filters.skill) {
    const { data: matchingSkills } = await supabase
      .from("skills")
      .select("id")
      .ilike("name", `%${filters.skill}%`)
    const skillIds = (matchingSkills ?? []).map((s) => s.id)

    let ids = new Set<string>()
    if (skillIds.length > 0) {
      const { data: candidateSkillRows } = await supabase
        .from("candidate_skills")
        .select("candidate_id")
        .in("skill_id", skillIds)
      ids = new Set((candidateSkillRows ?? []).map((r) => r.candidate_id))
    }
    rows = rows.filter((c) => ids.has(c.candidate_id))
  }

  const candidateIds = rows.map((c) => c.candidate_id)
  const roleByCandidate = new Map<
    string,
    { title: string; company_name: string; location: string | null }
  >()
  const educationByCandidate = new Map<string, CandidateEducationRow>()

  if (candidateIds.length > 0) {
    const [{ data: currentRoles }, { data: educationRows }] = await Promise.all([
      supabase
        .from("candidate_work_experiences")
        .select("candidate_id, title, company_name, location")
        .in("candidate_id", candidateIds)
        .eq("display_order", 0),
      supabase
        .from("candidate_education")
        .select("*")
        .in("candidate_id", candidateIds)
        .order("created_at", { ascending: true }),
    ])

    for (const r of currentRoles ?? [])
      roleByCandidate.set(r.candidate_id, r)
    for (const e of educationRows ?? [])
      if (!educationByCandidate.has(e.candidate_id))
        educationByCandidate.set(e.candidate_id, e)
  }

  return rows.map((c) => ({
    ...c,
    currentRole: roleByCandidate.get(c.candidate_id) ?? null,
    primaryEducation: educationByCandidate.get(c.candidate_id) ?? null,
  }))
}

export type AddedByProfile = { full_name: string | null; email: string }

export async function getCandidate(id: string): Promise<{
  candidate: CandidateRow
  skills: CandidateSkillWithSkill[]
  education: CandidateEducationRow[]
  certifications: CandidateCertificationRow[]
  workHistory: WorkHistoryEntry[]
  addedBy: AddedByProfile | null
} | null> {
  if (!isSupabaseConfigured) return null
  const supabase = await createClient()

  const { data: candidate, error } = await supabase
    .from("candidates")
    .select("*, added_by_profile:profiles(full_name, email)")
    .eq("candidate_id", id)
    .single()

  if (error || !candidate) return null

  const { added_by_profile: addedBy, ...candidateFields } = candidate as CandidateRow & {
    added_by_profile: AddedByProfile | null
  }

  const { data: skills } = await supabase
    .from("candidate_skills")
    .select("*, skill:skills(name, skill_type, category)")
    .eq("candidate_id", id)

  const { data: education } = await supabase
    .from("candidate_education")
    .select("*")
    .eq("candidate_id", id)

  const { data: certifications } = await supabase
    .from("candidate_certifications")
    .select("*")
    .eq("candidate_id", id)

  const { data: workExperiences } = await supabase
    .from("candidate_work_experiences")
    .select("*")
    .eq("candidate_id", id)
    .order("display_order", { ascending: true })

  return {
    candidate: candidateFields,
    skills: (skills ?? []) as CandidateSkillWithSkill[],
    education: education ?? [],
    certifications: certifications ?? [],
    workHistory: (workExperiences ?? []).map(toWorkHistoryEntry),
    addedBy,
  }
}

export async function getClients(): Promise<ClientRow[]> {
  if (!isSupabaseConfigured) return []
  const supabase = await createClient()
  const { data } = await supabase
    .from("clients")
    .select("*")
    .order("client_name")
  return data ?? []
}

export async function getJobOrders(): Promise<
  (JobOrderRow & { client: ClientRow | null })[]
> {
  if (!isSupabaseConfigured) return []
  const supabase = await createClient()
  const { data } = await supabase
    .from("job_orders")
    .select("*, client:clients(*)")
    .order("created_at", { ascending: false })
  return (data ?? []) as (JobOrderRow & { client: ClientRow | null })[]
}

export async function getJobOrder(id: string): Promise<
  | (JobOrderRow & {
      client: ClientRow | null
      applications: (ApplicationRow & { candidate: CandidateRow | null })[]
    })
  | null
> {
  if (!isSupabaseConfigured) return null
  const supabase = await createClient()

  const { data: job, error } = await supabase
    .from("job_orders")
    .select("*, client:clients(*)")
    .eq("job_id", id)
    .single()

  if (error || !job) return null

  const { data: applications } = await supabase
    .from("applications")
    .select("*, candidate:candidates(*)")
    .eq("job_id", id)
    .order("date_applied", { ascending: false })

  return {
    ...(job as JobOrderRow & { client: ClientRow | null }),
    applications: (applications ?? []) as (ApplicationRow & {
      candidate: CandidateRow | null
    })[],
  }
}
