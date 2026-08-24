import { redirect } from "next/navigation"

/**
 * Settings is a nav *section* now, not a page — its two entries are Team Access
 * and Platform settings. This keeps old `/settings` links (and anything still
 * pointing here) working by landing on the first real page, and keeps the
 * sidebar's active-state check honest: with a page at `/settings` and another
 * at `/settings/team-access`, the prefix match would light up both.
 */
export default function SettingsIndexPage() {
  redirect("/settings/platform")
}
