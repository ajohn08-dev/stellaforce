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

/**
 * Administering an account, which the capability matrix above cannot express.
 *
 * `can()` short-circuits `side === "stellaforce"` to true, which is right for a
 * feature capability — Stellaforce staff operate every part of the product on a
 * customer's behalf. It is wrong for a control whose whole point is that only an
 * *admin* may touch it, because that short-circuit erases the difference
 * between a Stellaforce recruiter and a Stellaforce admin.
 *
 * So these are predicates, not capabilities. Adding an `administer_account`
 * entry to the matrix would have been the same bug with more ceremony.
 */

/** A Stellaforce admin: may set the global default and any account's switch. */
export function isPlatformAdmin(subject: PermissionSubject | null): boolean {
  return subject?.side === "stellaforce" && subject.role === "admin"
}

/**
 * Anyone on the Stellaforce side, of any role — the gate for internal-only
 * surfaces that read across every client at once.
 *
 * Advanced Search is the first: it queries the whole candidate brain with no
 * client scope, so it is internal-only for V1 regardless of how capable a
 * client-side role is. A `Capability` entry would have been wrong twice over —
 * `can()` short-circuits `side === "stellaforce"` to true, so every Stellaforce
 * role would pass (correct here, but by accident), and any client role granted
 * that capability would pass too (never correct here).
 *
 * Deliberately not `isPlatformAdmin`: a Stellaforce *recruiter* searching
 * candidates is the entire point of the feature.
 */
export function isStellaforceStaff(subject: PermissionSubject | null): boolean {
  return subject?.side === "stellaforce"
}

/** An admin of some account — theirs, or (for Stellaforce staff) anyone's. */
export function isAccountAdmin(subject: PermissionSubject | null): boolean {
  if (!subject) return false
  return subject.side === "stellaforce"
    ? subject.role === "admin"
    : subject.client_role === "admin"
}
