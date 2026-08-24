import type { ResolvedAutomation } from "@/lib/automation-resolve"

/**
 * What a rule is, in the order you'd ask it: **when** it fires, **what has to
 * be true**, **what it does**, and **which clock it moves**. Optionally the two
 * longer facets — the work it creates and what happens when it can't finish.
 *
 * One component for every place a rule is explained (the job's automations
 * dialog, the global library, the workflow tab, the company Operations
 * section), so the same rule can't be described two ways.
 *
 * Reads the published version's facets off the resolved automation, so what is
 * described here is what the resolver actually resolved — not a parallel copy.
 */
export function AutomationRuleFacets({
  automation,
  /** Omit tasks/reminders and exceptions — the brief read, for the job dialog. */
  brief = false,
}: {
  automation: ResolvedAutomation
  brief?: boolean
}) {
  return (
    <dl className="space-y-2">
      <Facet label="Trigger" values={[automation.name]} />
      <Facet label="Condition" values={[automation.conditionText]} />
      <Facet label="Actions" values={automation.actions.map((a) => a.label)} />
      {/* Always rendered, "None" included: a rule with no SLA is a fact worth
          reading, and an omitted row makes you wonder whether it was missed. */}
      <Facet label="SLA" values={[slaLabel(automation.slaType)]} />
      {!brief && (
        <>
          <Facet
            label="Tasks & reminders"
            values={automation.tasksAndReminders.map((t) => t.label)}
          />
          <Facet
            label="Exceptions & escalations"
            values={automation.exceptions.map((e) => e.label)}
          />
        </>
      )}
    </dl>
  )
}

/**
 * `sla_policies.sla_type` is a snake_case key shared with the SLA settings tab;
 * it is shown here in the same words that tab uses.
 */
function slaLabel(slaType: string | null): string {
  if (!slaType) return "None"
  return slaType.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase())
}

function Facet({ label, values }: { label: string; values: string[] }) {
  const shown = values.filter(Boolean)
  if (shown.length === 0) return null
  return (
    <div className="grid grid-cols-[8rem_1fr] gap-x-3 gap-y-0.5">
      <dt className="text-xs font-medium text-foreground">{label}</dt>
      <dd className="space-y-0.5">
        {shown.map((value) => (
          <p key={value} className="text-sm text-muted-foreground">
            {value}
          </p>
        ))}
      </dd>
    </div>
  )
}
