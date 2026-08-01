import { timingSafeEqual } from "node:crypto"

import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { serverEnv } from "@/lib/env"
import { createAdminClient } from "@/lib/supabase/admin"
import { AiRoleOutputSchema, applyAiRoleOutput } from "@/lib/server/job-ai-role"

/**
 * POST /api/jobs/ai/role
 *
 * Optional async callback for the n8n "generate-role" workflow (an alternative
 * to the synchronous intake path in createJobDraft, which now consumes the
 * webhook response directly). Persists the LLM's role fields + target companies
 * onto a draft job. Bearer-auth'd with N8N_WEBHOOK_SECRET; service-role client.
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

const RouteSchema = AiRoleOutputSchema.extend({ job_id: z.string().min(1) })

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

  const parsed = RouteSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Validation failed", issues: parsed.error.issues },
      { status: 422 }
    )
  }

  const { job_id, role, target_companies } = parsed.data
  const supabase = createAdminClient()
  const { updated, targetCompanies } = await applyAiRoleOutput(supabase, job_id, {
    role,
    target_companies,
  })

  return NextResponse.json({ ok: true, updated: updated.length, fields: updated, target_companies: targetCompanies })
}
