import type { ScopeKind } from "@/lib/company-inheritance"
import type { FallbackKind } from "@/lib/fallbacks"

/**
 * **Every field the company draft buffer can hold, and where it lands in the
 * database.**
 *
 * Publish is company-wide and atomic: a recruiter edits a benefit, a team's
 * clearance, and a role's answer, then presses one button. That means the buffer
 * is a staging area keyed by field, and *something* has to turn a key back into
 * a table, a row, and a column. This module is that something — see
 * `DB_COMPANY_KNOWLEDGE.md` § D.1.
 *
 * ## Why the keys changed shape
 *
 * They used to be interpolated strings built at each call site —
 * `` `faq-${questionId}-${scope}-${refId}-answer` ``. Two problems, both fatal
 * to a dispatcher:
 *
 * 1. **Unparseable.** Ids contain hyphens (`q-reporting-line`, `job-lg-01`), so
 *    `faq-q-reporting-line-job-job-lg-01-answer` cannot be split back into its
 *    parts. There is no delimiter.
 * 2. **Uncheckable.** Two screens built the key for the same field
 *    independently. They happened to agree; nothing made them.
 *
 * So keys are built here, with `:` as the separator — a character no id uses —
 * and parsed back by `parseDraftKey`. A key that doesn't parse is a bug this
 * module can catch rather than a silent no-op at publish time.
 */

const SEP = ":"

/** Where a draft value lands. The shape a publish dispatcher switches on. */
export type DraftTarget =
  | { table: "clients"; column: string }
  | {
      table: "company_answers"
      questionId: string
      scope: ScopeKind
      refId: string | null
      column: "body" | "expanded_answer" | "clearance" | "agent_use"
    }
  | {
      table: "company_questions"
      questionId: string
      column: "asked_client_at" | "extra_variants"
    }
  | {
      table: "company_knowledge_items"
      id: string
      column: "body" | "clearance" | "agent_use"
    }
  | {
      table: "company_policies"
      id: string
      column:
        | "value"
        | "candidate_facing_text"
        | "internal_notes"
        | "clearance"
        | "agent_use"
    }
  | { table: "company_teams"; id: string; column: "clearance" | "agent_use" }
  | { table: "company_fallbacks"; kind: FallbackKind; column: "text" }

/**
 * Builders. Every draft field in the workspace comes from one of these, so the
 * set of possible keys is enumerable rather than "whatever the components
 * happen to interpolate".
 */
export const draftKey = {
  /** A scalar column on the company row itself. */
  company: (column: string) => ["company", column].join(SEP),

  answer: (
    questionId: string,
    scope: ScopeKind,
    refId: string | null,
    column: "body" | "expanded_answer" = "body"
  ) => ["answer", questionId, scope, refId ?? "", column].join(SEP),

  /** Clearance and agent-use live on the answer row, so they carry its scope. */
  answerVisibility: (questionId: string, scope: ScopeKind, refId: string | null) =>
    ["answer", questionId, scope, refId ?? ""].join(SEP),

  askedClient: (questionId: string) =>
    ["question", questionId, "asked_client_at"].join(SEP),

  /**
   * Phrasings **this company's** candidates use.
   *
   * Deliberately not the catalog's `variants`: that row is global, and letting
   * one customer edit it would write into every other customer's agent. Catalog
   * phrasings render read-only; these are additive.
   */
  extraVariants: (questionId: string) =>
    ["question", questionId, "extra_variants"].join(SEP),

  knowledge: (id: string) => ["knowledge", id].join(SEP),
  policy: (id: string, column: "value" | "spoken" | "internal" = "value") =>
    ["policy", id, column].join(SEP),
  policyVisibility: (id: string) => ["policy", id].join(SEP),
  team: (id: string) => ["team", id].join(SEP),
  fallback: (kind: FallbackKind) => ["fallback", kind].join(SEP),
}

const POLICY_COLUMNS = {
  value: "value",
  spoken: "candidate_facing_text",
  internal: "internal_notes",
} as const

/**
 * Key → target. Returns null for anything unrecognised, which is a bug rather
 * than a value to skip: a draft the publisher can't place is an edit the
 * recruiter believes they made.
 *
 * `-clearance` / `-agent-use` are suffixes appended by `useVisibilityDraft` to
 * whatever prefix it's given, so they're stripped first and the remaining prefix
 * identifies the row.
 */
export function parseDraftKey(key: string): DraftTarget | null {
  let column: "clearance" | "agent_use" | null = null
  let base = key

  if (key.endsWith("-clearance")) {
    column = "clearance"
    base = key.slice(0, -"-clearance".length)
  } else if (key.endsWith("-agent-use")) {
    column = "agent_use"
    base = key.slice(0, -"-agent-use".length)
  }

  const parts = base.split(SEP)

  switch (parts[0]) {
    case "company":
      return parts[1] ? { table: "clients", column: parts[1] } : null

    case "answer": {
      const [, questionId, scope, refId, bodyColumn] = parts
      if (!questionId || !scope) return null
      return {
        table: "company_answers",
        questionId,
        scope: scope as ScopeKind,
        refId: refId || null,
        column: column ?? ((bodyColumn as "body" | "expanded_answer") || "body"),
      }
    }

    case "question": {
      const [, questionId, col] = parts
      if (!questionId || (col !== "asked_client_at" && col !== "extra_variants"))
        return null
      return { table: "company_questions", questionId, column: col }
    }

    case "knowledge":
      return parts[1]
        ? { table: "company_knowledge_items", id: parts[1], column: column ?? "body" }
        : null

    case "policy": {
      const [, id, col] = parts
      if (!id) return null
      if (column) return { table: "company_policies", id, column }
      const mapped = POLICY_COLUMNS[(col ?? "value") as keyof typeof POLICY_COLUMNS]
      return mapped ? { table: "company_policies", id, column: mapped } : null
    }

    case "team":
      return parts[1] && column
        ? { table: "company_teams", id: parts[1], column }
        : null

    case "fallback":
      return parts[1]
        ? { table: "company_fallbacks", kind: parts[1] as FallbackKind, column: "text" }
        : null

    default:
      return null
  }
}
