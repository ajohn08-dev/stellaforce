import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"

import { createAdminClient } from "@/lib/supabase/admin"
import { isN8nAuthorized } from "@/lib/server/n8n-auth"
import { completeInterviewCommand } from "@/lib/server/pipeline-commands"

export const runtime = "nodejs"

/**
 * Mark an interview as having happened, from n8n.
 *
 * This is how an agent call that actually ran gets back into the system: the
 * voice workflow finishes, n8n calls this, and `interview_completed` fires for
 * the first time in this codebase's history.
 *
 * A **thin wrapper** over `completeInterviewCommand`, the same command behind
 * the recruiter's "Mark complete" action. Idempotent by the command's own
 * status check — n8n retries, and a second call on a completed interview is a
 * 200, not a conflict.
 */

const BodySchema = z.object({
  outcome: z.enum(["completed", "no_show"]).optional(),
  system_source: z.string().min(1).max(100).optional(),
})

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ interviewId: string }> }
): Promise<NextResponse> {
  if (!isN8nAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  }

  const { interviewId } = await params
  if (!z.string().uuid().safeParse(interviewId).success) {
    return NextResponse.json({ ok: false, error: "Invalid interview id" }, { status: 400 })
  }

  // An empty body is legitimate — "it happened" is the common case.
  let body: unknown = {}
  try {
    body = await req.json()
  } catch {
    body = {}
  }

  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Validation failed", issues: parsed.error.issues },
      { status: 422 }
    )
  }

  const admin = createAdminClient()
  const result = await completeInterviewCommand(admin, {
    interviewId,
    outcome: parsed.data.outcome,
    actor: {
      profileId: null,
      systemSource: parsed.data.system_source ?? "n8n:interview_complete",
    },
  })

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 422 })
  }

  return NextResponse.json(
    {
      ok: true,
      interview_id: interviewId,
      job_id: result.jobId,
      // True when this was a redelivery. Lets an n8n branch tell "we did it" from
      // "it was already done" without treating either as an error.
      already_completed: result.alreadyDone,
    },
    { status: 200 }
  )
}
