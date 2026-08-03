"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { getCurrentProfile, type CurrentProfile } from "@/lib/auth"
import { can } from "@/lib/permissions"
import type {
  DecisionMode,
  EmploymentType,
  InterviewerType,
  Json,
  PipelineStage,
  QuestionSource,
  RatingScale,
  StageEntryCondition,
  StageFormat,
  StageVisibility,
  WorkflowTemplateStatus,
} from "@/lib/supabase/types"

/**
 * Server Actions for reusable workflow templates + their cross-cutting settings
 * overrides. Writes use the request-scoped, RLS-respecting server client. The
 * new tables are tenant-scoped, so RLS is the backstop; these app-side guards
 * give clearer errors and prevent a client user creating a global template.
 */

export type ActionResult<T = unknown> =
  | ({ ok: true } & T)
  | { ok: false; error: string }

export type TemplateSubStageInput = {
  pipeline_stage_key: PipelineStage
  name: string
  purpose?: string | null
  duration_minutes?: number | null
  format?: StageFormat | null
  visibility?: StageVisibility
  owner_role?: string | null
  collaborator_role?: string | null
  entry_conditions?: StageEntryCondition[]
  interviewer_type?: InterviewerType
  question_source?: QuestionSource | null
  required_questions?: string | null
  capture_feedback_form?: boolean
  capture_transcript?: boolean
  decision_mode?: DecisionMode
  decision_owner?: string | null
  rating_scale?: RatingScale | null
  hire_recommendation_enabled?: boolean
  override_enabled?: boolean
  override_roles?: string | null
  allowed_outcomes?: string[]
  needs_final_approval?: boolean
  display_order: number
  config?: Json
}

export type CreateTemplateInput = {
  name: string
  description?: string | null
  department?: string | null
  /** null = Stellaforce-global. Client-side users are forced to their own client. */
  client_id?: string | null
}

/** Only client admins/recruiters (and all Stellaforce staff) author templates. */
function canAuthorTemplates(profile: CurrentProfile): boolean {
  return can(profile, "author_templates")
}

/** Resolve the client_id a template must carry given who is authoring it. */
function resolveTemplateClientId(
  profile: CurrentProfile,
  requested: string | null | undefined
): { ok: true; clientId: string | null } | { ok: false; error: string } {
  if (profile.side === "client") {
    // Client users can only ever create their own client's templates.
    if (requested && requested !== profile.client_id)
      return { ok: false, error: "You can only create templates for your own client." }
    return { ok: true, clientId: profile.client_id }
  }
  // Stellaforce-side: global (null) or any client, as requested.
  return { ok: true, clientId: requested ?? null }
}

async function logAudit(
  supabase: Awaited<ReturnType<typeof createClient>>,
  actorId: string | null,
  clientId: string | null,
  entityType: string,
  entityId: string | null,
  action: string,
  diff: Json = {}
) {
  await supabase.from("audit_log").insert({
    actor_profile_id: actorId,
    client_id: clientId,
    entity_type: entityType,
    entity_id: entityId,
    action,
    diff,
  })
}

export async function createWorkflowTemplate(
  input: CreateTemplateInput
): Promise<ActionResult<{ id: string }>> {
  const profile = await getCurrentProfile()
  if (!profile) return { ok: false, error: "Not signed in." }
  if (!canAuthorTemplates(profile))
    return { ok: false, error: "You don't have permission to create workflows." }
  if (!input.name?.trim()) return { ok: false, error: "Workflow name is required." }

  const scoped = resolveTemplateClientId(profile, input.client_id)
  if (!scoped.ok) return scoped

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("workflow_templates")
    .insert({
      name: input.name.trim(),
      description: input.description ?? null,
      department: input.department ?? null,
      client_id: scoped.clientId,
      created_by: profile.id,
      status: "draft",
    })
    .select("id")
    .single()

  if (error || !data) return { ok: false, error: error?.message ?? "Could not create workflow." }
  await logAudit(supabase, profile.id, scoped.clientId, "workflow_template", data.id, "create", {
    name: input.name,
  })
  revalidatePath("/workflows")
  return { ok: true, id: data.id }
}

export async function updateWorkflowTemplate(
  id: string,
  patch: Partial<Pick<CreateTemplateInput, "name" | "description" | "department">> & {
    hiring_type?: EmploymentType | null
    status?: WorkflowTemplateStatus
  }
): Promise<ActionResult> {
  const profile = await getCurrentProfile()
  if (!profile) return { ok: false, error: "Not signed in." }
  const supabase = await createClient()
  const { error } = await supabase.from("workflow_templates").update(patch).eq("id", id)
  if (error) return { ok: false, error: error.message }
  await logAudit(supabase, profile.id, null, "workflow_template", id, "update", patch as Json)
  revalidatePath(`/workflows/${id}`)
  revalidatePath("/workflows")
  return { ok: true }
}

export async function publishWorkflowTemplate(id: string): Promise<ActionResult> {
  return updateWorkflowTemplate(id, { status: "published" })
}

