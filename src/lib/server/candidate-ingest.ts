import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import { createAdminClient } from "@/lib/supabase/admin"
import type { Database } from "@/lib/supabase/types"
import {
  candidateEmbeddingText,
  generateEmbedding,
  toPgVector,
} from "@/lib/ai/embeddings"
import { normalizeResumePayload } from "@/lib/ingest/normalize"
import type { NormalizedIngestPayload, RawWebhookItem } from "@/lib/ingest/schema"

/**
 * Service layer for the resume ingestion webhook. Every function here is a
 * single, narrow write step; ingestCandidateResume() composes them in order
 * and records the current `stage` on the ingestion_jobs row before each step
 * so a failure always logs exactly where it happened and is safe to retry
 * (each step is individually idempotent — see the unique constraints added in
 * supabase/migrations/20260727120000_ingestion_pipeline.sql).
 *
 * Uses the service-role admin client throughout: this endpoint is called by
 * n8n with a shared-secret bearer token, not a signed-in recruiter session,
 * so there is no user JWT for RLS to key off — same category of privileged,
 * no-acting-user write as seeding/backfills (see CLAUDE.md).
 */

type AdminClient = SupabaseClient<Database>

// A resume-derived skill has no explicit assessment behind it (unlike the
// paste-text AI ingestion tab, which asks the LLM for a proficiency + AI
// literacy signal). Default to a conservative middle value; a recruiter can
// correct it once the candidate is reviewed.
const DEFAULT_SKILL_PROFICIENCY: Database["public"]["Enums"]["proficiency_level"] =
  "intermediate"

export type IngestStage =
  | "resolve_identity"
  | "upsert_candidate"
  | "update_resume"
  | "upsert_links"
  | "upsert_tools"
  | "upsert_skills"
  | "upsert_work_experiences"
  | "upsert_education"
  | "upsert_certifications"
  | "done"

export class IngestStageError extends Error {
  constructor(public readonly stage: IngestStage, message: string, public readonly cause?: unknown) {
    super(message)
    this.name = "IngestStageError"
  }
}

export type IngestResult = {
  candidateId: string
  resumeId: string
  status: "completed" | "needs_review"
  needsReviewReasons: string[]
}

// ── Step: identity resolution ─────────────────────────────────────────────────

export async function resolveCandidateIdentity(
  supabase: AdminClient,
  normalized: NormalizedIngestPayload
): Promise<{ candidateId: string | null }> {
  if (normalized.candidate.email) {
    const { data, error } = await supabase
      .from("candidates")
      .select("candidate_id")
      .eq("email", normalized.candidate.email)
      .maybeSingle()
    if (error) throw new IngestStageError("resolve_identity", error.message, error)
    if (data) return { candidateId: data.candidate_id }
  }

  const linkedinUrl = normalized.links.find((l) => l.link_type === "linkedin")?.url
  if (linkedinUrl) {
    const { data, error } = await supabase
      .from("candidates")
      .select("candidate_id")
      .eq("linkedin_url", linkedinUrl)
      .maybeSingle()
    if (error) throw new IngestStageError("resolve_identity", error.message, error)
    if (data) return { candidateId: data.candidate_id }
  }

  return { candidateId: null }
}

// ── Step: candidate upsert ────────────────────────────────────────────────────

