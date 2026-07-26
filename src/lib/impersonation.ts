/**
 * Holds the original admin's session (access + refresh token) while they're
 * viewing the app as another Stellaforce user, so "Return to my account" can
 * restore it. httpOnly + secure — never readable from client JS. Independent
 * of Supabase's own session cookies, so switching identities doesn't disturb it.
 */
export const IMPERSONATOR_COOKIE = "sf_impersonator_session"