export async function deleteWorkflowTemplate(id: string): Promise<ActionResult> {
  const profile = await getCurrentProfile()
  if (!profile) return { ok: false, error: "Not signed in." }
  const supabase = await createClient()
  const { error } = await supabase.from("workflow_templates").delete().eq("id", id)
  if (error) return { ok: false, error: error.message }
  await logAudit(supabase, profile.id, null, "workflow_template", id, "delete")
  revalidatePath("/workflows")
  return { ok: true }
}

/**
 * Replace all of a template's sub-stages in one save (the Stages tab commits
 * the full list). Maps the fixed pipeline_stage key → pipeline_stages.id.
 */
export async function saveTemplateSubStages(
  templateId: string,
  subStages: TemplateSubStageInput[]
): Promise<ActionResult> {
  const profile = await getCurrentProfile()
  if (!profile) return { ok: false, error: "Not signed in." }
  const supabase = await createClient()

  const { data: stages } = await supabase.from("pipeline_stages").select("id, key")
  const keyToId = new Map((stages ?? []).map((s) => [s.key as PipelineStage, s.id]))

  const rows = subStages.map((s) => {
    const pipelineStageId = keyToId.get(s.pipeline_stage_key)
    if (!pipelineStageId) throw new Error(`Unknown pipeline stage: ${s.pipeline_stage_key}`)
    return {
      template_id: templateId,
      pipeline_stage_id: pipelineStageId,
      name: s.name,
      purpose: s.purpose ?? null,
      duration_minutes: s.duration_minutes ?? null,
      format: s.format ?? null,
      visibility: s.visibility ?? "internal",
      owner_role: s.owner_role ?? null,
      collaborator_role: s.collaborator_role ?? null,
      entry_conditions: s.entry_conditions ?? ["automatic", "manual"],
      interviewer_type: s.interviewer_type ?? "human",
      question_source: s.question_source ?? null,
      required_questions: s.required_questions ?? null,
      capture_feedback_form: s.capture_feedback_form ?? true,
      capture_transcript: s.capture_transcript ?? true,
      decision_mode: s.decision_mode ?? "single_rater",
      decision_owner: s.decision_owner ?? null,
      rating_scale: s.rating_scale ?? null,
      hire_recommendation_enabled: s.hire_recommendation_enabled ?? false,
      override_enabled: s.override_enabled ?? false,
      override_roles: s.override_roles ?? null,
      allowed_outcomes: s.allowed_outcomes ?? [],
      needs_final_approval: s.needs_final_approval ?? false,
      display_order: s.display_order,
      config: s.config ?? {},
    }
  })

  const { error: delErr } = await supabase
    .from("workflow_template_sub_stages")
    .delete()
    .eq("template_id", templateId)
  if (delErr) return { ok: false, error: delErr.message }

  if (rows.length > 0) {
    const { error: insErr } = await supabase.from("workflow_template_sub_stages").insert(rows)
    if (insErr) return { ok: false, error: insErr.message }
  }

  await logAudit(supabase, profile.id, null, "workflow_template", templateId, "save_sub_stages", {
    count: rows.length,
  })
  revalidatePath(`/workflows/${templateId}`)
  return { ok: true }
}

/**
 * Upsert a workflow-scope override for a singleton settings category
 * (e.g. 'scheduling', 'ai_capabilities'). client_id is denormalized from the
 * template so tenant RLS applies.
 */
export async function upsertWorkflowSettingOverride(
  templateId: string,
  category: string,
  config: Record<string, Json>
): Promise<ActionResult> {
  const profile = await getCurrentProfile()
  if (!profile) return { ok: false, error: "Not signed in." }
  const supabase = await createClient()

  const { data: template } = await supabase
    .from("workflow_templates")
    .select("client_id")
    .eq("id", templateId)
    .single()

  const { error } = await supabase.from("workflow_settings").upsert(
    {
      scope: "workflow",
      scope_id: templateId,
      client_id: template?.client_id ?? null,
      category,
      config,
    },
    { onConflict: "scope,scope_id,category" }
  )
  if (error) return { ok: false, error: error.message }
  await logAudit(supabase, profile.id, template?.client_id ?? null, "workflow_settings", templateId, "override", {
    category,
  })
  revalidatePath(`/workflows/${templateId}`)
  return { ok: true }
}

/** Upsert a workflow-scope SLA threshold override (keyed by sla_type). */
export async function upsertWorkflowSlaOverride(
  templateId: string,
  slaType: string,
  thresholdHours: number | null,
  enabled = true
): Promise<ActionResult> {
  const profile = await getCurrentProfile()
  if (!profile) return { ok: false, error: "Not signed in." }
  const supabase = await createClient()

  const { data: template } = await supabase
    .from("workflow_templates")
    .select("client_id")
    .eq("id", templateId)
    .single()

  const { error } = await supabase.from("sla_policies").upsert(
    {
      scope: "workflow",
      scope_id: templateId,
      client_id: template?.client_id ?? null,
      sla_type: slaType,
      threshold_hours: thresholdHours,
      enabled,
    },
    { onConflict: "scope,scope_id,sla_type" }
  )
  if (error) return { ok: false, error: error.message }
  revalidatePath(`/workflows/${templateId}`)
  return { ok: true }
}
