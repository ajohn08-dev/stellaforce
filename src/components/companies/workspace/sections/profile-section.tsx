import { EyeOff } from "lucide-react"

import {
  EditablePills,
  EditableSelect,
  EditableText,
  FieldRow,
} from "@/components/companies/shared/editable-field"
import { RestrictedPanel } from "@/components/companies/shared/restricted-panel"
import { SectionQuestions } from "@/components/companies/shared/section-questions"
import {
  FieldCard,
  SectionShell,
} from "@/components/companies/workspace/section-shell"
import type { SectionDef } from "@/components/companies/workspace/company-sections"
import { faqSection, type CompanyReadiness } from "@/lib/company-readiness"
import {
  COMPANY_STAGE_LABELS,
  OPERATING_MODEL_LABELS,
  RELATIONSHIP_HEALTH_LABELS,
  type Company,
} from "@/lib/mock-companies"
import { DISCLOSURE_PRESET_ORDER, DISCLOSURE_PRESETS } from "@/lib/company-visibility"

const STAGE_OPTIONS = Object.entries(COMPANY_STAGE_LABELS).map(([value, label]) => ({
  value,
  label,
}))
const MODEL_OPTIONS = Object.entries(OPERATING_MODEL_LABELS).map(([value, label]) => ({
  value,
  label,
}))
const HEALTH_OPTIONS = Object.entries(RELATIONSHIP_HEALTH_LABELS).map(
  ([value, label]) => ({ value, label })
)
const PRIORITY_OPTIONS = [
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
]
const PRESET_OPTIONS = DISCLOSURE_PRESET_ORDER.map((k) => ({
  value: k,
  label: `${DISCLOSURE_PRESETS[k].label} — ${DISCLOSURE_PRESETS[k].summary}`,
}))

/**
 * The identity facts every job and agent starts from — every one of them
 * editable in place.
 *
 * Candidate-safe fields sit above a labeled divider; the account block below it
 * is internal, and commercial terms below that are restricted. The divider does
 * work a badge can't: it tells you which *region* of the page you're in, so you
 * don't have to check each field individually before speaking.
 */
