import { timingSafeEqual } from "node:crypto"

import { NextRequest, NextResponse } from "next/server"

import { serverEnv } from "@/lib/env"
import { createAdminClient } from "@/lib/supabase/admin"
import type { Database } from "@/lib/supabase/types"
import { RawIngestPayloadSchema, type RawWebhookItem } from "@/lib/ingest/schema"
import { IngestStageError, ingestCandidateResume } from "@/lib/server/candidate-ingest"

/**
 * POST /api/candidates/ingest
 *
 * Receives the fully-parsed resume payload from n8n (text extraction + LLM
 * structuring already happened there — this endpoint owns everything after
 * that: candidate/resume/skills/tools/experience persistence). n8n calls this
 * with the same shared secret it's issued for the outbound leg
 * (N8N_WEBHOOK_SECRET), just as a bearer token on the way in.
 *
 * At-least-once delivery is assumed: n8n may retry on timeout or non-2xx.
 * Idempotency key is `body.storage_path` (one uploaded file = one job, see
 * `ingestion_jobs.storage_path unique`). A duplicate delivery for a
 * completed job returns the cached result without doing any work; a
 * duplicate delivery that races an in-flight one is turned away with 202
 * rather than double-processed.
 */

export const runtime = "nodejs"

function isAuthorized(req: NextRequest): boolean {
  const header = req.headers.get("authorization") ?? ""
  const expected = `Bearer ${serverEnv.n8nWebhookSecret}`
  const a = Buffer.from(header)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

type JobRow = Database["public"]["Tables"]["ingestion_jobs"]["Row"]

type ItemResult =
  | { storage_path: string; ok: true; status: "completed" | "needs_review" | "processing"; candidate_id: string | null; resume_id: string | null; needs_review_reasons: string[] }
  | { storage_path: string; ok: false; error: string; stage: string | null }

async function claimOrCreateJob(
  supabase: ReturnType<typeof createAdminClient>,
  item: RawWebhookItem
): Promise<{ job: JobRow; alreadyTerminal: boolean; alreadyInFlight: boolean }> {
  const { storage_path, filename, user_id } = item.body

  let job: JobRow | null = null
  const { data: inserted, error: insertErr } = await supabase
    .from("ingestion_jobs")
    .insert({
      storage_path,
      filename,
      user_id,
      status: "received",
      raw_payload: item as unknown as Database["public"]["Tables"]["ingestion_jobs"]["Insert"]["raw_payload"],
      webhook_execution_mode: item.executionMode ?? null,
    })
    .select()
    .single()

  if (insertErr) {
    // 23505 = unique_violation on storage_path — this exact file was already delivered before.
    if (insertErr.code !== "23505") throw insertErr
    const { data: existing, error: selectErr } = await supabase
      .from("ingestion_jobs")
      .select()
      .eq("storage_path", storage_path)
      .single()
    if (selectErr || !existing) throw selectErr ?? new Error("ingestion_jobs row vanished mid-request")
    job = existing
  } else {
    job = inserted
  }

  if (job.status === "completed" || job.status === "needs_review") {
    return { job, alreadyTerminal: true, alreadyInFlight: false }
  }

  // Atomically claim it for processing — only one concurrent delivery wins.
  const { data: claimed } = await supabase
    .from("ingestion_jobs")
    .update({
      status: "processing",
      // `received` (fresh row, attempt_count already defaults to 1) vs
      // `failed` (this is a retry, so bump it).
      attempt_count: job.status === "failed" ? job.attempt_count + 1 : job.attempt_count,
    })
    .eq("id", job.id)
    .in("status", ["received", "failed"])
    .select()
    .maybeSingle()

  if (!claimed) {
    // Someone else (a concurrent retry) already claimed it, or it moved to
    // completed between our read and write — re-read and report current state.
    const { data: refreshed } = await supabase.from("ingestion_jobs").select().eq("id", job.id).single()
    return { job: refreshed ?? job, alreadyTerminal: refreshed?.status === "completed" || refreshed?.status === "needs_review", alreadyInFlight: true }
  }

  return { job: claimed, alreadyTerminal: false, alreadyInFlight: false }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 })
  }

  const parsed = RawIngestPayloadSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Payload validation failed", issues: parsed.error.issues },
      { status: 422 }
    )
  }

  const supabase = createAdminClient()
  const results: ItemResult[] = []

  // Sequential on purpose: each item does several dependent writes
  // (candidate -> resume -> children) and there's normally exactly one item
  // per delivery, so there's nothing to gain from parallelizing and it keeps
  // failure isolation simple (one bad item can't interleave writes with another).
  for (const item of parsed.data) {
    const storagePath = item.body.storage_path
    try {
      const { job, alreadyTerminal, alreadyInFlight } = await claimOrCreateJob(supabase, item)

      if (alreadyTerminal) {
        results.push({
          storage_path: storagePath,
          ok: true,
          status: job.status as "completed" | "needs_review",
          candidate_id: job.candidate_id,
          resume_id: job.resume_id,
          needs_review_reasons: job.needs_review_reasons ?? [],
        })
        continue
      }
      if (alreadyInFlight) {
        results.push({
          storage_path: storagePath,
          ok: true,
          status: "processing",
          candidate_id: job.candidate_id,
          resume_id: job.resume_id,
          needs_review_reasons: [],
        })
        continue
      }

      const result = await ingestCandidateResume(item, job.id)
      results.push({
        storage_path: storagePath,
        ok: true,
        status: result.status,
        candidate_id: result.candidateId,
        resume_id: result.resumeId,
        needs_review_reasons: result.needsReviewReasons,
      })
    } catch (err) {
      const stage = err instanceof IngestStageError ? err.stage : null
      const message = err instanceof Error ? err.message : "Unknown ingestion error"

      await supabase
        .from("ingestion_jobs")
        .update({ status: "failed", stage, error_message: message })
        .eq("storage_path", storagePath)

      console.error(`[candidates/ingest] failed at stage=${stage ?? "unknown"} storage_path=${storagePath}:`, message)
      results.push({ storage_path: storagePath, ok: false, error: message, stage })
    }
  }

  const allOk = results.every((r) => r.ok)
  return NextResponse.json({ ok: allOk, results }, { status: allOk ? 200 : 207 })
}
