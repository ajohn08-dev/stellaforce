import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"

import { createAdminClient } from "@/lib/supabase/admin"
import { isN8nAuthorized } from "@/lib/server/n8n-auth"
import { moveApplicationToStage } from "@/lib/server/pipeline-commands"

export const runtime = "nodejs"

/**
 * Move a candidate between sub-stages, from n8n or another integration.
 *
 * A **thin wrapper** over `moveApplicationToStage` — the same command the
 * recruiter's "Move to stage" control calls. n8n must never update
 * `applications` or `application_stage_history` directly: two writers means two
 * sets of events for one transition, and the booking automation hangs off those
 * events.
 */

const BodySchema = z.object({
  target_sub_stage_id: z.string().uuid(),
  /**
   * The caller's own event id. Supplying it makes a redelivery a no-op; without
   * it the key is derived from (application, stage), so an A→B→A round trip
   * would collide with its own first leg.
   */
  idempotency_key: z.string().min(1).max(200).optional(),
  system_source: z.string().min(1).max(100).optional(),
})

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ applicationId: string }> }
): Promise<NextResponse> {
  if (!isN8nAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  }

  const { applicationId } = await params
  if (!z.string().uuid().safeParse(applicationId).success) {
    return NextResponse.json({ ok: false, error: "Invalid application id" }, { status: 400 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 })
  }

  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Validation failed", issues: parsed.error.issues },
      { status: 422 }
    )
  }

  const admin = createAdminClient()

  // The command re-checks that the target stage belongs to this application's
  // job, which is the tenant boundary: a caller holding a stage id from another
  // customer's pipeline gets a 422, not a cross-tenant write.
  const result = await moveApplicationToStage(admin, {
    applicationId,
    targetSubStageId: parsed.data.target_sub_stage_id,
    actor: { profileId: null, systemSource: parsed.data.system_source ?? "n8n:pipeline" },
    idempotencyKey: parsed.data.idempotency_key,
  })

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 422 })
  }

  return NextResponse.json(
    {
      ok: true,
      application_id: applicationId,
      job_id: result.jobId,
      current_stage_id: result.subStageId,
    },
    { status: 200 }
  )
}
