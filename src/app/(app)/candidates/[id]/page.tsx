import Link from "next/link"
import { notFound } from "next/navigation"

import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { TierBadge } from "@/components/tier-badge"
import { getCandidate } from "@/lib/data"
import { titleCase } from "@/lib/constants"
import type { AiLiteracySignal, ContactInfo } from "@/lib/supabase/types"

export default async function CandidateProfilePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const result = await getCandidate(id)
  if (!result) notFound()

  const { candidate: c, skills } = result
  const contact = (c.contact_info as ContactInfo | null) ?? {}

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">
              {c.full_name}
            </h1>
            <TierBadge tier={c.candidate_tier} />
          </div>
          <p className="text-muted-foreground">
            {[c.current_title, c.current_company].filter(Boolean).join(" · ") ||
              "—"}
          </p>
        </div>
        <Link href="/candidates" className={buttonVariants({ variant: "outline" })}>
          Back
        </Link>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Field label="Email" value={contact.email} />
        <Field label="Phone" value={contact.phone} />
        <Field label="Location" value={contact.location} />
        <Field label="Timezone" value={contact.tz} />
        <Field
          label="Experience"
          value={
            c.years_experience != null ? `${c.years_experience} years` : undefined
          }
        />
        <Field label="Source" value={c.source} />
        <Field
          label="LinkedIn"
          value={c.linkedin_url}
          href={c.linkedin_url ?? undefined}
        />
        <Field
          label="Portfolio"
          value={c.portfolio_url}
          href={c.portfolio_url ?? undefined}
        />
        <Field label="Languages" value={(c.languages ?? []).join(", ")} />
      </div>

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground">
          Provenance & freshness
        </h2>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Badge variant="outline">{titleCase(c.data_provenance)}</Badge>
          {c.freshness_score != null && (
            <Badge variant="secondary">
              Freshness {Number(c.freshness_score).toFixed(2)}
            </Badge>
          )}
          {c.last_verified && (
            <span className="text-muted-foreground">
              Verified {new Date(c.last_verified).toLocaleDateString()}
            </span>
          )}
        </div>
      </section>

      {c.professional_summary && (
        <section className="space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground">Summary</h2>
          <p className="text-sm leading-relaxed">{c.professional_summary}</p>
        </section>
      )}

      {c.tier_rationale && (
        <section className="space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground">
            Tier rationale
          </h2>
          <p className="text-sm leading-relaxed">{c.tier_rationale}</p>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">
          Skills ({skills.length})
        </h2>
        {skills.length === 0 ? (
          <p className="text-sm text-muted-foreground">No skills recorded.</p>
        ) : (
          <div className="grid gap-2">
            {skills.map((s) => {
              const ai = s.ai_literacy_signal as AiLiteracySignal | null
              const hasAi = ai && (ai.tool_used || ai.how_used)
              return (
                <div
                  key={s.skill_id}
                  className="flex flex-col gap-1 rounded-md border border-border p-3"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{s.skill_name}</span>
                    <Badge variant="outline" className="text-xs">
                      {titleCase(s.skill_type)}
                    </Badge>
                    {s.proficiency_level && (
                      <Badge variant="secondary" className="text-xs">
                        {titleCase(s.proficiency_level)}
                      </Badge>
                    )}
                  </div>
                  {hasAi && (
                    <p className="text-xs text-muted-foreground">
                      AI signal: {[ai?.tool_used, ai?.how_used, ai?.measurable_outcome]
                        .filter(Boolean)
                        .join(" — ")}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* TODO(workflow-3): refer / update loop — surface referral + enrichment here. */}
    </div>
  )
}

function Field({
  label,
  value,
  href,
}: {
  label: string
  value?: string | null
  href?: string
}) {
  return (
    <div className="space-y-0.5">
      <div className="text-xs text-muted-foreground">{label}</div>
      {href && value ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm hover:underline break-all"
        >
          {value}
        </a>
      ) : (
        <div className="text-sm">{value || "—"}</div>
      )}
    </div>
  )
}
