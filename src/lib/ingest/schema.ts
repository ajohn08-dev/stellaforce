import { z } from "zod"

/**
 * Zod schemas for the resume ingestion webhook (n8n -> POST /api/candidates/ingest).
 *
 * Two layers:
 *  - Raw* schemas mirror exactly what n8n sends (an item, or array of items,
 *    shaped by whatever the n8n "Webhook" trigger + LLM node produce). Kept
 *    loose/nullable on purpose — n8n's output is untrusted, LLM-derived data.
 *  - Normalized* schemas are the internal contract the service layer writes
 *    from. normalizeResumePayload() (src/lib/ingest/normalize.ts) is the only
 *    place that turns Raw -> Normalized.
 */

// ── Shared primitives ────────────────────────────────────────────────────────

/** Collapses "", undefined, and null to null; trims everything else. */
const nullableString = z
  .union([z.string(), z.null()])
  .optional()
  .transform((v) => {
    if (v === undefined || v === null) return null
    const trimmed = v.trim()
    return trimmed === "" ? null : trimmed
  })

const nullableNumber = z
  .union([z.number(), z.null()])
  .optional()
  .transform((v) => v ?? null)

const nullableBoolean = z
  .union([z.boolean(), z.null()])
  .optional()
  .transform((v) => v ?? null)

const stringArray = z.array(z.string()).optional().default([])

// ── Raw payload (exactly what n8n sends) ─────────────────────────────────────

export const RawCandidateProfileSchema = z.object({
  first_name: nullableString,
  last_name: nullableString,
  email: nullableString,
  phone: nullableString,
  location_city: nullableString,
  location_state: nullableString,
  location_country: nullableString,
  location_raw: nullableString,
  current_title: nullableString,
  current_company: nullableString,
  years_experience: nullableNumber,
  timezone: nullableString,
  is_open_to_remote: nullableBoolean,
  is_open_to_relocation: nullableBoolean,
  linkedin_url: nullableString,
  github_url: nullableString,
  portfolio_url: nullableString,
  professional_summary: nullableString,
})

export const RawWorkExperienceSchema = z.object({
  job_title: nullableString,
  company: nullableString,
  location: nullableString,
  // LLM output for a controlled vocabulary — validated loosely here, mapped
  // onto the real `employment_type` enum in normalize.ts (unrecognized
  // values fall back to null rather than failing the whole ingestion).
  employment_type: nullableString,
  is_remote: nullableBoolean,
  start_date: nullableString,
  end_date: nullableString,
  is_current: z
    .union([z.boolean(), z.null()])
    .optional()
    .transform((v) => v ?? false),
  description: nullableString,
  skills: stringArray, // free-text per-role tags; not persisted (see normalize.ts)
})

export const RawEducationSchema = z.object({
  degree: nullableString,
  field_of_study: nullableString,
  institution_name: nullableString,
  start_date: nullableString,
  end_date: nullableString,
  is_current: z
    .union([z.boolean(), z.null()])
    .optional()
    .transform((v) => v ?? false),
  gpa: nullableNumber,
  description: nullableString,
})

// n8n's sample payload never populates `certifications`, so this shape is a
// reasonable assumption mirrored from `candidate_certifications` columns
// (CLAUDE.md) rather than something observed in a real payload. Adjust if
// n8n's actual field names differ once it starts sending real data.
export const RawCertificationSchema = z.object({
  name: nullableString,
  issuing_organization: nullableString,
  issue_date: nullableString,
  expiry_date: nullableString,
  credential_id: nullableString,
  credential_url: nullableString,
})

export const RawSkillSchema = z.object({
  name: z.string().trim().min(1),
  skill_type: z.enum(["technical", "functional", "behavioral"]),
})

export const RawExtractedLinksSchema = z
  .object({
    linkedin: stringArray,
    github: stringArray,
    portfolio: stringArray,
    other: stringArray,
  })
  .optional()
  .default({ linkedin: [], github: [], portfolio: [], other: [] })

export const RawParsedOutputSchema = z.object({
  candidate_profile: RawCandidateProfileSchema,
  work_experiences: z.array(RawWorkExperienceSchema).optional().default([]),
  education: z.array(RawEducationSchema).optional().default([]),
  certifications: z.array(RawCertificationSchema).optional().default([]),
  languages: stringArray,
  skills: z.array(RawSkillSchema).optional().default([]),
  tools: stringArray,
})

export const RawWebhookBodySchema = z.object({
  storage_path: z.string().min(1),
  user_id: z.string().uuid(),
  filename: z.string().min(1),
})

// One item as n8n's webhook node + LLM node produce it. `.passthrough()` lets
// audit-only fields (numpages, info, metadata, version, headers, query,
// params) ride along into raw_payload without needing to be modeled here.
export const RawWebhookItemSchema = z
  .object({
    output: RawParsedOutputSchema,
    text: z.string().optional().default(""),
    body: RawWebhookBodySchema,
    webhookUrl: z.string().optional(),
    executionMode: z.string().optional(),
    extractedLinks: RawExtractedLinksSchema,
    allExtractedLinks: z.array(z.unknown()).optional().default([]),
  })
  .passthrough()