export async function upsertCandidate(
  supabase: AdminClient,
  normalized: NormalizedIngestPayload,
  candidateId: string | null
): Promise<string> {
  const c = normalized.candidate
  const linkedinUrl = normalized.links.find((l) => l.link_type === "linkedin")?.url ?? null
  const githubUrl = normalized.links.find((l) => l.link_type === "github")?.url ?? null
  const portfolioUrl = normalized.links.find((l) => l.link_type === "portfolio")?.url ?? null

  const embedding = await generateEmbedding(
    candidateEmbeddingText({
      full_name: `${c.first_name} ${c.last_name}`.trim(),
      current_title: c.current_title,
      professional_summary: c.professional_summary,
      skills: normalized.skills.map((s) => s.name),
    })
  )

  if (candidateId) {
    // Existing candidate (re-upload / reprocess): only overwrite fields the
    // new parse actually has values for, and never downgrade a
    // recruiter-confirmed row back to ai_parsed provenance.
    const { data: existing, error: fetchErr } = await supabase
      .from("candidates")
      .select("data_provenance")
      .eq("candidate_id", candidateId)
      .single()
    if (fetchErr) throw new IngestStageError("upsert_candidate", fetchErr.message, fetchErr)

    const patch: Database["public"]["Tables"]["candidates"]["Update"] = {
      last_verified: new Date().toISOString(),
      embedding_vector: toPgVector(embedding),
    }
    if (c.phone) patch.phone = c.phone
    if (c.location_raw) patch.location_raw = c.location_raw
    if (c.location_city) patch.location_city = c.location_city
    if (c.location_state) patch.location_state = c.location_state
    if (c.location_country) patch.location_country = c.location_country
    if (c.timezone) patch.timezone = c.timezone
    if (c.current_title) patch.current_title = c.current_title
    if (c.current_company) patch.current_company = c.current_company
    if (c.professional_summary) patch.professional_summary = c.professional_summary
    if (c.years_experience !== null) patch.years_experience = c.years_experience
    if (linkedinUrl) patch.linkedin_url = linkedinUrl
    if (githubUrl) patch.github_url = githubUrl
    if (portfolioUrl) patch.portfolio_url = portfolioUrl
    if (normalized.languages.length > 0) patch.languages = normalized.languages
    if (existing.data_provenance !== "recruiter_confirmed") {
      patch.data_provenance = "ai_parsed"
    }

    const { error } = await supabase.from("candidates").update(patch).eq("candidate_id", candidateId)
    if (error) throw new IngestStageError("upsert_candidate", error.message, error)
    return candidateId
  }

  const { data, error } = await supabase
    .from("candidates")
    .insert({
      first_name: c.first_name,
      last_name: c.last_name,
      email: c.email,
      phone: c.phone,
      location_raw: c.location_raw,
      location_city: c.location_city,
      location_state: c.location_state,
      location_country: c.location_country,
      timezone: c.timezone,
      current_title: c.current_title,
      current_company: c.current_company,
      headline:
        c.current_title && c.current_company
          ? `${c.current_title} at ${c.current_company}`
          : c.current_title ?? c.current_company ?? null,
      professional_summary: c.professional_summary,
      years_experience: c.years_experience,
      languages: normalized.languages,
      linkedin_url: linkedinUrl,
      github_url: githubUrl,
      portfolio_url: portfolioUrl,
      source: "resume_upload",
      data_provenance: "ai_parsed",
      freshness_score: 1.0,
      last_verified: new Date().toISOString(),
      embedding_vector: toPgVector(embedding),
      added_by: normalized.uploaderUserId,
    })
    .select("candidate_id")
    .single()
  if (error || !data) throw new IngestStageError("upsert_candidate", error?.message ?? "insert returned no row", error)
  return data.candidate_id
}

// ── Step: resume metadata ─────────────────────────────────────────────────────

export async function updateResumeRecord(
  supabase: AdminClient,
  candidateId: string,
  normalized: NormalizedIngestPayload,
  rawItem: RawWebhookItem,
  parseStatus: "parsed" | "needs_review" | "failed",
  parseError: string | null
): Promise<string> {
  const { data: currentResume } = await supabase
    .from("resumes")
    .select("id, version")
    .eq("candidate_id", candidateId)
    .eq("is_current", true)
    .neq("storage_path", normalized.storagePath)
    .maybeSingle()

  if (currentResume) {
    await supabase
      .from("resumes")
      .update({ is_current: false, superseded_at: new Date().toISOString() })
      .eq("id", currentResume.id)
  }

  const { data, error } = await supabase
    .from("resumes")
    .upsert(
      {
        candidate_id: candidateId,
        storage_path: normalized.storagePath,
        filename: normalized.filename,
        parsed_data: rawItem.output as unknown as Database["public"]["Tables"]["resumes"]["Insert"]["parsed_data"],
        parse_status: parseStatus,
        parse_error: parseError,
        is_current: true,
        version: (currentResume?.version ?? 0) + 1,
      },
      { onConflict: "storage_path" }
    )
    .select("id")
    .single()
  if (error || !data) throw new IngestStageError("update_resume", error?.message ?? "upsert returned no row", error)
  return data.id
}