export function ProfileSection({
  company,
  section,
  readiness,
  today,
}: {
  company: Company
  section: SectionDef
  readiness: CompanyReadiness
  today: Date
}) {
  const questions = company.faq.filter((f) => faqSection(f.category) === section.key)

  return (
    <SectionShell section={section} readiness={readiness}>
      <FieldCard title="Identity">
        <FieldRow label="Preferred name" hint="What the agent calls them">
          <EditableText
            fieldKey="preferredName"
            value={company.preferredName}
            ariaLabel="Preferred name"
            className="font-medium"
          />
        </FieldRow>
        <FieldRow label="Legal name">
          <EditableText
            fieldKey="legalName"
            value={company.legalName}
            ariaLabel="Legal name"
          />
        </FieldRow>
        <FieldRow label="Tagline">
          <EditableText
            fieldKey="tagline"
            value={company.tagline}
            ariaLabel="Tagline"
          />
        </FieldRow>
        <FieldRow label="Website">
          <EditableText
            fieldKey="website"
            value={company.website}
            placeholder="https://"
            ariaLabel="Website"
          />
        </FieldRow>
        <FieldRow label="LinkedIn">
          <EditableText
            fieldKey="linkedinUrl"
            value={company.linkedinUrl}
            placeholder="https://linkedin.com/company/…"
            ariaLabel="LinkedIn"
          />
        </FieldRow>
      </FieldCard>

      <FieldCard title="Where they are">
        <FieldRow label="Headquarters">
          <EditableText
            fieldKey="headquarters"
            value={company.headquarters}
            ariaLabel="Headquarters"
          />
        </FieldRow>
        <FieldRow label="Office locations">
          <EditablePills
            fieldKey="officeLocations"
            values={company.officeLocations}
            addLabel="Add location"
            ariaLabel="Office locations"
          />
        </FieldRow>
        <FieldRow label="Countries of operation">
          <EditablePills
            fieldKey="countries"
            values={company.countriesOfOperation}
            addLabel="Add country"
            ariaLabel="Countries of operation"
          />
        </FieldRow>
        <FieldRow label="Operating model">
          <EditableSelect
            fieldKey="operatingModel"
            value={company.operatingModel}
            options={MODEL_OPTIONS}
            ariaLabel="Operating model"
          />
        </FieldRow>
      </FieldCard>

      <FieldCard title="Shape of the business">
        <FieldRow label="Industry">
          <EditableText
            fieldKey="industry"
            value={company.industry}
            ariaLabel="Industry"
          />
        </FieldRow>
        <FieldRow label="Sub-industry">
          <EditableText
            fieldKey="subIndustry"
            value={company.subIndustry}
            ariaLabel="Sub-industry"
          />
        </FieldRow>
        <FieldRow label="Stage">
          <EditableSelect
            fieldKey="stage"
            value={company.stage}
            options={STAGE_OPTIONS}
            ariaLabel="Company stage"
          />
        </FieldRow>
        <FieldRow label="Founded">
          <EditableText
            fieldKey="foundedYear"
            value={company.foundedYear?.toString()}
            placeholder="Year"
            ariaLabel="Founding year"
          />
        </FieldRow>
        <FieldRow label="Employees">
          <EditableText
            fieldKey="employeeRange"
            value={company.employeeRange}
            placeholder="e.g. 150–200"
            ariaLabel="Employee range"
          />
        </FieldRow>
        <FieldRow label="Products">
          <EditablePills
            fieldKey="products"
            values={company.productCategories}
            addLabel="Add product"
            ariaLabel="Product categories"
          />
        </FieldRow>
        <FieldRow label="Customers">
          <EditablePills
            fieldKey="customers"
            values={company.customerTypes}
            addLabel="Add customer type"
            ariaLabel="Customer types"
          />
        </FieldRow>
        <FieldRow label="Verticals">
          <EditablePills
            fieldKey="verticals"
            values={company.verticals}
            addLabel="Add vertical"
            ariaLabel="Verticals"
          />
        </FieldRow>
      </FieldCard>

      <SectionQuestions
        entries={questions}
        today={today}
        emptyPrompt="Nothing recorded yet. Questions about company size, growth, and stability belong here — agents will escalate them until you add one."
      />

      <div className="flex items-center gap-3 pt-4">
        <span className="h-px flex-1 bg-border" />
        <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <EyeOff className="size-3.5" />
          Recruiters only — never reaches a candidate
        </span>
        <span className="h-px flex-1 bg-border" />
      </div>

      <FieldCard title="The account">
        <FieldRow label="Account owner">
          <EditableText
            fieldKey="accountOwner"
            value={company.accountOwner}
            ariaLabel="Account owner"
          />
        </FieldRow>
        <FieldRow label="Relationship health">
          <EditableSelect
            fieldKey="relationshipHealth"
            value={company.relationshipHealth}
            options={HEALTH_OPTIONS}
            ariaLabel="Relationship health"
          />
        </FieldRow>
        <FieldRow label="Internal priority">
          <EditableSelect
            fieldKey="internalPriority"
            value={company.internalPriority}
            options={PRIORITY_OPTIONS}
            ariaLabel="Internal priority"
          />
        </FieldRow>
        <FieldRow label="Responsiveness">
          <EditableText
            fieldKey="responsivenessNotes"
            value={company.responsivenessNotes}
            ariaLabel="Responsiveness notes"
          />
        </FieldRow>
        <FieldRow
          label="Disclosure preset"
          hint="Seeds defaults for new items"
        >
          <EditableSelect
            fieldKey="disclosurePreset"
            value={company.disclosurePreset}
            options={PRESET_OPTIONS}
            ariaLabel="Disclosure preset"
          />
        </FieldRow>
      </FieldCard>

      <RestrictedPanel
        title="Commercial terms"
        reason="Contract status and search exclusivity. Limited to the account owner and internal admins."
      >
        <div className="divide-y divide-border">
          <FieldRow label="Contract status">
            <EditableText
              fieldKey="contractStatus"
              value={company.contractStatus}
              ariaLabel="Contract status"
            />
          </FieldRow>
          <FieldRow label="Search exclusivity">
            <EditableText
              fieldKey="searchExclusivity"
              value={company.searchExclusivity}
              ariaLabel="Search exclusivity"
            />
          </FieldRow>
        </div>
      </RestrictedPanel>
    </SectionShell>
  )
}
