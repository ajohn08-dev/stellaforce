import { timingSafeEqual } from "node:crypto"

import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { serverEnv } from "@/lib/env"
import { createAdminClient } from "@/lib/supabase/admin"
import type { TablesUpdate } from "@/lib/supabase/types"

/**
 * POST /api/jobs/ai/role
 *
 * Return trip for the n8n "generate-role" workflow. Receives the LLM's
 * structured role fields and persists them onto the draft `job_orders` row.
 * Bearer-auth'd with N8N_WEBHOOK_SECRET; uses the service-role admin client
 * (system callback, no acting user). Tolerant: invalid enum tokens are dropped
 * rather than failing the whole request, so a slightly-off LLM output still
 * fills what it can.
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

// Enums are lenient: a bad token becomes undefined (dropped) instead of a 422.
const RoleSchema = z.object({
  job_id: z.string().min(1),
  role: z.object({
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
  }),
  // Target companies: sourced from notes ('extracted') or AI-suggested similar
  // companies in the same space ('ai_suggested').
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

  const parsed = RoleSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Validation failed", issues: parsed.error.issues },
      { status: 422 }
    )
  }

  const { job_id, role: r, target_companies } = parsed.data

  // Build a typed update from only the fields the LLM actually provided.
  const update: TablesUpdate<"job_orders"> = {}
  if (r.workplace_type) update.workplace_type = r.workplace_type
  if (r.office_location) update.office_location = r.office_location
  if (r.company) update.company = r.company
  if (r.industry) update.industry = r.industry
  if (r.job_function) update.job_function = r.job_function
  if (r.employment_type) update.employment_type = r.employment_type
  if (r.experience_required) update.experience_required = r.experience_required
  if (r.education_required) update.education_required = r.education_required
  if (r.salary_from != null) update.salary_from = r.salary_from
  if (r.salary_to != null) update.salary_to = r.salary_to
  if (r.salary_currency) update.salary_currency = r.salary_currency

  const supabase = createAdminClient()

  if (Object.keys(update).length > 0) {
    const { error } = await supabase.from("job_orders").update(update).eq("job_id", job_id)
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  // Upsert target companies (idempotent on re-run; non-destructive to existing).
  let companiesUpserted = 0
  if (target_companies.length > 0) {
    const rows = target_companies.map((c) => ({
      job_id,
      name: c.name.trim(),
      source: c.source,
    }))
    const { error: tcErr } = await supabase
      .from("job_target_companies")
      .upsert(rows, { onConflict: "job_id,name", ignoreDuplicates: true })
    if (tcErr) return NextResponse.json({ ok: false, error: tcErr.message }, { status: 500 })
    companiesUpserted = rows.length
  }

  return NextResponse.json({
    ok: true,
    updated: Object.keys(update).length,
    fields: Object.keys(update),
    target_companies: companiesUpserted,
  })
}
