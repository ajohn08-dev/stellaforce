import { Suspense } from "react"

import { SetSidebarCollapsed } from "@/components/set-sidebar-collapsed"
import { SettingsSectionNav } from "@/components/settings/settings-section-nav"
import { AccountAutomationsSection } from "@/components/settings/account-automations-section"
import { getCurrentProfile } from "@/lib/auth"
import { findSettingsSection } from "@/lib/settings-sections"

/**
 * Platform settings, as a rail of sections rather than one scroll.
 *
 * Same shell as `/automations` and `/companies` — a body that scrolls on its
 * own beside a `?section=`-driven rail, so every setting is deep-linkable.
 * Automations sits first because it is the section that changes what the
 * product *does*; the profile is last because it only says who you are.
 *
 * The account-wide automation switch lives here rather than under Operations
 * beside `/automations`: that page is the rule *library* (what automations
 * exist and what each does), while this is one switch an admin sets and leaves
 * alone. They meet only at the library's banner, which links here.
 */
export default async function PlatformSettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = await searchParams
  const section = findSettingsSection(typeof sp.section === "string" ? sp.section : undefined)
  const profile = await getCurrentProfile()

  return (
    <div
      className="flex flex-col overflow-hidden"
      // Inline style, not an arbitrary Tailwind class: <main> has no padding of
      // its own, so only the app header (h-14 = 3.5rem) needs subtracting.
      style={{ height: "calc(100vh - 3.5rem)" }}
    >
      <SetSidebarCollapsed />

      {/* No page heading. The app header already resolves "Platform settings"
          from the nav entry (`currentTitle`), and repeating it directly
          underneath was the same words twice in 60px. `/automations` has a strip
          here because it holds a toolbar; this page has nothing to put in one. */}
      <div className="flex min-h-0 flex-1 gap-6 p-4">
        <Suspense fallback={<div className="w-56 shrink-0" />}>
          <SettingsSectionNav active={section.key} />
        </Suspense>

        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto">
          <div className="flex max-w-3xl flex-col gap-4">
            <div className="flex flex-col gap-0.5">
              <h2 className="text-sm font-medium text-foreground">{section.label}</h2>
              <p className="text-sm text-muted-foreground">{section.purpose}</p>
            </div>

            {section.key === "automations" ? (
              <AccountAutomationsSection />
            ) : (
              <ProfileSection profile={profile} />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function ProfileSection({
  profile,
}: {
  profile: Awaited<ReturnType<typeof getCurrentProfile>>
}) {
  if (!profile) {
    return <p className="text-sm text-muted-foreground">Sign in to see this.</p>
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border border-border p-5">
        <dl className="space-y-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Email</dt>
            <dd className="font-medium">{profile.email}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Role</dt>
            {/* `role` is null for client-side profiles, where `client_role`
                carries it — the old page showed a blank for every client user. */}
            <dd className="font-medium capitalize">{profile.role ?? profile.client_role}</dd>
          </div>
          {profile.client_name && (
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Account</dt>
              <dd className="font-medium">{profile.client_name}</dd>
            </div>
          )}
        </dl>
      </div>
      <p className="text-sm text-muted-foreground">
        Role management is coming soon — for now, roles are assigned manually in
        Supabase.
      </p>
    </div>
  )
}
