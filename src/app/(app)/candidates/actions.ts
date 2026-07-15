"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { createClient } from "@/lib/supabase/server"
import {
  candidateEmbeddingText,
  generateEmbedding,
  toPgVector,
} from "@/lib/ai/embeddings"
import { parseCandidateText, type ParsedCandidate } from "@/lib/ai/parse"
import type { CandidateTier } from "@/lib/supabase/types"

/**
 * Server Actions for the two foundational candidate workflows.
 *
 * Writes use the request-scoped, RLS-respecting server client so they run as
 * the signed-in recruiter's session.
 */

export type ActionResult = { ok: true } | { ok: false; error: string }

// ── Workflow 1: ADD CANDIDATE (manual) ───────────────────────────────────────
export async function addCandidate(formData: FormData): Promise<void> {
  const full_name = String(formData.get("full_name") ?? "").trim()
  if (!full_name) throw new Error("Full name is required.")

  const contact_info = {
    email: String(formData.get("email") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    location: String(formData.get("location") ?? ""),
    tz: String(formData.get("tz") ?? ""),
  }
  const current_title = String(formData.get("current_title") ?? "")
  const current_company = String(formData.get("current_company") ?? "")
  const professional_summary = String(formData.get("professional_summary") ?? "")
  const yearsRaw = String(formData.get("years_experience") ?? "")
  const years_experience = yearsRaw ? Number(yearsRaw) : null
  const tier = String(formData.get("candidate_tier") ?? "")
  const candidate_tier = (tier || null) as CandidateTier | null

  const embedding = await generateEmbedding(
    candidateEmbeddingText({
      full_name,
      current_title,
      professional_summary,
    })
  )

  const supabase = await createClient()
  const { error } = await supabase.from("candidates").insert({
    full_name,
    contact_info,
    current_title: current_title || null,
    current_company: current_company || null,
    professional_summary: professional_summary || null,
    years_experience,
    candidate_tier,
    source: "manual_entry",
    data_provenance: "recruiter_confirmed",
    freshness_score: 1.0,
    last_verified: new Date().toISOString(),
    embedding_vector: toPgVector(embedding),
  })

  if (error) throw new Error(error.message)

  revalidatePath("/candidates")
  redirect("/candidates")
}

// ── Workflow 2, step A: PARSE raw text with Claude (AI) ──────────────────────
export async function parseCandidate(
  rawText: string
): Promise<
  { ok: true; data: ParsedCandidate } | { ok: false; error: string }
> {
  const text = rawText.trim()
  if (!text) return { ok: false, error: "Paste some candidate text first." }
  try {
    const data = await parseCandidateText(text)
    return { ok: true, data }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Parsing failed.",
    }
  }
}

// ── Workflow 2, step B: CONFIRM & WRITE the recruiter-edited candidate ────────
export async function createCandidateFromParsed(
  parsed: ParsedCandidate
): Promise<ActionResult & { id?: string }> {
  const full_name = parsed.full_name?.trim()
  if (!full_name) return { ok: false, error: "Full name is required." }

  const supabase = await createClient()

  const embedding = await generateEmbedding(
    candidateEmbeddingText({
      full_name,
      current_title: parsed.current_title,
      professional_summary: parsed.professional_summary,
      skills: parsed.skills.map((s) => s.skill_name),
    })
  )

  const { data: candidate, error } = await supabase
    .from("candidates")
    .insert({
      full_name,
      contact_info: parsed.contact_info,
      linkedin_url: parsed.linkedin_url || null,
      portfolio_url: parsed.portfolio_url || null,
      current_title: parsed.current_title || null,
      current_company: parsed.current_company || null,
      years_experience: parsed.years_experience ?? null,
      professional_summary: parsed.professional_summary || null,
      languages: parsed.languages ?? [],
      candidate_tier: parsed.candidate_tier,
      tier_rationale: parsed.tier_rationale || null,
      source: "ai_ingestion",
      // Recruiter reviewed the AI draft, so provenance flips to confirmed.
      data_provenance: "recruiter_confirmed",
      freshness_score: 1.0,
      last_verified: new Date().toISOString(),
      embedding_vector: toPgVector(embedding),
    })
    .select("candidate_id")
    .single()

  if (error || !candidate) {
    return { ok: false, error: error?.message ?? "Failed to create candidate." }
  }

  // Insert skills (best-effort; candidate is already created).
  if (parsed.skills.length > 0) {
    const { error: skillErr } = await supabase.from("skills").insert(
      parsed.skills.map((s) => ({
        candidate_id: candidate.candidate_id,
        skill_name: s.skill_name,
        skill_type: s.skill_type,
        proficiency_level: s.proficiency_level,
        ai_literacy_signal: s.ai_literacy_signal,
      }))
    )
    if (skillErr) console.error("skill insert error:", skillErr.message)
  }

  revalidatePath("/candidates")
  return { ok: true, id: candidate.candidate_id }
}
