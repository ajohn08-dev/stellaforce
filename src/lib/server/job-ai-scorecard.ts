import "server-only"

import { z } from "zod"
import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/lib/supabase/types"

/**
 * Shared schema + persistence for the AI "generate-scorecard" output — the
 * Scorecard step of the cascade (competencies → scorecard). n8n receives a
 * job's competencies (with ids) and returns weighted categories, each
 * referencing competencies by id. Persists to job_scorecard_categories +
 * job_scorecard_category_competencies.
 */

export const AiScorecardOutputSchema = z.object({
  scorecard: z
    .array(
      z.object({
        name: z.string().min(1),
        weight: z.coerce.number().catch(0),
        competency_ids: z.array(z.string()).optional().default([]),
      })
    )
    .optional()
    .default([]),
})

export type AiScorecardOutput = z.infer<typeof AiScorecardOutputSchema>

/** Normalize a raw n8n response (array/`output`/`json`-wrapped) into the schema. */
export function parseAiScorecardResponse(raw: unknown): AiScorecardOutput | null {
  let obj: unknown = raw
  if (Array.isArray(obj)) obj = obj[0]
  if (obj && typeof obj === "object" && "output" in obj) obj = (obj as { output: unknown }).output
  if (obj && typeof obj === "object" && "json" in obj) obj = (obj as { json: unknown }).json
  const parsed = AiScorecardOutputSchema.safeParse(obj)
  return parsed.success ? parsed.data : null
}

/**
 * Replace a job's scorecard with the AI output (regeneration semantics). Only
 * links competencies that actually belong to this job, and assigns each to at
 * most one category (the junction enforces one-category-per-competency).
 */
export async function applyAiScorecard(
  client: SupabaseClient<Database>,
  jobId: string,
  out: AiScorecardOutput
): Promise<{ categories: number }> {
  // The competencies that actually exist for this job (guard against hallucinated ids).
  const { data: comps } = await client
    .from("job_competencies")
    .select("id")
    .eq("job_id", jobId)
  const validIds = new Set((comps ?? []).map((c) => c.id))

  await client.from("job_scorecard_categories").delete().eq("job_id", jobId)

  const assigned = new Set<string>()
  let categories = 0
  for (const cat of out.scorecard) {
    if (!cat.name.trim()) continue
    const { data: category } = await client
      .from("job_scorecard_categories")
      .insert({ job_id: jobId, name: cat.name.trim(), weight: cat.weight })
      .select("id")
      .single()
    if (!category) continue

    const links = cat.competency_ids
      .filter((id) => validIds.has(id) && !assigned.has(id))
      .map((id) => {
        assigned.add(id)
        return { category_id: category.id, competency_id: id }
      })
    if (links.length > 0) {
      await client.from("job_scorecard_category_competencies").insert(links)
    }
    categories++
  }

  return { categories }
}
