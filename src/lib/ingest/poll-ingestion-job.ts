import { createClient } from "@/lib/supabase/client"

/**
 * Client-side polling for the resume ingestion webhook's outcome.
 *
 * `POST /api/candidates/ingest` is called server-to-server by n8n, not by
 * the browser, so the upload dialog has no direct way to know when the
 * Supabase write finishes. `ingestion_jobs` (permissive read for any
 * authenticated user, same as every other V3.2 table) is the one place
 * that state is visible, so poll it by `storage_path` until it reaches a
 * terminal status.
 */

export type IngestionOutcome =
  | { kind: "completed"; candidateId: string | null }
  | { kind: "needs_review"; candidateId: string | null; reasons: string[] }
  | { kind: "failed"; error: string | null }

export async function pollIngestionJob(
  storagePath: string,
  { intervalMs = 1500, timeoutMs = 60_000 }: { intervalMs?: number; timeoutMs?: number } = {}
): Promise<IngestionOutcome> {
  const supabase = createClient()
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    const { data } = await supabase
      .from("ingestion_jobs")
      .select("status, candidate_id, error_message, needs_review_reasons")
      .eq("storage_path", storagePath)
      .maybeSingle()

    if (data?.status === "completed") {
      return { kind: "completed", candidateId: data.candidate_id }
    }
    if (data?.status === "needs_review") {
      return { kind: "needs_review", candidateId: data.candidate_id, reasons: data.needs_review_reasons ?? [] }
    }
    if (data?.status === "failed") {
      return { kind: "failed", error: data.error_message }
    }

    // No row yet (n8n's callback hasn't landed) or still `received`/`processing` — keep waiting.
    await new Promise((resolve) => setTimeout(resolve, intervalMs))
  }

  return { kind: "failed", error: "Timed out waiting for the candidate to be saved." }
}