// ── Step: links ────────────────────────────────────────────────────────────────

export async function upsertLinks(
  supabase: AdminClient,
  candidateId: string,
  links: NormalizedIngestPayload["links"]
): Promise<void> {
  if (links.length === 0) return
  const { error } = await supabase.from("candidate_links").upsert(
    links.map((l) => ({
      candidate_id: candidateId,
      url: l.url,
      link_type: l.link_type,
      label: l.label,
    })),
    { onConflict: "candidate_id,url" }
  )
  if (error) throw new IngestStageError("upsert_links", error.message, error)
}

// ── Shared: case-insensitive find-or-create for the skills/tools lookups ───────
//
// `skills.name`/`tools.name` are unique on lower(name) (see
// 20260727130000_skills_tools_case_insensitive.sql), but matching that
// case-insensitively isn't something a plain `.upsert({ onConflict: "name" })`
// can express — that only dedupes exact-string matches. This does the match
// in application code (fetch-then-compare-lowercased) and falls back to the
// DB's unique index as the concurrency backstop: if two ingestion requests
// both try to create the same new name at once, one insert wins and the
// other gets a 23505 here, which we catch and resolve against the row the
// winner just created rather than erroring out.
async function findOrCreateLookupRows(
  supabase: AdminClient,
  table: "skills" | "tools",
  names: string[],
  extraByName: Map<string, Record<string, unknown>> = new Map()
): Promise<Map<string, string>> {
  if (names.length === 0) return new Map()
  const stage: IngestStage = table === "skills" ? "upsert_skills" : "upsert_tools"

  const fetchIdByLowerName = async (): Promise<Map<string, string>> => {
    // Both tables are small, curated recruiting vocabularies (hundreds of
    // rows, not open-ended user text), so a full-table read is simpler and
    // more robust than building a hand-escaped ilike/or() filter string.
    const { data, error } = await supabase.from(table).select("id, name")
    if (error) throw new IngestStageError(stage, error.message, error)
    return new Map((data ?? []).map((r) => [r.name.toLowerCase(), r.id] as const))
  }

  const resultByName = new Map<string, string>()
  const resolve = (candidates: string[], idByLowerName: Map<string, string>): string[] =>
    candidates.filter((name) => {
      const id = idByLowerName.get(name.toLowerCase())
      if (id) resultByName.set(name, id)
      return !id
    })

  let missing = resolve(names, await fetchIdByLowerName())

  // Up to two passes: the second only runs if the first insert lost a race
  // to a concurrent request creating one of the same names, and only
  // retries whatever is still genuinely absent afterward.
  for (let attempt = 0; attempt < 2 && missing.length > 0; attempt++) {
    const insertRows = missing.map((name) => ({ name, ...(extraByName.get(name) ?? {}) }))
    const { data: inserted, error: insertErr } = await supabase
      .from(table)
      .insert(insertRows as never)
      .select("id, name")

    if (!insertErr) {
      for (const row of inserted ?? []) resultByName.set(row.name, row.id)
      missing = resolve(missing, new Map((inserted ?? []).map((r) => [r.name.toLowerCase(), r.id] as const)))
      break
    }
    if (insertErr.code !== "23505") throw new IngestStageError(stage, insertErr.message, insertErr)
    missing = resolve(missing, await fetchIdByLowerName())
  }

  if (missing.length > 0) {
    throw new IngestStageError(stage, `Failed to create ${table} rows: ${missing.join(", ")}`)
  }
  return resultByName
}

// ── Step: tools ────────────────────────────────────────────────────────────────

