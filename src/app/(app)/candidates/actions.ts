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
import { getCurrentProfile } from "@/lib/auth"
import { serverEnv } from "@/lib/env"
import type { CandidateTier } from "@/lib/supabase/types"

/**
 * Server Actions for the two foundational candidate workflows.
 *
 * Writes use the request-scoped, RLS-respecting server client so they run as
 * the signed-in recruiter's session.
 */

export type ActionResult = { ok: true } | { ok: false; error: string }

/** "Sarah Chen" -> { first_name: "Sarah", last_name: "Chen" }. Best-effort — a single trailing name is treated as first_name only. */
function splitFullName(fullName: string): { first_name: string; last_name: string } {
  const idx = fullName.indexOf(" ")
  if (idx === -1) return { first_name: fullName, last_name: "" }
  return { first_name: fullName.slice(0, idx), last_name: fullName.slice(idx + 1) }
}

/** "San Francisco, CA" -> { city: "San Francisco", state: "CA" }. */
function splitLocationRaw(location: string): { city: string | null; state: string | null } {
  const parts = location.split(",").map((p) => p.trim()).filter(Boolean)
  return { city: parts[0] ?? null, state: parts[1] ?? null }
}

// ── Workflow 1: ADD CANDIDATE (manual) ───────────────────────────────────────
export async function addCandidate(formData: FormData): Promise<void> {
  const full_name = String(formData.get("full_name") ?? "").trim()
  if (!full_name) throw new Error("Full name is required.")
  const { first_name, last_name } = splitFullName(full_name)

  const email = String(formData.get("email") ?? "").trim() || null
  const phone = String(formData.get("phone") ?? "").trim() || null
  const location_raw = String(formData.get("location") ?? "").trim() || null
  const timezone = String(formData.get("tz") ?? "").trim() || null
  const { city: location_city, state: location_state } = splitLocationRaw(
    location_raw ?? ""
  )

  const current_title = String(formData.get("current_title") ?? "").trim()
  const current_company = String(formData.get("current_company") ?? "").trim()
  const headline =
    current_title && current_company
      ? `${current_title} at ${current_company}`
      : current_title || current_company || null

  const professional_summary = String(formData.get("professional_summary") ?? "")
  const yearsRaw = String(formData.get("years_experience") ?? "")
  const years_experience = yearsRaw ? Number(yearsRaw) : null
  const tier = String(formData.get("candidate_tier") ?? "")
  const candidate_tier = (tier || null) as CandidateTier | null

  const embedding = await generateEmbedding(
    candidateEmbeddingText({
      full_name,
      current_title: headline,
      professional_summary,
    })
  )

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: candidate, error } = await supabase
    .from("candidates")
    .insert({
      first_name,
      last_name,
      email,
      phone,
      location_raw,
      location_city,
      location_state,
      timezone,
      headline,
      professional_summary: professional_summary || null,
      years_experience,
      candidate_tier,
      source: "manual_entry",
      data_provenance: "recruiter_confirmed",
      freshness_score: 1.0,
      last_verified: new Date().toISOString(),
      embedding_vector: toPgVector(embedding),
      added_by: user?.id ?? null,
    })
    .select("candidate_id")
    .single()

  if (error || !candidate) throw new Error(error?.message ?? "Failed to create candidate.")

  if (current_title && current_company) {
    await supabase.from("candidate_work_experiences").insert({
      candidate_id: candidate.candidate_id,
      display_order: 0,
      company_name: current_company,
      title: current_title,
      start_date: new Date().toISOString().slice(0, 10),
      is_current: true,
    })
  }

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
  const { first_name, last_name } = splitFullName(full_name)

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const headline =
    parsed.current_title && parsed.current_company
      ? `${parsed.current_title} at ${parsed.current_company}`
      : parsed.current_title || parsed.current_company || null

  const { city: location_city, state: location_state } = splitLocationRaw(
    parsed.contact_info.location
  )

  const embedding = await generateEmbedding(
    candidateEmbeddingText({
      full_name,
      current_title: headline,
      professional_summary: parsed.professional_summary,
      skills: parsed.skills.map((s) => s.skill_name),
    })
  )

  const { data: candidate, error } = await supabase
    .from("candidates")
    .insert({
      first_name,
      last_name,
      email: parsed.contact_info.email || null,
      phone: parsed.contact_info.phone || null,
      location_raw: parsed.contact_info.location || null,
      location_city,
      location_state,
      timezone: parsed.contact_info.tz || null,
      linkedin_url: parsed.linkedin_url || null,
      portfolio_url: parsed.portfolio_url || null,
      headline,
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
      added_by: user?.id ?? null,
    })
    .select("candidate_id")
    .single()

  if (error || !candidate) {
    return { ok: false, error: error?.message ?? "Failed to create candidate." }
  }

  if (parsed.current_title && parsed.current_company) {
    await supabase.from("candidate_work_experiences").insert({
      candidate_id: candidate.candidate_id,
      display_order: 0,
      company_name: parsed.current_company,
      title: parsed.current_title,
      start_date: new Date().toISOString().slice(0, 10),
      is_current: true,
    })
  }

  // Skills now live in a global lookup: find-or-create each name, then attach
  // the per-candidate proficiency/AI-literacy data via candidate_skills.
  if (parsed.skills.length > 0) {
    const names = parsed.skills.map((s) => s.skill_name)

    await supabase.from("skills").upsert(
      parsed.skills.map((s) => ({ name: s.skill_name, skill_type: s.skill_type })),
      { onConflict: "name", ignoreDuplicates: true }
    )

    const { data: skillRows } = await supabase
      .from("skills")
      .select("id, name")
      .in("name", names)
    const idByName = new Map((skillRows ?? []).map((s) => [s.name, s.id]))

    const candidateSkills = parsed.skills
      .map((s) => {
        const skill_id = idByName.get(s.skill_name)
        if (!skill_id) return null
        return {
          candidate_id: candidate.candidate_id,
          skill_id,
          proficiency_level: s.proficiency_level,
          ai_literacy_signal: s.ai_literacy_signal,
        }
      })
      .filter((s): s is NonNullable<typeof s> => s !== null)

    if (candidateSkills.length > 0) {
      const { error: skillErr } = await supabase
        .from("candidate_skills")
        .insert(candidateSkills)
      if (skillErr) console.error("skill insert error:", skillErr.message)
    }
  }

  revalidatePath("/candidates")
  return { ok: true, id: candidate.candidate_id }
}

