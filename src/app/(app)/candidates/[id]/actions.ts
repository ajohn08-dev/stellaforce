"use server"

import { revalidatePath } from "next/cache"

import { getCurrentProfile } from "@/lib/auth"
import { isStellaforceStaff } from "@/lib/permissions"
import { createClient } from "@/lib/supabase/server"
import { reconcileCandidateSearchEnrichment } from "@/lib/server/candidate-search-enrichment"
import type { RoleFamily, TitleSeniority } from "@/lib/supabase/types"

/**
 * The recruiter's manual override of a candidate's search classification.
 *
 * This is deliberately **not** general candidate editing. It writes the four
 * classification columns and the three provenance columns that go with them,
 * and nothing else — `current_title`, `current_company`, `headline`, work
 * history and every identity field are untouched here, as they are everywhere
 * else in this feature.
 *
 * **Stellaforce-side only**, enforced here rather than only in the UI: a Server
 * Action is a POST endpoint in its own right, so a client-side profile that
 * never renders the control can still invoke it if it holds the action id. The
 * same reasoning as `runAiCandidateSearch`. RLS is a second line rather than
 * the only one — a client user may legitimately *read* a candidate submitted to
 * their job, and `candidates_update` would let them write one their own client
 * entered; neither may reclassify the global candidate brain.
 */

export type ClassificationResult = { ok: true } | { ok: false; error: string }

export type ClassificationInput = {
  candidateId: string
  /** The chosen role, or null for "unclassified role". */
  canonicalRoleId: string | null
  /** May stand alone: a title can be clearly sales without matching a known role. */
  roleFamily: RoleFamily | null
  seniority: TitleSeniority | null
}

export async function setCandidateTitleClassification(
  input: ClassificationInput
): Promise<ClassificationResult> {
  const profile = await getCurrentProfile()
  if (!isStellaforceStaff(profile)) {
    return { ok: false, error: "You don't have access to change this." }
  }

  const supabase = await createClient()

  // Re-read the candidate rather than trusting anything the form carried. This
  // is also what supplies `normalized_from_title`: the classification must
  // record the title it was actually made against, or the re-parse policy has
  // nothing to compare and a later résumé upload would look unchanged.
  const { data: candidate, error: readError } = await supabase
    .from("candidates")
    .select("candidate_id, current_title")
    .eq("candidate_id", input.candidateId)
    .maybeSingle()

  if (readError) return { ok: false, error: readError.message }
  if (!candidate) return { ok: false, error: "That candidate no longer exists." }

  // Validate the role against the taxonomy, not against what the UI believed
  // when it rendered — a disabled option is a courtesy, this is the rule.
  let roleFamily = input.roleFamily
  if (input.canonicalRoleId) {
    const { data: role } = await supabase
      .from("canonical_roles")
      .select("id, role_family, is_active")
      .eq("id", input.canonicalRoleId)
      .maybeSingle()

    if (!role) return { ok: false, error: "That role no longer exists." }
    if (!role.is_active) {
      return { ok: false, error: "That role has been retired and can't be assigned." }
    }
    // A role and a family that disagree would make "sales candidates" and
    // "account executives" return different people for the same candidate.
    if (roleFamily !== null && roleFamily !== role.role_family) {
      return {
        ok: false,
        error: "That role belongs to a different family. Pick the role's own family.",
      }
    }
    roleFamily = role.role_family
  }

  // One atomic write of the whole classification. Partial updates are how a
  // candidate ends up with a role from one decision and a seniority from
  // another.
  const { error: writeError } = await supabase
    .from("candidates")
    .update({
      canonical_role_id: input.canonicalRoleId,
      role_family: roleFamily,
      seniority: input.seniority,
      title_normalization_source: "recruiter",
      // A person decided. There is no lower confidence than that available.
      title_normalization_confidence: "high",
      normalized_from_title: candidate.current_title,
      title_normalized_at: new Date().toISOString(),
    })
    .eq("candidate_id", input.candidateId)

  if (writeError) return { ok: false, error: writeError.message }

  // `audit_log`, not `activity_events`: this records what a recruiter
  // configured about a record, not something that happened to a person — the
  // same split the automation writes follow. `client_id` is null because the
  // candidate brain is global and belongs to no client.
  const { error: auditError } = await supabase.from("audit_log").insert({
    actor_profile_id: profile?.id ?? null,
    client_id: null,
    entity_type: "candidate_title_classification",
    entity_id: input.candidateId,
    action: "classification_overridden",
    diff: {
      canonical_role_id: input.canonicalRoleId,
      role_family: roleFamily,
      seniority: input.seniority,
      source: "recruiter",
    },
  })
  // An audit failure must not roll back a write that already landed, but it
  // must not pass silently either.
  if (auditError) {
    console.error("title classification audit write failed:", auditError.message)
  }

  // Recompute readiness around the recruiter's decision — clearing
  // `unclassified_title` and `override_title_changed`, and re-checking whatever
  // else is missing. `skipTitleNormalization` because a human just decided the
  // classification: there is nothing left to normalize, and re-running the rules
  // over their choice is exactly how an override gets quietly undone.
  await reconcileCandidateSearchEnrichment(supabase, input.candidateId, {
    reason: "override",
    skipTitleNormalization: true,
  })

  revalidatePath(`/candidates/${input.candidateId}`)
  return { ok: true }
}