export async function upsertTools(
  supabase: AdminClient,
  candidateId: string,
  tools: string[]
): Promise<void> {
  if (tools.length === 0) return

  const idByName = await findOrCreateLookupRows(supabase, "tools", tools)
  const rows = tools
    .map((name) => idByName.get(name))
    .filter((id): id is string => Boolean(id))
    .map((tool_id) => ({ candidate_id: candidateId, tool_id }))
  if (rows.length === 0) return

  const { error } = await supabase
    .from("candidate_tools")
    .upsert(rows, { onConflict: "candidate_id,tool_id" })
  if (error) throw new IngestStageError("upsert_tools", error.message, error)
}

// ── Step: skills ───────────────────────────────────────────────────────────────

export async function upsertSkills(
  supabase: AdminClient,
  candidateId: string,
  skills: NormalizedIngestPayload["skills"]
): Promise<void> {
  if (skills.length === 0) return

  const extraByName = new Map(skills.map((s) => [s.name, { skill_type: s.skill_type }]))
  const idByName = await findOrCreateLookupRows(
    supabase,
    "skills",
    skills.map((s) => s.name),
    extraByName
  )
  const rows = skills
    .map((s) => idByName.get(s.name))
    .filter((id): id is string => Boolean(id))
    .map((skill_id) => ({
      candidate_id: candidateId,
      skill_id,
      proficiency_level: DEFAULT_SKILL_PROFICIENCY,
    }))
  if (rows.length === 0) return

  const { error } = await supabase
    .from("candidate_skills")
    .upsert(rows, { onConflict: "candidate_id,skill_id" })
  if (error) throw new IngestStageError("upsert_skills", error.message, error)
}

// ── Steps: work experience / education / certifications ────────────────────────
//
// These three have no natural per-row dedup key from the LLM (two stints can
// legitimately share a title, e.g. two "Software Engineer" roles), so instead
// of fuzzy-matching individual rows, replace the whole set this resume
// produced: delete rows tagged with this resume's id, then insert the fresh
// set tagged the same way. Rows with source_resume_id IS NULL (recruiter
// manual entry) are never touched. Reprocessing the same resume is therefore
// fully idempotent, and re-running after a partial failure converges cleanly.

export async function upsertWorkExperiences(
  supabase: AdminClient,
  candidateId: string,
  resumeId: string,
  experiences: NormalizedIngestPayload["workExperiences"]
): Promise<void> {
  const { error: deleteErr } = await supabase
    .from("candidate_work_experiences")
    .delete()
    .eq("candidate_id", candidateId)
    .eq("source_resume_id", resumeId)
  if (deleteErr) throw new IngestStageError("upsert_work_experiences", deleteErr.message, deleteErr)
  if (experiences.length === 0) return

  const { error } = await supabase.from("candidate_work_experiences").insert(
    experiences.map((exp) => ({
      candidate_id: candidateId,
      source_resume_id: resumeId,
      display_order: exp.display_order,
      company_name: exp.company_name,
      title: exp.title,
      employment_type: exp.employment_type,
      location: exp.location,
      is_remote: exp.is_remote,
      start_date: exp.start_date,
      end_date: exp.end_date,
      is_current: exp.is_current,
      description: exp.description,
    }))
  )
  if (error) throw new IngestStageError("upsert_work_experiences", error.message, error)
}

export async function upsertEducation(
  supabase: AdminClient,
  candidateId: string,
  resumeId: string,
  education: NormalizedIngestPayload["education"]
): Promise<void> {
  const { error: deleteErr } = await supabase
    .from("candidate_education")
    .delete()
    .eq("candidate_id", candidateId)
    .eq("source_resume_id", resumeId)
  if (deleteErr) throw new IngestStageError("upsert_education", deleteErr.message, deleteErr)
  if (education.length === 0) return

  const { error } = await supabase.from("candidate_education").insert(
    education.map((edu) => ({
      candidate_id: candidateId,
      source_resume_id: resumeId,
      institution_name: edu.institution_name,
      degree: edu.degree,
      field_of_study: edu.field_of_study,
      start_date: edu.start_date,
      end_date: edu.end_date,
      is_current: edu.is_current,
      gpa: edu.gpa,
      description: edu.description,
    }))
  )
  if (error) throw new IngestStageError("upsert_education", error.message, error)
}

