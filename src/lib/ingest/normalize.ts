import {
  NormalizedIngestPayloadSchema,
  type NormalizedCertification,
  type NormalizedEducation,
  type NormalizedIngestPayload,
  type NormalizedLink,
  type NormalizedSkill,
  type NormalizedWorkExperience,
  type RawWebhookItem,
} from "@/lib/ingest/schema"

/**
 * Raw n8n payload -> normalized internal domain model.
 *
 * This is the ONLY place that interprets n8n's LLM-derived shape. Everything
 * downstream (the service layer) works off NormalizedIngestPayload and never
 * looks at the raw webhook body again.
 */

const EMPLOYMENT_TYPE_MAP: Record<string, NormalizedWorkExperience["employment_type"]> = {
  "full-time": "full-time",
  "fulltime": "full-time",
  "full time": "full-time",
  "part-time": "part-time",
  "parttime": "part-time",
  "part time": "part-time",
  "contract": "contract",
  "contractor": "contract",
  "freelance": "freelance",
  "internship": "internship",
  "intern": "internship",
}

function normalizeEmploymentType(
  raw: string | null
): NormalizedWorkExperience["employment_type"] {
  if (!raw) return null
  const key = raw.trim().toLowerCase()
  return EMPLOYMENT_TYPE_MAP[key] ?? null
}

/** case-insensitive de-dupe that keeps the first occurrence (priority order matters). */
function dedupeByKey<T>(items: T[], keyOf: (item: T) => string): T[] {
  const seen = new Set<string>()
  const out: T[] = []
  for (const item of items) {
    const key = keyOf(item).toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(item)
  }
  return out
}

// ── Link normalization ───────────────────────────────────────────────────────

const LINK_HOST: Record<"linkedin" | "github", string> = {
  linkedin: "linkedin.com",
  github: "github.com",
}

/**
 * Turns a raw, possibly-malformed link value into a canonical URL for the
 * given type. Handles:
 *  - proper URLs (kept as-is, re-hosted if the domain doesn't match — a
 *    LinkedIn field pointing at a github.com URL is filed under "other")
 *  - bare "domain.com/path" without a scheme
 *  - malformed pseudo-URLs like "Github:// uday966666" or "LinkedIn://"
 *    (label, no real host — the value after `://` is treated as a
 *    username/slug and rebuilt into a real URL)
 *  - a bare username/slug with no scheme or domain at all
 */
export function normalizeLinkUrl(
  raw: string,
  type: "linkedin" | "github" | "portfolio"
): { url: string; link_type: "linkedin" | "github" | "portfolio" | "other" } | null {
  const trimmed = raw.trim().replace(/\s+/g, "")
  if (!trimmed) return null

  // Malformed "Label://slug" (no real host after the scheme separator).
  const pseudoMatch = trimmed.match(/^[a-z]+:\/\/\/?(.*)$/i)
  if (pseudoMatch && !/^https?:\/\//i.test(trimmed)) {
    const slug = pseudoMatch[1].replace(/^\/+/, "")
    if (!slug) return null
    if (type === "linkedin" || type === "github") {
      return { url: `https://${LINK_HOST[type]}/${type === "linkedin" ? "in/" : ""}${slug}`, link_type: type }
    }
    return { url: `https://${slug}`, link_type: "portfolio" }
  }

  let candidate = trimmed
  if (!/^https?:\/\//i.test(candidate)) {
    candidate = `https://${candidate}`
  }

  try {
    const parsed = new URL(candidate)
    if (type === "linkedin" || type === "github") {
      const expectedHost = LINK_HOST[type]
      if (!parsed.hostname.replace(/^www\./, "").includes(expectedHost)) {
        // Doesn't actually point at the expected platform — file as "other"
        // rather than dropping it or mislabeling it.
        return { url: parsed.toString(), link_type: "other" }
      }
    }
    return { url: parsed.toString(), link_type: type }
  } catch {
    // Not a URL and not a recognizable "label://slug" pattern either — treat
    // the whole value as a bare username/slug for linkedin/github.
    if (type === "linkedin") return { url: `https://linkedin.com/in/${candidate.replace(/^\/+/, "")}`, link_type: "linkedin" }
    if (type === "github") return { url: `https://github.com/${candidate.replace(/^\/+/, "")}`, link_type: "github" }
    return null
  }
}

