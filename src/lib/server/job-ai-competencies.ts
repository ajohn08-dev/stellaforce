import "server-only"

import { z } from "zod"
import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/lib/supabase/types"

/**
 * Shared schema + persistence for the AI "generate-competencies" output — the
 * Evaluation Criteria step of the cascade (role → competencies). n8n receives a
 * job's role definition and returns competencies; this persists them to
 * job_competencies (+ job_competency_level_descriptions). Enum tokens are
 * lenient (a bad value coerces to a sensible default).
 */

const LEVELS = ["aware", "proficient", "expert"] as const

export const AiCompetenciesOutputSchema = z.object({
  competencies: z
    .array(
      z.object({
        type: z
          .enum(["technical", "behavioral", "hybrid", "leadership"])
          .catch("technical"),
        description: z.string().optional().nullable(),
        recommended_level: z.enum(LEVELS).catch("proficient"),
        skills: z.array(z.string()).optional().default([]),
        tools: z.array(z.string()).optional().default([]),
        level_descriptions: z
          .object({
            aware: z.string().nullish(),
            proficient: z.string().nullish(),
            expert: z.string().nullish(),
          })
          .optional()
          .default({}),
      })
    )
    .optional()
    .default([]),
})

export type AiCompetenciesOutput = z.infer<typeof AiCompetenciesOutputSchema>

/** Normalize a raw n8n response (array/`output`/`json`-wrapped) into the schema. */
export function parseAiCompetenciesResponse(raw: unknown): AiCompetenciesOutput | null {
  let obj: unknown = raw
  if (Array.isArray(obj)) obj = obj[0]
  if (obj && typeof obj === "object" && "output" in obj) obj = (obj as { output: unknown }).output
  if (obj && typeof obj === "object" && "json" in obj) obj = (obj as { json: unknown }).json
  const parsed = AiCompetenciesOutputSchema.safeParse(obj)
  return parsed.success ? parsed.data : null
}

/**
 * Replace a job's competencies with the AI output (regeneration semantics —
 * deletes existing, since competencies derive from the role). Competencies
 * without a description are skipped (`job_competencies.description` is NOT NULL).
 */
export async function applyAiCompetencies(
  client: SupabaseClient<Database>,
  jobId: string,
  out: AiCompetenciesOutput
): Promise<{ competencies: number }> {
  await client.from("job_competencies").delete().eq("job_id", jobId)

  let count = 0
  for (const c of out.competencies) {
    const description = c.description?.trim()
    if (!description) continue

    const { data: comp } = await client
      .from("job_competencies")
      .insert({
        job_id: jobId,
        type: c.type,
        description,
        recommended_level: c.recommended_level,
        skills: c.skills,
        tools: c.tools,
      })
      .select("id")
      .single()
    if (!comp) continue

    const levelRows = LEVELS.filter((l) => c.level_descriptions[l]?.trim()).map((l) => ({
      competency_id: comp.id,
      level: l,
      description: c.level_descriptions[l]!.trim(),
    }))
    if (levelRows.length > 0) {
      await client.from("job_competency_level_descriptions").insert(levelRows)
    }
    count++
  }

  return { competencies: count }
}
