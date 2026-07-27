import { timingSafeEqual } from "node:crypto"

import { NextRequest, NextResponse } from "next/server"

import { serverEnv } from "@/lib/env"
import { RawIngestPayloadSchema } from "@/lib/ingest/schema"
import { processIngestionItem } from "@/lib/server/candidate-ingest"

/**
 * POST /api/candidates/ingest
 *
 * Not currently in n8n's actual call path — the live workflow replies
 * synchronously to the original kickoff request instead (see
 * `notifyResumeUploaded` in `src/app/(app)/candidates/actions.ts`, which runs
 * the same `processIngestionItem` this route calls). Kept as a standing
 * inbound entry point for a future async/callback-style n8n workflow, or for
 * manually replaying a stored `ingestion_jobs.raw_payload`, without needing a
 * second implementation of the persistence logic.
 *
 * At-least-once delivery is assumed: idempotency key is `body.storage_path`
 * (one uploaded file = one job, see `ingestion_jobs.storage_path unique`). A
 * duplicate delivery for a completed job returns the cached result without
 * doing any work; a duplicate delivery that races an in-flight one is turned
 * away rather than double-processed.
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

  // Sequential on purpose: each item does several dependent writes
  // (candidate -> resume -> children) and there's normally exactly one item
  // per delivery, so there's nothing to gain from parallelizing and it keeps
  // failure isolation simple (one bad item can't interleave writes with another).
  const results = []
  for (const item of parsed.data) {
    const outcome = await processIngestionItem(item)
    results.push({ storage_path: item.body.storage_path, ...outcome })
  }

  const allOk = results.every((r) => r.kind !== "failed")
  return NextResponse.json({ ok: allOk, results }, { status: allOk ? 200 : 207 })
}
