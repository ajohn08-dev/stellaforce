import {
  automationTriggerLabel,
  type AutomationRule,
} from "@/lib/automation-rules"

/**
 * What a rule is, in the order you'd ask it: **when** it fires, **what has to
 * be true**, **what it does**, and **which clock it moves**. Optionally the two
 * longer facets — the work it creates and what happens when it can't finish.
 *
 * One component for both places a rule is explained (the job's automations
 * dialog and the company Operations section), so the same rule can't be
 * described two ways.
 */
export function AutomationRuleFacets({
  rule,
  /** Omit tasks/reminders and exceptions — the brief read, for the job dialog. */
  brief = false,
}: {
  rule: AutomationRule
  brief?: boolean
}) {
  return (
    <dl className="space-y-2">
      <Facet label="Trigger" values={[automationTriggerLabel(rule.eventId)]} />
      <Facet label="Condition" values={[rule.condition]} />
      <Facet label="Actions" values={rule.actions} />
      {/* Always rendered, "None" included: a rule with no SLA is a fact worth
          reading, and an omitted row makes you wonder whether it was missed. */}
      <Facet label="SLA" values={[rule.sla ?? "None"]} />
      {!brief && (
        <>
          <Facet label="Tasks & reminders" values={rule.tasksAndReminders} />
          <Facet label="Exceptions & escalations" values={rule.exceptions} />
        </>
      )}
    </dl>
  )
}

function Facet({ label, values }: { label: string; values: string[] }) {
  if (values.length === 0) return null
  return (
    <div className="grid grid-cols-[8rem_1fr] gap-x-3 gap-y-0.5">
      <dt className="text-xs font-medium text-foreground">{label}</dt>
      <dd className="space-y-0.5">
        {values.map((value) => (
          <p key={value} className="text-sm text-muted-foreground">
            {value}
          </p>
        ))}
      </dd>
    </div>
  )
}