export async function upsertCertifications(
  supabase: AdminClient,
  candidateId: string,
  resumeId: string,
  certifications: NormalizedIngestPayload["certifications"]
): Promise<void> {
  const { error: deleteErr } = await supabase
    .from("candidate_certifications")
    .delete()
    .eq("candidate_id", candidateId)
    .eq("source_resume_id", resumeId)
  if (deleteErr) throw new IngestStageError("upsert_certifications", deleteErr.message, deleteErr)
  if (certifications.length === 0) return

  const { error } = await supabase.from("candidate_certifications").insert(
    certifications.map((cert) => ({
      candidate_id: candidateId,
      source_resume_id: resumeId,
      name: cert.name,
      issuing_organization: cert.issuing_organization,
      issue_date: cert.issue_date,
      expiry_date: cert.expiry_date,
      credential_id: cert.credential_id,
      credential_url: cert.credential_url,
    }))
  )
  if (error) throw new IngestStageError("upsert_certifications", error.message, error)
}

// ── Step: ingestion_jobs status ─────────────────────────────────────────────────

export async function markIngestionJobStatus(
  supabase: AdminClient,
  jobId: string,
  update: {
    status: Database["public"]["Tables"]["ingestion_jobs"]["Row"]["status"]
    stage?: IngestStage
    candidateId?: string
    resumeId?: string
    errorMessage?: string | null
    needsReviewReasons?: string[]
  }
): Promise<void> {
  const patch: Database["public"]["Tables"]["ingestion_jobs"]["Update"] = {
    status: update.status,
  }
  if (update.stage) patch.stage = update.stage
  if (update.candidateId) patch.candidate_id = update.candidateId
  if (update.resumeId) patch.resume_id = update.resumeId
  if (update.errorMessage !== undefined) patch.error_message = update.errorMessage
  if (update.needsReviewReasons) patch.needs_review_reasons = update.needsReviewReasons

  const { error } = await supabase.from("ingestion_jobs").update(patch).eq("id", jobId)
  if (error) {
    // Logging-only path — never let a logging failure mask the real error.
    console.error(`Failed to update ingestion_jobs ${jobId}:`, error.message)
  }
}

// ── Orchestrator ────────────────────────────────────────────────────────────────

export async function ingestCandidateResume(
  rawItem: RawWebhookItem,
  jobId: string
): Promise<IngestResult> {
  const supabase = createAdminClient()
  const normalized = normalizeResumePayload(rawItem)

  const stageMark = (stage: IngestStage) =>
    markIngestionJobStatus(supabase, jobId, { status: "processing", stage })

  await stageMark("resolve_identity")
  const { candidateId: existingCandidateId } = await resolveCandidateIdentity(supabase, normalized)

  await stageMark("upsert_candidate")
  const candidateId = await upsertCandidate(supabase, normalized, existingCandidateId)

  const needsReview = normalized.needsReviewReasons.length > 0
  await stageMark("update_resume")
  const resumeId = await updateResumeRecord(
    supabase,
    candidateId,
    normalized,
    rawItem,
    needsReview ? "needs_review" : "parsed",
    null
  )

  await stageMark("upsert_links")
  await upsertLinks(supabase, candidateId, normalized.links)

  await stageMark("upsert_tools")
  await upsertTools(supabase, candidateId, normalized.tools)

  await stageMark("upsert_skills")
  await upsertSkills(supabase, candidateId, normalized.skills)

  await stageMark("upsert_work_experiences")
  await upsertWorkExperiences(supabase, candidateId, resumeId, normalized.workExperiences)

  await stageMark("upsert_education")
  await upsertEducation(supabase, candidateId, resumeId, normalized.education)

  await stageMark("upsert_certifications")
  await upsertCertifications(supabase, candidateId, resumeId, normalized.certifications)

  const status = needsReview ? "needs_review" : "completed"
  await markIngestionJobStatus(supabase, jobId, {
    status,
    stage: "done",
    candidateId,
    resumeId,
    needsReviewReasons: normalized.needsReviewReasons,
  })

  return { candidateId, resumeId, status, needsReviewReasons: normalized.needsReviewReasons }
}
