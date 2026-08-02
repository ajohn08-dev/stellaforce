import type { ClientRole, ProfileSide, UserRole } from "@/lib/supabase/types"

/**
 * Central capability model. Every role-gated action in the app should ask
 * `can(profile, "<capability>")` rather than comparing `client_role` inline,
 * so the policy lives in one place.
 *
 * This module is intentionally free of `server-only` and of any Supabase
 * import so it can also drive conditional rendering on the client (e.g. hiding
 * a button a role can't use). Enforcement of a write still happens server-side.
 */
export type Capability =
  /** Create / edit reusable workflow templates. */
  | "author_templates"
  /** Invite / manage other users within the client org. */
  | "manage_client_users"
  /** Submit interview feedback / scorecard evaluations on candidates. */
  | "review_candidates"
  /** View jobs, applications, and the candidate pipeline. */
  | "view_pipeline"

/** Minimal profile shape needed to decide permissions (client-safe subset). */
export type PermissionSubject = {
  side: ProfileSide
  role: UserRole | null
  client_role: ClientRole | null
}

/**
 * Client-side capability matrix, keyed by `client_role`. Stellaforce-side staff
 * are handled separately in `can()` (they pass every gate the app currently
 * defines). Keep this in sync with the `client_role` enum in the DB.
 */
const CLIENT_ROLE_CAPABILITIES: Record<ClientRole, readonly Capability[]> = {
  admin: ["author_templates", "manage_client_users", "review_candidates", "view_pipeline"],
  recruiter: ["author_templates", "review_candidates", "view_pipeline"],
  hiring_manager: ["review_candidates", "view_pipeline"],
  reviewer: ["review_candidates", "view_pipeline"],
}

/** True if `subject` is allowed to perform `capability`. */
export function can(subject: PermissionSubject, capability: Capability): boolean {
  // Stellaforce-side staff can do everything the app currently gates.
  if (subject.side === "stellaforce") return true
  if (!subject.client_role) return false
  return CLIENT_ROLE_CAPABILITIES[subject.client_role].includes(capability)
}
