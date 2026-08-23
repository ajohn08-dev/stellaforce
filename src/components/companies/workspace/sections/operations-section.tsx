import { Zap } from "lucide-react"

import { SectionNote } from "@/components/companies/shared/section-note"
import { SectionShell } from "@/components/companies/workspace/section-shell"
import type { SectionDef } from "@/components/companies/workspace/company-sections"
import type { CompanyReadiness } from "@/lib/company-readiness"
import type { Company } from "@/lib/mock-companies"
import { AUTOMATION_SECTIONS } from "@/lib/automation-sections"
import { AutomationRuleRows } from "@/components/automations/automation-rule-rows"
import {
  INTERVIEWER_PREP_SETTINGS,
  INVITE_SETTINGS,
  REMINDER_SETTINGS,
  resolveCommunicationSetting,
  type CommunicationSettingDef,
} from "@/lib/communication-policy"
import { POLICY_SCOPE_LABEL } from "@/lib/policy-settings"

/**
 * **Operating setup** — the one part of this workspace that isn't company
 * knowledge.
 *
 * Every other section holds facts this company owns and a recruiter writes.
 * These two hold rules and message settings that arrive from the global
 * library and *reach* this company's roles.
 *
 * This is the **company scope** of the cascade
 * (`global → company → team … → job`), so what's set here is the default for
 * every role at this company — the ones open now and any added later — and a
 * workflow or an individual role can still override it. That blast radius is
 * the whole point of setting it here rather than role by role, and it's what
 * the note at the top says, because "applies to future jobs too" is the part
 * nobody infers.
 *
 * Values are displayed with the scope that produced them, so the page answers
 * **"what will actually run on our roles, and where did it come from"**. Every
 * row currently reads *From system defaults*: there is no company-scoped
 * policy to write to yet, so this is display-only for now.
 */
export function OperationsSection({
  company,
  section,
  readiness,
}: {
  company: Company
  section: SectionDef
  readiness: CompanyReadiness
}) {
  const activeJobs = company.jobs.filter((j) => j.status === "open" || j.status === "draft")

  return (
    <SectionShell section={section} readiness={readiness}>
      <SectionNote kind="rule">
        Set here, these apply to every role at this company — the{" "}
        {activeJobs.length === 1 ? "1 role open now" : `${activeJobs.length} roles open now`} and
        any added later. A workflow or an individual role can still override them. Values start
        as Stellaforce&apos;s global defaults; editing arrives with the company policy tables.
      </SectionNote>

      {activeJobs.length === 0 && (
        <SectionNote kind="attention">
          No role is open here yet, so none of this is running — it takes effect on the first one
          you add.
        </SectionNote>
      )}

      {section.key === "automations" ? <AutomationsBody /> : <CommunicationsBody />}
    </SectionShell>
  )
}

/**
 * The rules reaching this company's roles, grouped the way `/automations`
 * groups them — same source, so a rule promised here is one that exists there.
 * Trigger lists come from `AUTOMATION_EVENT_GROUPS`, which the workflow
 * settings tab also renders.
 */
function AutomationsBody() {
  // `runs` is a log of executions, not a set of rules — it has no place in a
  // library of what *will* run.
  const groups = AUTOMATION_SECTIONS.filter((s) => s.eventGroup)

  return (
    <div className="space-y-3">
      {groups.map((group) => (
        <section key={group.key} className="space-y-2 rounded-lg border border-border p-4">
          <div className="space-y-1">
            <h3 className="flex items-center gap-2 text-sm font-medium">
              <Zap className="size-4 shrink-0 text-muted-foreground" />
              {group.label}
            </h3>
            <p className="text-sm text-muted-foreground">{group.purpose}</p>
          </div>

          <div className="border-t border-border pt-1">
            <AutomationRuleRows groupTitle={group.eventGroup!} />
          </div>
        </section>
      ))}
    </div>
  )
}

/**
 * What this company's candidates and interviewers will actually be sent —
 * resolved through the same cascade the workflow tab uses
 * (`src/lib/communication-policy.ts`), with the scope that won on every row.
 *
 * The company layer is passed empty deliberately: there is no company-scoped
 * communication policy to store to yet, so every row reads "From system
 * defaults" and says so rather than implying this company has chosen anything.
 * Once one exists it slots in as `{ company: ... }` and the scope labels update
 * themselves.
 */
function CommunicationsBody() {
  const groups: { title: string; settings: CommunicationSettingDef[] }[] = [
    { title: "Invites & confirmations", settings: INVITE_SETTINGS },
    { title: "Reminders", settings: REMINDER_SETTINGS },
    { title: "Interviewer prep", settings: INTERVIEWER_PREP_SETTINGS },
  ]

  return (
    <div className="space-y-3">
      {groups.map((group) => (
        <section key={group.title} className="space-y-2 rounded-lg border border-border p-4">
          <h3 className="text-sm font-medium">{group.title}</h3>

          <dl className="divide-y divide-border border-t border-border">
            {group.settings.map((setting) => {
              const resolved = resolveCommunicationSetting(setting.key, {})
              const label =
                setting.options.find((o) => o.value === resolved.value)?.label ?? resolved.value
              return (
                <div
                  key={setting.key}
                  className="flex items-baseline justify-between gap-4 py-2"
                >
                  <dt className="min-w-0">
                    <span className="text-sm text-foreground">{setting.label}</span>
                    <span className="block text-xs text-muted-foreground">
                      {setting.description}
                    </span>
                  </dt>
                  <dd className="shrink-0 text-right">
                    <span className="text-sm font-medium text-foreground">{label}</span>
                    <span className="block text-xs text-muted-foreground">
                      From {POLICY_SCOPE_LABEL[resolved.source].toLowerCase()}
                    </span>
                  </dd>
                </div>
              )
            })}
          </dl>
        </section>
      ))}
    </div>
  )
}