export type NotifyResumeResult =
  | { ok: true; candidateName: string | null }
  | { ok: false; error: string }

// ── Workflow 2 (resume upload variant): hand an uploaded resume off to n8n
// for parsing. The client has already uploaded the file directly to the
// `resumes` Storage bucket by the time this runs — this just tells the n8n
// workflow where to find it. `user_id` is resolved server-side from the
// session rather than trusted from the client.
//
// The n8n workflow is synchronous: it doesn't respond until parsing has
// finished and the candidate + resume rows are written to Supabase, so a
// resolved fetch here means the write already happened — there's no
// separate polling/realtime step. The exact response body shape isn't
// pinned down yet, so we read a `success`/`candidate_name` field
// best-effort and fall back to response.ok / a generic message if absent.
//
// Of the three "add a candidate" entry points (resume drag-and-drop, CSV
// upload, manual form), this n8n webhook is called ONLY by resume
// drag-and-drop. CSV upload should parse rows and insert into `candidates`
// directly (or reuse parseCandidate/createCandidateFromParsed below for
// AI-assisted mapping) — it must not call this function or reference
// serverEnv.n8nWebhookUrl. Manual form already writes directly via
// addCandidate and should stay that way too.
export async function notifyResumeUploaded(
  storagePath: string,
  filename: string
): Promise<NotifyResumeResult> {
  const profile = await getCurrentProfile()
  if (!profile) {
    return { ok: false, error: "You must be signed in to upload a resume." }
  }

  try {
    const response = await fetch(serverEnv.n8nWebhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serverEnv.n8nWebhookSecret}`,
      },
      body: JSON.stringify({
        storage_path: storagePath,
        user_id: profile.id,
        filename,
      }),
    })

    const rawBody = await response.text()
    let parsedBody: Record<string, unknown> | null = null
    try {
      parsedBody = rawBody ? JSON.parse(rawBody) : null
    } catch {
      // Not JSON — fall through and treat rawBody as plain text below.
    }

    const success =
      typeof parsedBody?.success === "boolean" ? parsedBody.success : response.ok

    if (!success) {
      const message =
        (typeof parsedBody?.error === "string" && parsedBody.error) ||
        (typeof parsedBody?.message === "string" && parsedBody.message) ||
        rawBody.slice(0, 200)
      return {
        ok: false,
        error: `Resume parsing failed.${message ? ` ${message}` : ""}`,
      }
    }

    const candidateName =
      (typeof parsedBody?.candidate_name === "string" && parsedBody.candidate_name) ||
      (typeof parsedBody?.full_name === "string" && parsedBody.full_name) ||
      null

    return { ok: true, candidateName }
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error
          ? `Could not reach the resume parsing service: ${err.message}`
          : "Could not reach the resume parsing service.",
    }
  }
}
