import "server-only"

import Anthropic from "@anthropic-ai/sdk"
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod"
import { z } from "zod"

import { serverEnv } from "@/lib/env"
import { SKILL_TAXONOMY } from "@/lib/constants"

/**
 * AI candidate parsing — SERVER ONLY. Uses the Claude API to turn raw pasted
 * text (a résumé, a LinkedIn dump, an email) into the structured candidate +
 * skills shapes the recruiter then reviews and confirms.
 *
 * Output is constrained with structured outputs (output_config.format) rather
 * than assistant prefill — prefill 400s on Opus 4.8. The result is validated
 * against the Zod schema before it ever reaches the UI.
 */

// Zod schema mirrors the editable fields on the ingestion form. Keep loose:
// the recruiter confirms/edits everything before it is written.
export const ParsedCandidateSchema = z.object({
  full_name: z.string(),
  contact_info: z.object({
    email: z.string(),
    phone: z.string(),
    location: z.string(),
    tz: z.string(),
  }),
  linkedin_url: z.string(),
  portfolio_url: z.string(),
  current_title: z.string(),
  current_company: z.string(),
  years_experience: z.number(),
  professional_summary: z.string(),
  candidate_tier: z.enum(["gold", "silver", "bronze"]),
  tier_rationale: z.string(),
  languages: z.array(z.string()),
  skills: z.array(
    z.object({
      skill_name: z.string(),
      skill_type: z.enum(["technical", "functional", "behavioral"]),
      proficiency_level: z.enum([
        "beginner",
        "intermediate",
        "advanced",
        "expert",
      ]),
      // AI-literacy signal: how the candidate has actually used AI tooling.
      ai_literacy_signal: z.object({
        tool_used: z.string(),
        how_used: z.string(),
        measurable_outcome: z.string(),
      }),
    })
  ),
})

export type ParsedCandidate = z.infer<typeof ParsedCandidateSchema>

const SYSTEM_PROMPT = `You are a recruiting data extraction assistant for Stella Force.
Extract a structured candidate profile from the raw text a recruiter pastes
(a résumé, LinkedIn export, or notes).

Rules:
- Fill every field. If a value is genuinely unknown, use an empty string "" (or 0
  for years_experience, or [] for arrays) — never invent facts.
- Prefer skill names from this controlled taxonomy where they match; otherwise
  use the candidate's own wording: ${SKILL_TAXONOMY.join(", ")}.
- skill_type: "technical" for hard/tool skills, "behavioral" for interpersonal
  skills, "functional" for domain/process skills that are neither.
- For ai_literacy_signal, only fill fields when the text gives real evidence of
  AI-tool usage; otherwise leave those strings empty.
- candidate_tier is your assessment (gold = exceptional, silver = solid,
  bronze = entry/unproven). Explain briefly in tier_rationale.`

/**
 * Parse raw candidate text into the structured shape. Throws on API/validation
 * failure — callers should surface a friendly error to the recruiter.
 */
export async function parseCandidateText(
  rawText: string
): Promise<ParsedCandidate> {
  const client = new Anthropic({ apiKey: serverEnv.anthropicApiKey })

  const message = await client.messages.parse({
    model: "claude-opus-4-8",
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    output_config: {
      format: zodOutputFormat(ParsedCandidateSchema),
    },
    messages: [
      {
        role: "user",
        content: `Extract the candidate profile from this text:\n\n${rawText}`,
      },
    ],
  })

  if (!message.parsed_output) {
    throw new Error("AI parsing returned no structured output. Try again.")
  }
  return message.parsed_output
}
