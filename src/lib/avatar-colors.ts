/** Deterministic initials + color assignment for candidate avatars — no photo upload exists yet. */

export function getInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/)
  const first = parts[0]?.[0] ?? ""
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : ""
  return (first + last).toUpperCase()
}

/** Preferred over getInitials when first_name/last_name are available directly (e.g. candidates) — no string-splitting guesswork. */
export function getInitialsFromParts(firstName: string, lastName: string): string {
  return ((firstName[0] ?? "") + (lastName[0] ?? "")).toUpperCase()
}

/** Same bg-100/dark:bg-950 + text-900/dark:text-200 shape as TIER_BADGE_CLASS / JOB_STATUS_BADGE_CLASS. */
const AVATAR_COLOR_CLASSES: string[] = [
  "bg-brand-purple-100 text-brand-purple-900 dark:bg-brand-purple-950 dark:text-brand-purple-200",
  "bg-brand-orange-100 text-brand-orange-900 dark:bg-brand-orange-950 dark:text-brand-orange-200",
  "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
  "bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-200",
  "bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-200",
]

/** Simple string hash so the same name always lands on the same color. */
function hash(input: string): number {
  let h = 0
  for (let i = 0; i < input.length; i++) {
    h = (Math.imul(h, 31) + input.charCodeAt(i)) >>> 0
  }
  return h
}

export function getAvatarColorClass(seed: string): string {
  return AVATAR_COLOR_CLASSES[hash(seed) % AVATAR_COLOR_CLASSES.length]
}