/**
 * n8n's "items" convention means the POST body is normally a one-element
 * array, but accept a bare object too so a hand-tested curl/replay doesn't
 * need to remember to wrap it.
 */
export const RawIngestPayloadSchema = z
  .union([z.array(RawWebhookItemSchema), RawWebhookItemSchema])
  .transform((v) => (Array.isArray(v) ? v : [v]))
  .refine((arr) => arr.length > 0, { message: "Empty ingestion payload" })

export type RawWebhookItem = z.infer<typeof RawWebhookItemSchema>
export type RawCandidateProfile = z.infer<typeof RawCandidateProfileSchema>
export type RawWorkExperience = z.infer<typeof RawWorkExperienceSchema>
export type RawEducation = z.infer<typeof RawEducationSchema>
export type RawCertification = z.infer<typeof RawCertificationSchema>
export type RawSkill = z.infer<typeof RawSkillSchema>

// ── Normalized internal domain model ─────────────────────────────────────────

const EMPLOYMENT_TYPES = [
  "full-time",
  "part-time",
  "contract",
  "freelance",
  "internship",
] as const
const SKILL_TYPES = ["technical", "functional", "behavioral"] as const
const LINK_TYPES = ["linkedin", "github", "portfolio", "other"] as const

export const NormalizedLinkSchema = z.object({
  url: z.string().url(),
  link_type: z.enum(LINK_TYPES),
  label: z.string().nullable(),
})

export const NormalizedCandidateSchema = z.object({
  first_name: z.string().min(1),
  last_name: z.string(),
  email: z.string().email().nullable(),
  phone: z.string().nullable(),
  location_city: z.string().nullable(),
  location_state: z.string().nullable(),
  location_country: z.string().nullable(),
  location_raw: z.string().nullable(),
  current_title: z.string().nullable(),
  current_company: z.string().nullable(),
  years_experience: z.number().nullable(),
  timezone: z.string().nullable(),
  is_open_to_remote: z.boolean().nullable(),
  is_open_to_relocation: z.boolean().nullable(),
  professional_summary: z.string().nullable(),
})

export const NormalizedWorkExperienceSchema = z.object({
  display_order: z.number().int().min(0),
  company_name: z.string().min(1),
  title: z.string().min(1),
  employment_type: z.enum(EMPLOYMENT_TYPES).nullable(),
  location: z.string().nullable(),
  is_remote: z.boolean().nullable(),
  start_date: z.string(), // guaranteed non-null by normalize.ts (DB column is NOT NULL)
  end_date: z.string().nullable(),
  is_current: z.boolean(),
  description: z.string().nullable(),
})

export const NormalizedEducationSchema = z.object({
  institution_name: z.string().min(1),
  degree: z.string().nullable(),
  field_of_study: z.string().nullable(),
  start_date: z.string().nullable(),
  end_date: z.string().nullable(),
  is_current: z.boolean(),
  gpa: z.number().nullable(),
  description: z.string().nullable(),
})

export const NormalizedCertificationSchema = z.object({
  name: z.string().min(1),
  issuing_organization: z.string().nullable(),
  issue_date: z.string().nullable(),
  expiry_date: z.string().nullable(),
  credential_id: z.string().nullable(),
  credential_url: z.string().nullable(),
})

export const NormalizedSkillSchema = z.object({
  name: z.string().min(1),
  skill_type: z.enum(SKILL_TYPES),
})

export const NormalizedIngestPayloadSchema = z.object({
  storagePath: z.string().min(1),
  filename: z.string().min(1),
  uploaderUserId: z.string().uuid(),
  rawText: z.string(),
  webhookExecutionMode: z.string().nullable(),
  candidate: NormalizedCandidateSchema,
  workExperiences: z.array(NormalizedWorkExperienceSchema),
  education: z.array(NormalizedEducationSchema),
  certifications: z.array(NormalizedCertificationSchema),
  languages: z.array(z.string()),
  skills: z.array(NormalizedSkillSchema),
  tools: z.array(z.string().min(1)),
  links: z.array(NormalizedLinkSchema),
  needsReviewReasons: z.array(z.string()),
})

export type NormalizedLink = z.infer<typeof NormalizedLinkSchema>
export type NormalizedCandidate = z.infer<typeof NormalizedCandidateSchema>
export type NormalizedWorkExperience = z.infer<typeof NormalizedWorkExperienceSchema>
export type NormalizedEducation = z.infer<typeof NormalizedEducationSchema>
export type NormalizedCertification = z.infer<typeof NormalizedCertificationSchema>
export type NormalizedSkill = z.infer<typeof NormalizedSkillSchema>
export type NormalizedIngestPayload = z.infer<typeof NormalizedIngestPayloadSchema>
