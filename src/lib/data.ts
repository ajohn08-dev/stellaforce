import "server-only"

import { createClient } from "@/lib/supabase/server"
import { isSupabaseConfigured } from "@/lib/env"
import type {
  ApplicationRow,
  CandidateRow,
  ClientRow,
  JobOrderRow,
  SkillRow,
} from "@/lib/supabase/types"

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

export async function getCandidates(
  filters: CandidateFilters = {}
): Promise<CandidateRow[]> {
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
    query = query.ilike("contact_info->>location", `%${filters.location}%`)

  const { data, error } = await query
  if (error) {
    console.error("getCandidates error:", error.message)
    return []
  }

  let rows = data ?? []

  // Skill filter requires a join; do a second lookup and filter in memory for
  // the demo (fine at this scale). Structured skill search moves server-side later.
  if (filters.skill) {
    const { data: skillRows } = await supabase
      .from("skills")
      .select("candidate_id")
      .ilike("skill_name", `%${filters.skill}%`)
    const ids = new Set((skillRows ?? []).map((s) => s.candidate_id))
    rows = rows.filter((c) => ids.has(c.candidate_id))
  }

  return rows
}

export async function getCandidate(
  id: string
): Promise<{ candidate: CandidateRow; skills: SkillRow[] } | null> {
  if (!isSupabaseConfigured) return null
  const supabase = await createClient()

  const { data: candidate, error } = await supabase
    .from("candidates")
    .select("*")
    .eq("candidate_id", id)
    .single()

  if (error || !candidate) return null

  const { data: skills } = await supabase
    .from("skills")
    .select("*")
    .eq("candidate_id", id)

  return { candidate, skills: skills ?? [] }
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
