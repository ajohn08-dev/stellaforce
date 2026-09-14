/**
 * How Platform settings divides itself — the same `?section=` rail as
 * `/automations` and `/companies`, so a setting is deep-linkable and the page
 * never becomes one long scroll of unrelated panels.
 *
 * **Automations first, profile last**, and that order is the point: the first
 * section is the one that changes what the product *does*, the last is the one
 * that only describes who you are. Anything new goes between them rather than
 * on the end.
 */
export type SettingsSectionKey = "automations" | "profile"

export type SettingsSectionDef = {
  key: SettingsSectionKey
  label: string
  /** One line under the heading saying what this section decides. */
  purpose: string
}

export const SETTINGS_SECTIONS: SettingsSectionDef[] = [
  {
    key: "automations",
    label: "Automations",
    purpose:
      "Whether the platform acts on its own. Switch an account off and nothing leaves the building for it — no agent calls, no candidate emails, no messages to the hiring team. Candidates, resumes and parsing are unaffected, and every stage move is still recorded with the action it would have taken.",
  },
  {
    key: "profile",
    label: "My Profile",
    purpose: "Who you are signed in as.",
  },
]

export function findSettingsSection(param?: string): SettingsSectionDef {
  return SETTINGS_SECTIONS.find((s) => s.key === param) ?? SETTINGS_SECTIONS[0]
}
