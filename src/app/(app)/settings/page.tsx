import { getCurrentProfile } from "@/lib/auth"

export default async function SettingsPage() {
  const profile = await getCurrentProfile()

  return (
    <div className="space-y-6 p-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Your account details.
        </p>
      </div>

      {profile && (
        <div className="max-w-md rounded-lg border border-border p-5">
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Email</dt>
              <dd className="font-medium">{profile.email}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Role</dt>
              <dd className="font-medium capitalize">{profile.role}</dd>
            </div>
          </dl>
        </div>
      )}

      <p className="text-sm text-muted-foreground">
        Role management is coming soon — for now, roles are assigned manually
        in Supabase.
      </p>
    </div>
  )
}
