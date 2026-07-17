import type { CandidateRow, EducationEntry } from "@/lib/supabase/types"

type CertificationEntry = { name?: string; issuer?: string; year?: string }

export function EducationTab({ candidate }: { candidate: CandidateRow }) {
  const entries = Array.isArray(candidate.education)
    ? (candidate.education as EducationEntry[])
    : []
  const certifications = Array.isArray(candidate.certifications)
    ? (candidate.certifications as CertificationEntry[])
    : []
  const languages = candidate.languages ?? []

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">Education</h2>
        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">No education recorded.</p>
        ) : (
          <div className="space-y-3">
            {entries.map((e, i) => (
              <div key={i} className="rounded-lg border border-border p-3">
                <p className="text-sm font-medium">
                  {[e.degree, e.field_of_study].filter(Boolean).join(", ") || "—"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {[e.institution, e.end_date].filter(Boolean).join(" · ")}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      {certifications.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground">
            Certifications
          </h2>
          <div className="space-y-2">
            {certifications.map((c, i) => (
              <p key={i} className="text-sm">
                {[c.name, c.issuer, c.year].filter(Boolean).join(" · ")}
              </p>
            ))}
          </div>
        </section>
      )}

      {languages.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground">Languages</h2>
          <p className="text-sm">{languages.join(", ")}</p>
        </section>
      )}
    </div>
  )
}
