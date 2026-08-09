/**
 * Persists the user's explicit sidebar expand/collapse choice. Read
 * server-side in the app layout so the first paint matches the stored
 * preference (no flash), written client-side by the sidebar toggle.
 *
 * Shared by server and client code, so it lives outside the `"use client"`
 * sidebar-context module.
 */
export const SIDEBAR_COOKIE = "sf_sidebar_collapsed"

/** Absent cookie → collapsed, which is the sidebar's default state. */
export function sidebarCollapsedFromCookie(value: string | undefined) {
  return value !== "0"
}
