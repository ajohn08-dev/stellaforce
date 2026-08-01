import "server-only"

import { z } from "zod"
import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database, TablesUpdate } from "@/lib/supabase/types"

/**
 * Shared schema + persistence for the AI "generate-role" output — used by both
 * the synchronous intake path (createJobDraft consumes the n8n webhook response)
 * and the async callback route (POST /api/jobs/ai/role). Enum tokens are lenient:
 * a bad value is dropped, not rejected.
 */

export const AiRoleOutputSchema = z.object({
  role: z
    .object({
      workplace_type: z.enum(["on-site", "hybrid", "remote"]).nullish().catch(undefined),
      office_location: z.string().nullish(),
      company: z.string().nullish(),
      industry: z.string().nullish(),
      job_function: z.string().nullish(),
      employment_type: z
        .enum(["full-time", "part-time", "contract", "freelance", "internship"])
        .nullish()
        .catch(undefined),
      experience_required: z.string().nullish(),
      education_required: z.string().nullish(),
      salary_from: z.coerce.number().nullish().catch(undefined),
      salary_to: z.coerce.number().nullish().catch(undefined),
      salary_currency: z.string().nullish(),
    })
    .default({}),
  target_companies: z
    .array(
      z.object({
        name: z.string().min(1),
        source: z.enum(["extracted", "ai_suggested", "recruiter"]).catch("ai_suggested"),
      })
    )
    .optional()
    .default([]),
})

export type AiRoleOutput = z.infer<typeof AiRoleOutputSchema>

/**
 * Normalize a raw n8n response body into AiRoleOutput. n8n wraps items in an
 * array and sometimes under `output`/`json`, so unwrap defensively.
 */
export function parseAiRoleResponse(raw: unknown): AiRoleOutput | null {
  let obj: unknown = raw
  if (Array.isArray(obj)) obj = obj[0]
  if (obj && typeof obj === "object" && "output" in obj) obj = (obj as { output: unknown }).output
  if (obj && typeof obj === "object" && "json" in obj) obj = (obj as { json: unknown }).json
  const parsed = AiRoleOutputSchema.safeParse(obj)
  return parsed.success ? parsed.data : null
}

/** Persist an AiRoleOutput onto a draft job (role columns + target companies). */
export async function applyAiRoleOutput(
  client: SupabaseClient<Database>,
  jobId: string,
  out: AiRoleOutput
): Promise<{ updated: string[]; targetCompanies: number }> {
  const r = out.role
  const update: TablesUpdate<"job_orders"> = {}
  if (r.workplace_type) update.workplace_type = r.workplace_type
  if (r.office_location) update.office_location = r.office_location
  if (r.industry) update.industry = r.industry
  if (r.job_function) update.job_function = r.job_function
  if (r.employment_type) update.employment_type = r.employment_type
  if (r.experience_required) update.experience_required = r.experience_required
  if (r.education_required) update.education_required = r.education_required
  if (r.salary_from != null) update.salary_from = r.salary_from
  if (r.salary_to != null) update.salary_to = r.salary_to
  if (r.salary_currency) update.salary_currency = r.salary_currency

  // Company = the hiring client. Resolve authoritatively from the job's
  // client_id → clients.client_name (the LLM only sees a UUID, so it can't).
  const { data: job } = await client
    .from("job_orders")
    .select("client_id")
    .eq("job_id", jobId)
    .single()
  if (job?.client_id) {
    const { data: clientRow } = await client
      .from("clients")
      .select("client_name")
      .eq("client_id", job.client_id)
      .single()
    if (clientRow?.client_name) update.company = clientRow.client_name
  }

  if (Object.keys(update).length > 0) {
    await client.from("job_orders").update(update).eq("job_id", jobId)
  }

  let targetCompanies = 0
  if (out.target_companies.length > 0) {
    const rows = out.target_companies.map((c) => ({ job_id: jobId, name: c.name.trim(), source: c.source }))
    await client
      .from("job_target_companies")
      .upsert(rows, { onConflict: "job_id,name", ignoreDuplicates: true })
    targetCompanies = rows.length
  }

  return { updated: Object.keys(update), targetCompanies }
}
