import { timingSafeEqual } from "node:crypto"

import { NextRequest, NextResponse } from "next/server"

import { serverEnv } from "@/lib/env"
import { createAdminClient } from "@/lib/supabase/admin"

/**
 * POST /api/cron/sla-check
 *
 * The "Stage SLA breached" cron endpoint. n8n's Schedule trigger calls this
 * once a day (bearer-auth'd with N8N_WEBHOOK_SECRET). This route does all the
 * DB thinking: it finds candidates who have sat in a pipeline sub-stage longer
 * than the job's `needs_attention` SLA, RECORDS the breach (an `activity_events`
 * row per breach + flips `application_stage_history.sla_breached = true`), and
 * returns a ready-to-email list. n8n only sends the emails.
 *
 * System-actor convention: events are stamped actor_type='system',
 * system_source='n8n:sla_cron'. Idempotency key includes the date, so a
 * still-stuck candidate is re-alerted at most once per day.
 *
 * Uses the service-role admin client: this is a system job with no acting user
 * and must read/write across every client (bypassing RLS), like the ingestion
 * route.
 */

export const runtime = "nodejs"

const DEFAULT_STUCK_HOURS = 72 // fallback if no needs_attention SLA is configured
const SLA_TYPE = "needs_attention"

function isAuthorized(req: NextRequest): boolean {
  const header = req.headers.get("authorization") ?? ""
  const expected = `Bearer ${serverEnv.n8nWebhookSecret}`
  const a = Buffer.from(header)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

type BreachOut = {
  application_id: string
  candidate_name: string
  client_name: string | null
  job_title: string
  stage_name: string
  days_in_stage: number
  sla_days: number
  owner_name: string | null
  owner_email: string | null
  hr_email: string | null
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  }

  const supabase = createAdminClient()
  const now = Date.now()
  const today = new Date(now).toISOString().slice(0, 10) // YYYY-MM-DD

  // 1) Resolve the "stuck" threshold (hours): global needs_attention, plus any
  //    job-scope overrides. (A job's scope='job' row is written at publish.)
  const { data: slaRows } = await supabase
    .from("sla_policies")
    .select("scope, scope_id, threshold_hours, enabled")
    .eq("sla_type", SLA_TYPE)

  let globalHours = DEFAULT_STUCK_HOURS
  const jobHours = new Map<string, number>()
  for (const r of slaRows ?? []) {
    if (r.enabled === false || r.threshold_hours == null) continue
    if (r.scope === "global") globalHours = r.threshold_hours
    else if (r.scope === "job" && r.scope_id) jobHours.set(r.scope_id, r.threshold_hours)
  }

  // 2) Every open stage-history row (candidate currently sitting in a stage)
  //    for an active application, with the people/labels we need to email.
  const { data: openRows, error } = await supabase
    .from("application_stage_history")
    .select(
      `id, application_id, sub_stage_id, entered_at, sla_breached,
       sub_stage:job_workflow_sub_stages(name),
       application:applications!inner(
         status, candidate_id, job_id, client_id, owner_profile_id,
         candidate:candidates(first_name, last_name),
         client:clients(client_name),
         job:job_orders(title),
         owner:profiles(full_name, email)
       )`
    )
    .is("exited_at", null)
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = (openRows ?? []) as any[]
  const activeRows = rows.filter((r) => r.application?.status === "active")

  // 3) HR recipients per job (job_team_members with an HR-ish role).
  const jobIds = [...new Set(activeRows.map((r) => r.application?.job_id).filter(Boolean))]
  const hrEmail = new Map<string, string>()
  if (jobIds.length > 0) {
    const { data: team } = await supabase
      .from("job_team_members")
      .select("job_id, email, role")
      .in("job_id", jobIds)
      .ilike("role", "%hr%")
    for (const m of team ?? []) if (m.job_id && m.email && !hrEmail.has(m.job_id)) hrEmail.set(m.job_id, m.email)
  }

  // 4) Find breaches, record each, collect the email list.
  const breaches: BreachOut[] = []
  for (const r of activeRows) {
    const app = r.application
    const threshold = (app?.job_id && jobHours.get(app.job_id)) || globalHours
    const hoursIn = (now - new Date(r.entered_at).getTime()) / 3_600_000
    if (hoursIn <= threshold) continue

    const daysIn = Math.floor(hoursIn / 24)
    const stageName = r.sub_stage?.name ?? "this stage"
    const candidateName =
      [app?.candidate?.first_name, app?.candidate?.last_name].filter(Boolean).join(" ") || "Candidate"

    // Record: one activity_events row (system, alert), dedup'd once per day.
    await supabase.from("activity_events").upsert(
      {
        event_type: "stage_sla_breached",
        client_id: app?.client_id ?? null,
        candidate_id: app?.candidate_id ?? null,
        job_id: app?.job_id ?? null,
        application_id: r.application_id,
        sub_stage_id: r.sub_stage_id,
        actor_type: "system",
        actor_profile_id: null,
        system_source: "n8n:sla_cron",
        severity: "alert",
        payload: { days_in_stage: daysIn, threshold_hours: threshold, stage_name: stageName },
        idempotency_key: `stage_sla_breached:${r.application_id}:${r.sub_stage_id}:${today}`,
      },
      { onConflict: "idempotency_key", ignoreDuplicates: true }
    )
    // Flip the red sticker (idempotent).
    if (!r.sla_breached) {
      await supabase.from("application_stage_history").update({ sla_breached: true }).eq("id", r.id)
    }

    breaches.push({
      application_id: r.application_id,
      candidate_name: candidateName,
      client_name: app?.client?.client_name ?? null,
      job_title: app?.job?.title ?? "this job",
      stage_name: stageName,
      days_in_stage: daysIn,
      sla_days: Math.round(threshold / 24),
      owner_name: app?.owner?.full_name ?? null,
      owner_email: app?.owner?.email ?? null,
      hr_email: (app?.job_id && hrEmail.get(app.job_id)) || null,
    })
  }

  return NextResponse.json({ ok: true, count: breaches.length, breaches }, { status: 200 })
}