/**
 * Backfill links from the raw extracted resume text when the LLM/extraction
 * step didn't populate extractedLinks or the profile's *_url fields. Looks
 * for "Github://x", "LinkedIn://x", or bare "linkedin.com/in/x" patterns,
 * tolerating a line break between the label and the slug (common with
 * PDF-extracted text, e.g. "LinkedIn://\nuday-rakhelkar-257329128").
 */
export function backfillLinksFromRawText(text: string): NormalizedLink[] {
  const found: NormalizedLink[] = []
  const patterns: Array<{ type: "linkedin" | "github"; re: RegExp }> = [
    { type: "github", re: /github\s*:?\/\/?\s*\n?\s*([a-z0-9\-_.]+)/gi },
    { type: "linkedin", re: /linkedin\s*:?\/\/?\s*\n?\s*([a-z0-9\-_.]+)/gi },
  ]
  for (const { type, re } of patterns) {
    for (const match of text.matchAll(re)) {
      const slug = match[1]?.trim()
      if (!slug) continue
      const normalized = normalizeLinkUrl(slug, type)
      if (normalized) {
        found.push({ url: normalized.url, link_type: normalized.link_type, label: null })
      }
    }
  }
  return found
}

// ── Main entry point ──────────────────────────────────────────────────────────

export function normalizeResumePayload(raw: RawWebhookItem): NormalizedIngestPayload {
  const needsReviewReasons: string[] = []
  const profile = raw.output.candidate_profile

  let first_name = profile.first_name
  if (!first_name) {
    const emailLocalPart = profile.email?.split("@")[0]
    first_name = emailLocalPart ? emailLocalPart : "Unknown"
    needsReviewReasons.push("missing first_name (derived a placeholder)")
  }
  const last_name = profile.last_name ?? ""
  if (!profile.last_name) {
    needsReviewReasons.push("missing last_name")
  }

  let email = profile.email ? profile.email.trim().toLowerCase() : null
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    needsReviewReasons.push(`invalid email format: "${email}"`)
    email = null
  }

  // ── Links: priority is extractedLinks (n8n's dedicated extraction step) >
  // profile.*_url fields (LLM-derived) > regex backfill from raw text.
  const candidateLinks: NormalizedLink[] = []
  for (const url of raw.extractedLinks.linkedin) {
    const n = normalizeLinkUrl(url, "linkedin")
    if (n) candidateLinks.push({ url: n.url, link_type: n.link_type, label: null })
  }
  for (const url of raw.extractedLinks.github) {
    const n = normalizeLinkUrl(url, "github")
    if (n) candidateLinks.push({ url: n.url, link_type: n.link_type, label: null })
  }
  for (const url of raw.extractedLinks.portfolio) {
    const n = normalizeLinkUrl(url, "portfolio")
    if (n) candidateLinks.push({ url: n.url, link_type: n.link_type, label: null })
  }
  for (const url of raw.extractedLinks.other) {
    try {
      candidateLinks.push({ url: new URL(url).toString(), link_type: "other", label: null })
    } catch {
      // not a usable URL — drop silently, "other" links are best-effort only
    }
  }
  if (profile.linkedin_url) {
    const n = normalizeLinkUrl(profile.linkedin_url, "linkedin")
    if (n) candidateLinks.push({ url: n.url, link_type: n.link_type, label: null })
  }
  if (profile.github_url) {
    const n = normalizeLinkUrl(profile.github_url, "github")
    if (n) candidateLinks.push({ url: n.url, link_type: n.link_type, label: null })
  }
  if (profile.portfolio_url) {
    const n = normalizeLinkUrl(profile.portfolio_url, "portfolio")
    if (n) candidateLinks.push({ url: n.url, link_type: n.link_type, label: null })
  }
  if (candidateLinks.length === 0 && raw.text) {
    candidateLinks.push(...backfillLinksFromRawText(raw.text))
  }
  const links = dedupeByKey(candidateLinks, (l) => l.url)

  if (!email && !links.some((l) => l.link_type === "linkedin")) {
    needsReviewReasons.push("no email or LinkedIn URL — identity cannot be reliably deduplicated")
  }

  // ── Work experience: DB requires start_date NOT NULL, so drop rows that
  // can't satisfy that instead of failing the whole ingestion.
  const workExperiences: NormalizedWorkExperience[] = []
  raw.output.work_experiences.forEach((exp, index) => {
    if (!exp.start_date) {
      needsReviewReasons.push(
        `dropped work experience missing start_date: "${exp.job_title ?? "unknown title"}" at "${exp.company ?? "unknown company"}"`
      )
      return
    }
    if (!exp.company && !exp.job_title) {
      needsReviewReasons.push(`dropped work experience with no title or company (index ${index})`)
      return
    }
    workExperiences.push({
      display_order: workExperiences.length,
      company_name: exp.company ?? "Unknown",
      title: exp.job_title ?? "Unknown",
      employment_type: normalizeEmploymentType(exp.employment_type),
      location: exp.location,
      is_remote: exp.is_remote,
      start_date: exp.start_date,
      end_date: exp.end_date,
      is_current: exp.is_current,
      description: exp.description,
    })
  })

  const education: NormalizedEducation[] = []
  raw.output.education.forEach((edu, index) => {
    if (!edu.institution_name) {
      needsReviewReasons.push(`dropped education entry with no institution (index ${index})`)
      return
    }
    education.push({
      institution_name: edu.institution_name,
      degree: edu.degree,
      field_of_study: edu.field_of_study,
      start_date: edu.start_date,
      end_date: edu.end_date,
      is_current: edu.is_current,
      gpa: edu.gpa,
      description: edu.description,
    })
  })

  const certifications: NormalizedCertification[] = []
  raw.output.certifications.forEach((cert, index) => {
    if (!cert.name) {
      needsReviewReasons.push(`dropped certification with no name (index ${index})`)
      return
    }
    certifications.push({
      name: cert.name,
      issuing_organization: cert.issuing_organization,
      issue_date: cert.issue_date,
      expiry_date: cert.expiry_date,
      credential_id: cert.credential_id,
      credential_url: cert.credential_url,
    })
  })

  const skills: NormalizedSkill[] = dedupeByKey(
    raw.output.skills.map((s) => ({ name: s.name.trim(), skill_type: s.skill_type })),
    (s) => s.name
  )

  const tools = dedupeByKey(
    raw.output.tools.map((t) => t.trim()).filter((t) => t.length > 0),
    (t) => t
  )

  const normalized: NormalizedIngestPayload = {
    storagePath: raw.body.storage_path,
    filename: raw.body.filename,
    uploaderUserId: raw.body.user_id,
    rawText: raw.text,
    webhookExecutionMode: raw.executionMode ?? null,
    candidate: {
      first_name,
      last_name,
      email,
      phone: profile.phone,
      location_city: profile.location_city,
      location_state: profile.location_state,
      location_country: profile.location_country,
      location_raw: profile.location_raw,
      current_title: profile.current_title,
      current_company: profile.current_company,
      years_experience: profile.years_experience,
      timezone: profile.timezone,
      is_open_to_remote: profile.is_open_to_remote,
      is_open_to_relocation: profile.is_open_to_relocation,
      professional_summary: profile.professional_summary,
    },
    workExperiences,
    education,
    certifications,
    languages: raw.output.languages,
    skills,
    tools,
    links,
    needsReviewReasons,
  }

  return NormalizedIngestPayloadSchema.parse(normalized)
}
