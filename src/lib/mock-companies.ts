import type { MockJobStatus } from "@/lib/mock-jobs"
import { COMPANY_SCOPE, type CompanyQuestion, type ScopeKind } from "@/lib/company-inheritance"
import type { Question } from "@/lib/question-catalog"
import { GLOBAL_FALLBACKS, type CompanyFallbacks } from "@/lib/fallbacks"
import type {
  AgentUse,
  Clearance,
  DisclosurePreset,
  PublishState,
  VerificationStatus,
  VisibilityBlock,
} from "@/lib/company-visibility"

/**
 * UI-preview data only — the `/companies` workspace renders entirely from this
 * file, not from the `clients` table. Nothing here is written to Supabase.
 *
 * The types are written in the shape the eventual schema should take (see
 * COMPANY.md § D), so the database pass is a swap of the data source rather than
 * a rewrite. Field names are snake_case-able 1:1.
 *
 * Three companies, chosen to exercise every readiness state:
 *   - LumaGrid Security  — fully populated → "Ready with caveats"
 *   - Verity Health      — just after intake → "Blocked"
 *   - Harborline Freight — populated but expired → "Recruiter review required"
 */

/**
 * Superseded by `src/lib/fallbacks.ts`, which has four of these rather than one
 * — a single sentence answered "we don't know" even when we knew perfectly well
 * and wouldn't say. Kept because fixtures still reference it as an answer-level
 * fallback string; the agent reads the resolved set instead.
 */
export const UNKNOWN_FALLBACK = GLOBAL_FALLBACKS.unknown.text

/** Constraints the agent carries on every deployment, regardless of configuration. */
export const STANDING_PROHIBITIONS: string[] = [
  "Never guarantee or imply visa sponsorship, visa eligibility, or any immigration outcome or timeline.",
  "Never promise a compensation figure, exception, or negotiation outcome.",
  "Never promise an interview, an offer, or a hiring decision.",
  "Never disclose other candidates, their status, or any comparison between candidates.",
  "Never disclose client commercial terms, contract status, exclusivity, or account health.",
  "Never speculate about layoffs, funding, financial stability, or acquisition beyond published candidate-safe content.",
  "Never answer from general world knowledge when company-specific knowledge is absent — escalate instead.",
]

// ---------------------------------------------------------------------------
// Shared
// ---------------------------------------------------------------------------

/**
 * The scopes knowledge can attach to. **No `department`** — `Department` merged
 * into a self-nesting `Team`, so depth is data rather than a named level.
 */
export type KnowledgeLevel = ScopeKind

export type CompanyStage =
  | "seed"
  | "early_venture"
  | "growth_private"
  | "late_stage"
  | "public"
  | "bootstrapped"

export const COMPANY_STAGE_LABELS: Record<CompanyStage, string> = {
  seed: "Seed",
  early_venture: "Early-stage, venture-backed",
  growth_private: "Growth-stage, private",
  late_stage: "Late-stage, private",
  public: "Public",
  bootstrapped: "Bootstrapped",
}

export type OperatingModel = "remote" | "hybrid" | "onsite" | "mixed"

export const OPERATING_MODEL_LABELS: Record<OperatingModel, string> = {
  remote: "Remote-first",
  hybrid: "Hybrid",
  onsite: "On-site",
  mixed: "Mixed by team",
}

/** Convenience builder so the fixtures below stay readable. */
function vis(
  clearance: Clearance,
  agentUse: AgentUse | null,
  state: PublishState,
  opts: {
    source: string
    verification: VerificationStatus
    lastVerifiedAt?: string | null
    verifiedBy?: string | null
    owner?: string
    reviewCadenceDays?: number | null
    nextReviewAt?: string | null
    isPresetDefault?: boolean
  }
): VisibilityBlock {
  return {
    clearance,
    agentUse: clearance === "cleared_for_candidates" ? agentUse : null,
    state,
    source: opts.source,
    verification: opts.verification,
    lastVerifiedAt: opts.lastVerifiedAt ?? null,
    verifiedBy: opts.verifiedBy ?? null,
    owner: opts.owner ?? "Anna John",
    reviewCadenceDays: opts.reviewCadenceDays ?? null,
    nextReviewAt: opts.nextReviewAt ?? null,
    isPresetDefault: opts.isPresetDefault ?? true,
  }
}

// ---------------------------------------------------------------------------
// Knowledge items — narrative blocks and internal brief notes
// ---------------------------------------------------------------------------

export type KnowledgeKind =
  // Candidate-safe narrative blocks
  | "one_liner"
  | "story"
  | "mission"
  | "product_overview"
  | "why_hiring"
  | "evp"
  | "culture"
  | "leadership_principles"
  | "career_growth"
  | "differentiators"
  | "customer_impact"
  | "market_positioning"
  | "why_join_now"
  | "role_family_context"
  // Internal recruiter brief
  | "brief_note"

/** Narrative blocks in display order, grouped as they appear on the Narrative tab. */
export const NARRATIVE_GROUPS: {
  key: string
  label: string
  kinds: KnowledgeKind[]
}[] = [
  {
    key: "company_product",
    label: "Company & product",
    kinds: ["one_liner", "story", "mission", "product_overview", "customer_impact"],
  },
  {
    key: "employer_brand",
    label: "Employer brand",
    kinds: ["evp", "culture", "leadership_principles", "career_growth"],
  },
  {
    key: "growth_positioning",
    label: "Growth & positioning",
    kinds: [
      "why_hiring",
      "differentiators",
      "market_positioning",
      "why_join_now",
      "role_family_context",
    ],
  },
]

export const KNOWLEDGE_KIND_LABELS: Record<KnowledgeKind, string> = {
  one_liner: "One-sentence description",
  story: "Company story",
  mission: "Mission",
  product_overview: "Product or service overview",
  why_hiring: "Why the company is growing or hiring",
  evp: "Employer value proposition",
  culture: "Culture and working style",
  leadership_principles: "Leadership principles",
  career_growth: "Career growth",
  differentiators: "What makes the company distinct",
  customer_impact: "Customer impact",
  market_positioning: "Market and competitor positioning",
  why_join_now: "Why join now",
  role_family_context: "Common role-family context",
  brief_note: "Recruiter note",
}

/** Prompt shown in a block's empty state — what to write and why it matters. */
export const KNOWLEDGE_KIND_PROMPTS: Partial<Record<KnowledgeKind, string>> = {
  one_liner:
    "One sentence a candidate could repeat back accurately. This is the first thing an agent says.",
  story: "How the company started and what changed since. Two or three sentences.",
  mission: "The company's own words, not a paraphrase.",
  product_overview: "What it does, for whom, in plain language a non-user would follow.",
  why_hiring:
    "Candidates ask this in almost every screen. One or two sentences on what changed is enough.",
  evp: "Why someone strong would choose this company over a competing offer.",
  culture:
    "How people actually work day to day — pace, autonomy, meetings, decision-making.",
  leadership_principles: "The operating values leaders visibly hold people to.",
  career_growth: "What progression looks like, with a concrete example if you have one.",
  differentiators: "What competitors can't easily claim. Approved for public use only.",
  customer_impact: "What changes for a customer because this company exists.",
  market_positioning: "Approved language about the market and named competitors.",
  why_join_now: "What makes this moment different from a year ago.",
  role_family_context: "Context reusable across several roles of the same kind.",
}

export type KnowledgeItem = {
  id: string
  level: KnowledgeLevel
  levelRefId: string | null
  kind: KnowledgeKind
  title: string
  body: string
  visibility: VisibilityBlock
  /** Set when this item was created via "Promote to candidate-safe draft". */
  promotedFromItemId?: string
  /** Flagged by its author as convertible into candidate-facing messaging. */
  promotable?: boolean
}

// ---------------------------------------------------------------------------
// Policies
// ---------------------------------------------------------------------------

export type PolicyGroup =
  | "employment"
  | "benefits"
  | "compensation"
  | "immigration"
  | "mobility"
  | "internal"

export const POLICY_GROUP_LABELS: Record<PolicyGroup, string> = {
  employment: "Employment & work model",
  benefits: "Benefits",
  compensation: "Compensation approach",
  immigration: "Work authorization & immigration",
  mobility: "Location & mobility",
  internal: "Internal policy notes",
}

/**
 * The explicit value set for every immigration item. Free text is not allowed
 * here — an ambiguous sponsorship answer is the single highest-risk thing an
 * agent can say.
 */
export type ImmigrationValue =
  | "confirmed_yes"
  | "confirmed_no"
  | "role_dependent"
  | "case_by_case"
  | "unknown"
  | "restricted"

export const IMMIGRATION_VALUE_LABELS: Record<ImmigrationValue, string> = {
  confirmed_yes: "Confirmed yes",
  confirmed_no: "Confirmed no",
  role_dependent: "Role-dependent",
  case_by_case: "Case-by-case",
  unknown: "Unknown — needs confirmation",
  restricted: "Restricted",
}

export const IMMIGRATION_VALUE_AGENT_BEHAVIOR: Record<ImmigrationValue, string> = {
  confirmed_yes: "States the policy as written.",
  confirmed_no: "States the policy as written.",
  role_dependent: "States that it varies by role and defers to the job's policy.",
  case_by_case: "States that it is evaluated individually; does not predict an outcome.",
  unknown: "Uses the fallback and escalates to a recruiter.",
  restricted: "Does not acknowledge the detail; escalates to a recruiter.",
}

export type PolicyItem = {
  id: string
  group: PolicyGroup
  key: string
  label: string
  /** Null means "not yet entered" — deliberately distinct from "not offered". */
  value: string | null
  immigrationValue?: ImmigrationValue
  /** The exact string a candidate would hear. Null falls back to UNKNOWN_FALLBACK. */
  candidateFacingText: string | null
  visibility: VisibilityBlock
}

// ---------------------------------------------------------------------------
// FAQ
// ---------------------------------------------------------------------------

export type FaqCategory =
  | "size_growth"
  | "mission_story"
  | "products_customers"
  | "culture"
  | "remote_model"
  | "office_expectations"
  | "leadership"
  | "team_collaboration"
  | "typical_day"
  | "career_progression"
  | "comp_philosophy"
  | "benefits"
  | "equity"
  | "work_authorization"
  | "interview_process"
  | "hiring_timeline"
  | "why_role_open"
  | "financial_stability"
  | "competition"
  | "travel"
  | "accessibility"
  | "objections"

export const FAQ_CATEGORY_LABELS: Record<FaqCategory, string> = {
  size_growth: "Company size and growth",
  mission_story: "Mission and story",
  products_customers: "Products and customers",
  culture: "Culture and working style",
  remote_model: "Remote/hybrid model",
  office_expectations: "Office expectations",
  leadership: "Leadership and reporting structure",
  team_collaboration: "Team size and collaboration",
  typical_day: "Typical day or week",
  career_progression: "Career progression",
  comp_philosophy: "Compensation philosophy",
  benefits: "Benefits",
  equity: "Equity",
  work_authorization: "Visa sponsorship and work authorization",
  interview_process: "Interview process",
  hiring_timeline: "Hiring timeline",
  why_role_open: "Why the role is open",
  financial_stability: "Financial stability",
  competition: "Competition",
  travel: "Travel expectations",
  accessibility: "Accessibility accommodations",
  objections: "Candidate concerns and objections",
}

export const FAQ_CATEGORY_ORDER: FaqCategory[] = Object.keys(
  FAQ_CATEGORY_LABELS
) as FaqCategory[]

/**
 * Questions are **global** and answers are **scoped** — see
 * `src/lib/question-catalog.ts` for the catalog and
 * `src/lib/company-inheritance.ts` for `CompanyQuestion`, `Answer`, and the
 * resolver.
 *
 * `FaqEntry` used to fuse the two into one row owned by one company, which is
 * why customer #2 retyped the same twenty questions, drifted on categories, and
 * invented their own prohibited-claims list. A question is the same question
 * everywhere; only the answer differs.
 */
export type { Answer, CompanyQuestion } from "@/lib/company-inheritance"

// ---------------------------------------------------------------------------
// Teams and stakeholders
// ---------------------------------------------------------------------------

export type StakeholderRole =
  | "exec_leader"
  | "hiring_manager"
  | "hr_admin"
  | "client_recruiter"
  | "interviewer"

export const STAKEHOLDER_ROLE_LABELS: Record<StakeholderRole, string> = {
  exec_leader: "Executive leader",
  hiring_manager: "Hiring manager",
  hr_admin: "HR administrator",
  client_recruiter: "Client recruiter",
  interviewer: "Interviewer",
}

export type Stakeholder = {
  id: string
  name: string
  title: string
  role: StakeholderRole
  candidateFacingBio: string | null
  internalNotes: string | null
  visibility: VisibilityBlock
}

/**
 * An org unit knowledge can be scoped to — **and `Department` is gone, merged
 * into this.**
 *
 * They were the same shape at two depths: both carried a name, a mission, a
 * candidate-facing description, a leader, a size, internal notes, and a
 * visibility block. The only difference was that one nested the other, and the
 * split forced a decision at creation time — *"is Go-to-Market a department or a
 * team?"* — that a recruiter can't get right and whose answer has no visible
 * consequence until much later.
 *
 * With `parentTeamId`, Go-to-Market → Channel Growth is two teams, one nested in
 * the other. Depth is data, so the tree *is* the org chart at whatever depth a
 * company actually has, and a customer with four tiers needs no schema change.
 * Teams are still created only when a job needs context the company profile
 * can't give (`createdBecauseJobId`).
 */
export type Team = {
  id: string
  /** Null for a root team. The whole of what used to be the department/team split. */
  parentTeamId: string | null
  name: string
  mission: string
  /** What an agent may say about this unit. Was `candidateFacingDescription` on Department. */
  description: string | null
  /** Hiring manager for a leaf team; the executive for a parent. Same field, same purpose. */
  leaderId: string | null
  sizeRange: string | null
  operatingModel: string | null
  locations: string[]
  timezoneSpread: string | null
  workingStyle: string | null
  collaborationCadence: string | null
  dayInTheLife: string | null
  goals: string[]
  crossFunctionalPartners: string[]
  commonRoleFamilies: string[]
  cultureNotes: string | null
  internalNotes: string | null
  visibility: VisibilityBlock
  /** Which job caused this team to exist. Enforces "create only when needed". */
  createdBecauseJobId: string | null
}

// ---------------------------------------------------------------------------
// Jobs (company-relationship fields only)
// ---------------------------------------------------------------------------

export type InheritanceOverride = {
  fieldKey: string
  label: string
  inheritedFromLevel: KnowledgeLevel
  inheritedValue: string
  overrideValue: string
  reason: string | null
  conflictsWithVerified: boolean
}

export type CompanyJob = {
  id: string
  title: string
  teamId: string | null
  location: string
  travel: string | null
  reportsTo: string | null
  rolePurpose: string | null
  compensation: string | null
  sponsorshipPolicy: ImmigrationValue | null
  typicalWeek: string | null
  first90DayOutcomes: string[]
  roleRisks: string | null
  overrides: InheritanceOverride[]
  /**
   * The app's real job vocabulary (`JobStatus` + draft), not a private one. This
   * said `on_hold` — which is an *application* status; the job enum says
   * `paused` — and every mismatched enum here is one more thing to reconcile
   * when `CompanyJob.id` becomes `job_orders.job_id`.
   */
  status: MockJobStatus
  /**
   * The job's pipeline stage names, in order — the interview process a candidate
   * is actually put through.
   *
   * ⚠️ **Fixture stand-in.** The real source is `job_workflow_sub_stages`,
   * snapshotted from the workflow template at publish. It's mirrored here so the
   * derived interview-process answer can be built without a database.
   */
  interviewStages: string[]
}

// ---------------------------------------------------------------------------
// Gaps and activity
// ---------------------------------------------------------------------------

export type ActivityEventType =
  | "created"
  | "edited"
  | "clearance_changed"
  | "agent_use_changed"
  | "published"
  | "unpublished"
  | "verified"
  | "marked_stale"
  | "promoted"
  | "restricted_expanded"
  | "agent_deployed"
  | "agent_used_item"

export const ACTIVITY_EVENT_LABELS: Record<ActivityEventType, string> = {
  created: "Created",
  edited: "Edited",
  clearance_changed: "Clearance changed",
  agent_use_changed: "Agent use changed",
  published: "Published",
  unpublished: "Unpublished",
  verified: "Verified",
  marked_stale: "Marked stale",
  promoted: "Promoted to candidate-safe draft",
  restricted_expanded: "Restricted note opened",
  agent_deployed: "Agent deployed",
  agent_used_item: "Used by agent",
}

/**
 * A row of the company's activity feed.
 *
 * **Not a company-owned history.** When the DB pass lands this is a projection
 * of the existing `activity_events` / `audit_log` tables (see CLAUDE.md), scoped
 * to this company — the app already has one append-only log and doesn't need a
 * second one hanging off each knowledge item.
 */
/**
 * A published snapshot of the whole company profile.
 *
 * Company-wide by design: a publish is one atomic act across every section, so a
 * version is a snapshot of the company, not of a section or an item. UI only in
 * this demo — nothing restores.
 */
export type CompanyVersion = {
  id: string
  publishedAt: string
  publishedBy: string
  changeCount: number
  summary: string | null
}

export type ActivityEntry = {
  id: string
  event: ActivityEventType
  entityLabel: string
  actor: string
  actorType: "user" | "system"
  at: string
  detail: string | null
}

// ---------------------------------------------------------------------------
// Company
// ---------------------------------------------------------------------------

export type ContractStatus = "active" | "pending" | "paused" | "expired"
export type RelationshipHealth = "strong" | "steady" | "at_risk" | "unknown"

export const RELATIONSHIP_HEALTH_LABELS: Record<RelationshipHealth, string> = {
  strong: "Strong",
  steady: "Steady",
  at_risk: "At risk",
  unknown: "Not assessed",
}

export type Company = {
  id: string
  slug: string
  preferredName: string
  legalName: string | null
  tagline: string | null
  website: string | null
  linkedinUrl: string | null
  logoPath: string | null

  headquarters: string | null
  officeLocations: string[]
  countriesOfOperation: string[]

  industry: string | null
  subIndustry: string | null
  stage: CompanyStage | null
  foundedYear: number | null
  employeeRange: string | null
  operatingModel: OperatingModel | null

  productCategories: string[]
  customerTypes: string[]
  verticals: string[]

  /** Internal account fields. */
  accountOwner: string
  contractStatus: ContractStatus
  searchExclusivity: string | null
  relationshipHealth: RelationshipHealth
  internalPriority: "high" | "medium" | "low"
  responsivenessNotes: string | null

  disclosurePreset: DisclosurePreset
  createdAt: string
  updatedAt: string

  knowledge: KnowledgeItem[]
  policies: PolicyItem[]
  /** Catalog questions as they stand here: how often asked, and the answers written. */
  questions: CompanyQuestion[]
  /** The genuinely bespoke, e.g. "Is the Central territory greenfield?". Rare by design. */
  customQuestions: Question[]
  /** Flat list; nesting is `parentTeamId`. Was `departments` with `teams` inside. */
  teams: Team[]
  /**
   * This company's wording for what the agent says when it can't answer.
   * Absent keys fall back to `GLOBAL_FALLBACKS` — see `src/lib/fallbacks.ts`.
   */
  fallbacks?: CompanyFallbacks
  stakeholders: Stakeholder[]
  jobs: CompanyJob[]
  activity: ActivityEntry[]
  versions: CompanyVersion[]
}

// ===========================================================================
// Fixture 1 — LumaGrid Security (fully populated → "Ready with caveats")
// ===========================================================================

const LUMAGRID_STAKEHOLDERS: Stakeholder[] = [
  {
    id: "sh-lg-01",
    name: "Marcus Ellery",
    title: "VP of Channel Growth",
    role: "exec_leader",
    candidateFacingBio:
      "Marcus leads LumaGrid's channel organization. He spent twelve years building integrator and distributor programs in physical security before joining LumaGrid in 2024, and he still runs partner visits himself most weeks.",
    internalNotes:
      "Reschedules first-round interviews roughly a third of the time. Set candidate expectations accordingly and confirm slots 48 hours out. Responds fastest on mobile, not email.",
    visibility: vis("cleared_for_candidates", "on_request", "published", {
      source: "Bio approved by client marketing, 2 Aug 2026",
      verification: "verified",
      lastVerifiedAt: "2026-08-02",
      verifiedBy: "Anna John",
      reviewCadenceDays: 180,
      nextReviewAt: "2027-01-29",
    }),
  },
  {
    id: "sh-lg-02",
    name: "Priya Raghunathan",
    title: "Director, Talent Acquisition",
    role: "hr_admin",
    candidateFacingBio: null,
    internalNotes:
      "Primary intake contact. Owns offer approvals up to $180K OTE; anything above goes to the CFO and adds about a week.",
    visibility: vis("recruiters_only", null, "published", {
      source: "Client intake call, 4 Aug 2026",
      verification: "verified",
      lastVerifiedAt: "2026-08-04",
      verifiedBy: "Anna John",
    }),
  },
]

const LUMAGRID_KNOWLEDGE: KnowledgeItem[] = [
  {
    id: "ki-lg-01",
    level: "company",
    levelRefId: null,
    kind: "one_liner",
    title: "One-sentence description",
    body: "LumaGrid helps security teams manage mixed-camera environments without being locked into a single hardware vendor.",
    visibility: vis("cleared_for_candidates", "proactive", "published", {
      source: "Client-approved boilerplate",
      verification: "verified",
      lastVerifiedAt: "2026-08-12",
      verifiedBy: "Anna John",
      reviewCadenceDays: 180,
      nextReviewAt: "2027-02-08",
    }),
  },
  {
    id: "ki-lg-02",
    level: "company",
    levelRefId: null,
    kind: "story",
    title: "Company story",
    body: "LumaGrid started in 2017 when its founders — two integrators and a former camera-firmware engineer — got tired of ripping out working hardware every time a customer changed VMS vendors. The company shipped its first open-platform recorder in 2019 and moved to a cloud device-management model in 2022. It now supports mixed-vendor deployments across roughly 4,000 sites.",
    visibility: vis("cleared_for_candidates", "on_request", "published", {
      source: "Client marketing site + intake call, 4 Aug 2026",
      verification: "verified",
      lastVerifiedAt: "2026-08-12",
      verifiedBy: "Anna John",
      reviewCadenceDays: 365,
      nextReviewAt: "2027-08-12",
    }),
  },
  {
    id: "ki-lg-03",
    level: "company",
    levelRefId: null,
    kind: "mission",
    title: "Mission",
    body: "Give every security team a clear view of their sites without forcing them into one vendor's hardware.",
    visibility: vis("cleared_for_candidates", "proactive", "published", {
      source: "Client-approved boilerplate",
      verification: "verified",
      lastVerifiedAt: "2026-08-12",
      verifiedBy: "Anna John",
      reviewCadenceDays: 365,
      nextReviewAt: "2027-08-12",
    }),
  },
  {
    id: "ki-lg-04",
    level: "company",
    levelRefId: null,
    kind: "product_overview",
    title: "Product or service overview",
    body: "LumaGrid Command 4.2 is an open-platform video management system paired with cloud device management and AI-assisted incident search. It runs mixed-vendor camera fleets from one interface, pushes firmware and health checks from the cloud, and lets an operator find an incident by describing it rather than scrubbing timelines.",
    visibility: vis("cleared_for_candidates", "on_request", "published", {
      source: "Product marketing one-pager, v4.2",
      verification: "verified",
      lastVerifiedAt: "2026-08-12",
      verifiedBy: "Anna John",
      reviewCadenceDays: 180,
      nextReviewAt: "2027-02-08",
    }),
  },
  {
    id: "ki-lg-05",
    level: "company",
    levelRefId: null,
    kind: "customer_impact",
    title: "Customer impact",
    body: "A multi-site retailer running four camera brands across 300 locations can standardize on one interface without replacing hardware, and can pull a specific incident in minutes instead of hours.",
    visibility: vis("cleared_for_candidates", "on_request", "published", {
      source: "Customer case study, approved for public use",
      verification: "verified",
      lastVerifiedAt: "2026-07-28",
      verifiedBy: "Anna John",
      reviewCadenceDays: 180,
      nextReviewAt: "2027-01-24",
    }),
  },
  {
    id: "ki-lg-06",
    level: "company",
    levelRefId: null,
    kind: "evp",
    title: "Employer value proposition",
    body: "A growth-stage company with real customers and a product people in the industry already respect, where the go-to-market org is small enough that one person's territory strategy visibly moves the number.",
    visibility: vis("cleared_for_candidates", "proactive", "published", {
      source: "Drafted by recruiter, approved by Priya Raghunathan",
      verification: "verified",
      lastVerifiedAt: "2026-08-05",
      verifiedBy: "Anna John",
      reviewCadenceDays: 180,
      nextReviewAt: "2027-02-01",
    }),
  },
  {
    id: "ki-lg-07",
    level: "company",
    levelRefId: null,
    kind: "culture",
    title: "Culture and working style",
    body: "Customer-focused, high-ownership, practical, and fast-moving. Decisions are made close to the customer rather than escalated, meetings are short, and people are expected to bring a recommendation rather than a status update. Austin-based teams are hybrid; approved field roles are fully remote.",
    visibility: vis("cleared_for_candidates", "on_request", "published", {
      source: "Client intake call, 4 Aug 2026",
      verification: "verified",
      lastVerifiedAt: "2026-08-04",
      verifiedBy: "Anna John",
      reviewCadenceDays: 180,
      nextReviewAt: "2027-01-31",
    }),
  },
  {
    id: "ki-lg-08",
    level: "company",
    levelRefId: null,
    kind: "why_hiring",
    title: "Why the company is growing or hiring",
    body: "LumaGrid is investing in its partner ecosystem. Most revenue has come through a handful of long-standing integrator relationships, and the company is building a repeatable channel motion across new regions rather than adding more direct sellers.",
    visibility: vis("cleared_for_candidates", "proactive", "published", {
      source: "Client intake call, 4 Aug 2026",
      verification: "verified",
      lastVerifiedAt: "2026-08-04",
      verifiedBy: "Anna John",
      reviewCadenceDays: 90,
      nextReviewAt: "2026-11-02",
    }),
  },
  {
    id: "ki-lg-09",
    level: "company",
    levelRefId: null,
    kind: "differentiators",
    title: "What makes the company distinct",
    body: "Open platform by design — LumaGrid does not manufacture cameras, so it has no incentive to lock a customer into its own hardware. That independence is the reason integrators bring it into competitive deals.",
    visibility: vis("cleared_for_candidates", "on_request", "published", {
      source: "Product marketing, approved for public use",
      verification: "verified",
      lastVerifiedAt: "2026-08-12",
      verifiedBy: "Anna John",
      reviewCadenceDays: 180,
      nextReviewAt: "2027-02-08",
    }),
  },
  {
    id: "ki-lg-10",
    level: "company",
    levelRefId: null,
    kind: "career_growth",
    title: "Career growth",
    body: "The channel org is being built now, so early regional hires are the natural candidates to lead a larger territory or a national program as it scales. Two of the current directors joined as individual contributors in 2023.",
    visibility: vis("cleared_for_candidates", "on_request", "published", {
      source: "Client intake call, 4 Aug 2026",
      verification: "verified",
      lastVerifiedAt: "2026-08-04",
      verifiedBy: "Anna John",
      reviewCadenceDays: 90,
      nextReviewAt: "2026-11-02",
      isPresetDefault: false,
    }),
  },
  {
    id: "ki-lg-11",
    level: "company",
    levelRefId: null,
    kind: "why_join_now",
    title: "Why join now",
    body: "The channel program is early enough that the operating model is still being written, and established enough that there is real product, real partners, and real revenue behind it.",
    visibility: vis("cleared_for_candidates", "proactive", "draft", {
      source: "Drafted by recruiter, awaiting client approval",
      verification: "unverified",
      lastVerifiedAt: null,
      reviewCadenceDays: null,
      isPresetDefault: false,
    }),
  },
  {
    id: "ki-lg-12",
    level: "company",
    levelRefId: null,
    kind: "market_positioning",
    title: "Market and competitor positioning",
    body: "LumaGrid competes with vertically integrated camera vendors and with closed cloud VMS platforms. Approved framing: LumaGrid is the option for teams that already own mixed hardware and want to keep it.",
    visibility: vis("cleared_for_candidates", "reference_only", "published", {
      source: "Approved by client marketing, 2 Aug 2026",
      verification: "verified",
      lastVerifiedAt: "2026-08-02",
      verifiedBy: "Anna John",
      reviewCadenceDays: 90,
      nextReviewAt: "2026-10-31",
      isPresetDefault: false,
    }),
  },
  {
    id: "ki-lg-13",
    level: "company",
    levelRefId: null,
    kind: "leadership_principles",
    title: "Leadership principles",
    body: "",
    visibility: vis("cleared_for_candidates", "on_request", "draft", {
      source: "",
      verification: "unverified",
      lastVerifiedAt: null,
    }),
  },
  {
    id: "ki-lg-14",
    level: "company",
    levelRefId: null,
    kind: "role_family_context",
    title: "Common role-family context",
    body: "",
    visibility: vis("cleared_for_candidates", "on_request", "draft", {
      source: "",
      verification: "unverified",
      lastVerifiedAt: null,
    }),
  },

  // --- Internal recruiter brief -------------------------------------------
  {
    id: "ki-lg-20",
    level: "company",
    levelRefId: null,
    kind: "brief_note",
    title: "Client relationship summary",
    body: "Second search with LumaGrid. The first (Solutions Engineer, Q1) closed in 34 days and the hire is still there. Priya is the day-to-day contact; Marcus makes the actual call and will override the scorecard if he likes someone.",
    visibility: vis("recruiters_only", null, "published", {
      source: "Account history",
      verification: "verified",
      lastVerifiedAt: "2026-08-04",
      verifiedBy: "Anna John",
    }),
  },
  {
    id: "ki-lg-21",
    level: "company",
    levelRefId: null,
    kind: "brief_note",
    title: "Interview-process reliability",
    body: "Marcus reschedules first-round interviews roughly a third of the time. Confirm slots 48 hours out and warn candidates that the first round may move once. Panel rounds hold well.",
    visibility: vis("recruiters_only", null, "published", {
      source: "Observed across 11 scheduled interviews",
      verification: "verified",
      lastVerifiedAt: "2026-08-10",
      verifiedBy: "Anna John",
    }),
    promotable: true,
  },
  {
    id: "ki-lg-22",
    level: "company",
    levelRefId: null,
    kind: "brief_note",
    title: "Compensation calibration",
    body: "Base bands are roughly 8% under Austin market for GTM roles, offset by uncapped commission and a genuinely attainable quota. Candidates anchored on base alone will screen out; lead with OTE and attainment history.",
    visibility: vis("recruiters_only", null, "published", {
      source: "Offer history across 3 GTM searches",
      verification: "verified",
      lastVerifiedAt: "2026-07-30",
      verifiedBy: "Anna John",
      reviewCadenceDays: 180,
      nextReviewAt: "2027-01-26",
    }),
    promotable: true,
  },
  {
    id: "ki-lg-23",
    level: "company",
    levelRefId: null,
    kind: "brief_note",
    title: "Search constraints",
    body: "Do not source from Axis, Verkada, or Genetec — LumaGrid has active partner agreements with all three and Priya has asked us to stay clear. Everything else in the space is open.",
    visibility: vis("recruiters_only", null, "published", {
      source: "Priya Raghunathan, intake call 4 Aug 2026",
      verification: "verified",
      lastVerifiedAt: "2026-08-04",
      verifiedBy: "Anna John",
    }),
  },
  {
    id: "ki-lg-24",
    level: "company",
    levelRefId: null,
    kind: "brief_note",
    title: "Why hires fail or leave",
    body: "The one GTM hire who didn't work out came from a company with a mature partner program and expected enablement material to already exist. Screen hard for comfort building process from nothing.",
    visibility: vis("recruiters_only", null, "published", {
      source: "Post-mortem with Marcus Ellery, June 2026",
      verification: "verified",
      lastVerifiedAt: "2026-06-18",
      verifiedBy: "Anna John",
    }),
    promotable: true,
  },
  {
    id: "ki-lg-25",
    level: "company",
    levelRefId: null,
    kind: "brief_note",
    title: "Commercial terms and account health",
    body: "[Restricted] Fee schedule, exclusivity terms, and renewal risk.",
    visibility: vis("restricted", null, "published", {
      source: "Signed agreement, Feb 2026",
      verification: "verified",
      lastVerifiedAt: "2026-02-14",
      verifiedBy: "Anna John",
    }),
  },
  {
    id: "ki-lg-26",
    level: "company",
    levelRefId: null,
    kind: "brief_note",
    title: "Immigration counsel guidance",
    body: "[Restricted] Counsel's position on transfers and new petitions for GTM roles.",
    visibility: vis("restricted", null, "published", {
      source: "Client counsel, via Priya Raghunathan",
      verification: "verified",
      lastVerifiedAt: "2026-08-06",
      verifiedBy: "Anna John",
    }),
  },
]

const LUMAGRID_POLICIES: PolicyItem[] = [
  // Employment & work model
  {
    id: "pol-lg-01",
    group: "employment",
    key: "employment_types",
    label: "Employment types offered",
    value: "Full-time salaried; occasional contract for field enablement",
    candidateFacingText:
      "LumaGrid hires full-time salaried employees, with occasional contract roles in field enablement.",
    visibility: vis("cleared_for_candidates", "on_request", "published", {
      source: "Client intake call, 4 Aug 2026",
      verification: "verified",
      lastVerifiedAt: "2026-08-04",
      verifiedBy: "Anna John",
      reviewCadenceDays: 365,
      nextReviewAt: "2027-08-04",
    }),
  },
  {
    id: "pol-lg-02",
    group: "employment",
    key: "work_model",
    label: "Remote/hybrid/on-site policy",
    value: "Hybrid for Austin-based teams; remote for approved field roles",
    candidateFacingText:
      "Austin-based teams work hybrid. Approved field roles, including regional channel roles, are fully remote.",
    visibility: vis("cleared_for_candidates", "proactive", "published", {
      source: "Client intake call, 4 Aug 2026",
      verification: "verified",
      lastVerifiedAt: "2026-08-04",
      verifiedBy: "Anna John",
      reviewCadenceDays: 180,
      nextReviewAt: "2027-01-31",
    }),
  },
  {
    id: "pol-lg-03",
    group: "employment",
    key: "office_attendance",
    label: "Office attendance expectation",
    value: "3 days per week for Austin-based roles",
    candidateFacingText:
      "Austin-based employees are in the office three days a week. Remote field roles have no office requirement.",
    visibility: vis("cleared_for_candidates", "on_request", "published", {
      source: "Client intake call, 4 Aug 2026",
      verification: "verified",
      lastVerifiedAt: "2026-08-04",
      verifiedBy: "Anna John",
      reviewCadenceDays: 180,
      nextReviewAt: "2027-01-31",
    }),
  },
  {
    id: "pol-lg-04",
    group: "employment",
    key: "geographic_eligibility",
    label: "Geographic hiring eligibility",
    value: "United States only; no international employment entities",
    candidateFacingText:
      "LumaGrid currently hires in the United States only — it doesn't have employment entities elsewhere.",
    visibility: vis("cleared_for_candidates", "on_request", "published", {
      source: "Priya Raghunathan, 4 Aug 2026",
      verification: "verified",
      lastVerifiedAt: "2026-08-04",
      verifiedBy: "Anna John",
      reviewCadenceDays: 365,
      nextReviewAt: "2027-08-04",
    }),
  },
  {
    id: "pol-lg-05",
    group: "employment",
    key: "relocation",
    label: "Relocation support",
    value: "Case-by-case for Austin-based roles; not offered for remote field roles",
    candidateFacingText:
      "Relocation support is considered case-by-case for Austin-based roles. Remote field roles don't include relocation.",
    visibility: vis("cleared_for_candidates", "on_request", "published", {
      source: "Client intake call, 4 Aug 2026",
      verification: "verified",
      lastVerifiedAt: "2026-08-04",
      verifiedBy: "Anna John",
    }),
  },

  // Benefits
  {
    id: "pol-lg-10",
    group: "benefits",
    key: "health",
    label: "Health benefits",
    value: "PPO and HDHP options; company covers 90% of employee premium",
    candidateFacingText:
      "LumaGrid offers PPO and high-deductible plan options and covers 90% of the employee premium.",
    visibility: vis("cleared_for_candidates", "on_request", "published", {
      source: "2026 benefits summary",
      verification: "verified",
      lastVerifiedAt: "2026-07-15",
      verifiedBy: "Anna John",
      reviewCadenceDays: 365,
      nextReviewAt: "2027-07-15",
    }),
  },
  {
    id: "pol-lg-11",
    group: "benefits",
    key: "dental_vision",
    label: "Dental and vision benefits",
    value: "Included, company-paid for employee",
    candidateFacingText: "Dental and vision are included and company-paid for the employee.",
    visibility: vis("cleared_for_candidates", "on_request", "published", {
      source: "2026 benefits summary",
      verification: "verified",
      lastVerifiedAt: "2026-07-15",
      verifiedBy: "Anna John",
      reviewCadenceDays: 365,
      nextReviewAt: "2027-07-15",
    }),
  },
  {
    id: "pol-lg-12",
    group: "benefits",
    key: "retirement",
    label: "Retirement benefits",
    value: "401(k) with 4% match, immediate vesting",
    candidateFacingText:
      "LumaGrid offers a 401(k) with a 4% match that vests immediately.",
    visibility: vis("cleared_for_candidates", "on_request", "published", {
      source: "2026 benefits summary",
      verification: "verified",
      lastVerifiedAt: "2026-07-15",
      verifiedBy: "Anna John",
      reviewCadenceDays: 365,
      nextReviewAt: "2027-07-15",
    }),
  },
  {
    id: "pol-lg-13",
    group: "benefits",
    key: "pto",
    label: "Paid time off",
    value: "Flexible PTO with a 15-day minimum expectation",
    candidateFacingText:
      "PTO is flexible, and LumaGrid asks people to take at least 15 days a year.",
    visibility: vis("cleared_for_candidates", "on_request", "published", {
      source: "2026 benefits summary",
      verification: "verified",
      lastVerifiedAt: "2026-07-15",
      verifiedBy: "Anna John",
      reviewCadenceDays: 365,
      nextReviewAt: "2027-07-15",
    }),
  },
  {
    id: "pol-lg-14",
    group: "benefits",
    key: "parental_leave",
    label: "Parental leave",
    value: "12 weeks primary, 6 weeks secondary, fully paid",
    candidateFacingText:
      "Parental leave is 12 weeks fully paid for the primary caregiver and 6 weeks for the secondary caregiver.",
    visibility: vis("cleared_for_candidates", "on_request", "published", {
      source: "2026 benefits summary",
      verification: "verified",
      lastVerifiedAt: "2026-07-15",
      verifiedBy: "Anna John",
      reviewCadenceDays: 365,
      nextReviewAt: "2027-07-15",
    }),
  },
  {
    id: "pol-lg-15",
    group: "benefits",
    key: "learning",
    label: "Learning and development allowance",
    value: "$2,000 per year",
    candidateFacingText: "There's a $2,000 annual learning and development allowance.",
    visibility: vis("cleared_for_candidates", "on_request", "published", {
      source: "2026 benefits summary",
      verification: "verified",
      lastVerifiedAt: "2026-07-15",
      verifiedBy: "Anna John",
      reviewCadenceDays: 365,
      nextReviewAt: "2027-07-15",
    }),
  },
  {
    id: "pol-lg-16",
    group: "benefits",
    key: "home_office",
    label: "Home-office stipend",
    value: "$1,500 at hire for remote roles",
    candidateFacingText: "Remote roles get a $1,500 home-office stipend at hire.",
    visibility: vis("cleared_for_candidates", "on_request", "published", {
      source: "2026 benefits summary",
      verification: "verified",
      lastVerifiedAt: "2026-07-15",
      verifiedBy: "Anna John",
    }),
  },
  {
    id: "pol-lg-17",
    group: "compensation",
    key: "equity",
    label: "Equity availability",
    value: "Stock options for all full-time roles; 4-year vest, 1-year cliff",
    candidateFacingText:
      "All full-time roles include stock options on a four-year vest with a one-year cliff.",
    visibility: vis("cleared_for_candidates", "on_request", "published", {
      source: "Priya Raghunathan, 4 Aug 2026",
      verification: "verified",
      lastVerifiedAt: "2026-08-04",
      verifiedBy: "Anna John",
      reviewCadenceDays: 180,
      nextReviewAt: "2027-01-31",
    }),
  },
  {
    id: "pol-lg-18",
    group: "compensation",
    key: "bonus_commission",
    label: "Bonus and commission philosophy",
    value: "Uncapped commission for quota-carrying roles; no company-wide bonus",
    candidateFacingText:
      "Quota-carrying roles earn uncapped commission. LumaGrid doesn't run a separate company-wide bonus.",
    visibility: vis("cleared_for_candidates", "on_request", "published", {
      source: "Client intake call, 4 Aug 2026",
      verification: "verified",
      lastVerifiedAt: "2026-08-04",
      verifiedBy: "Anna John",
    }),
  },
  {
    id: "pol-lg-19",
    group: "compensation",
    key: "salary_transparency",
    label: "Salary-transparency policy",
    value: "Ranges shared at first recruiter conversation",
    candidateFacingText:
      "LumaGrid shares the range for a role in the first recruiter conversation.",
    visibility: vis("cleared_for_candidates", "on_request", "published", {
      source: "Priya Raghunathan, 4 Aug 2026",
      verification: "verified",
      lastVerifiedAt: "2026-08-04",
      verifiedBy: "Anna John",
    }),
  },
  {
    id: "pol-lg-20",
    group: "benefits",
    key: "wellness",
    label: "Wellness benefits",
    value: null,
    candidateFacingText: null,
    visibility: vis("cleared_for_candidates", "on_request", "draft", {
      source: "",
      verification: "unverified",
      lastVerifiedAt: null,
    }),
  },
  {
    id: "pol-lg-21",
    group: "benefits",
    key: "accommodations",
    label: "Disability accommodations process",
    value: "Requests handled by People Ops; no disclosure required to the hiring team",
    candidateFacingText:
      "Accommodation requests go to People Ops directly, and you don't need to disclose anything to the hiring team.",
    visibility: vis("cleared_for_candidates", "on_request", "published", {
      source: "2026 benefits summary",
      verification: "verified",
      lastVerifiedAt: "2026-07-15",
      verifiedBy: "Anna John",
    }),
  },

  // Immigration
  {
    id: "pol-lg-30",
    group: "immigration",
    key: "work_auth_requirement",
    label: "Work authorization requirements",
    value: "Must be authorized to work in the United States",
    immigrationValue: "confirmed_yes",
    candidateFacingText:
      "Candidates need to be authorized to work in the United States.",
    visibility: vis("cleared_for_candidates", "on_request", "published", {
      source: "Priya Raghunathan, 6 Aug 2026",
      verification: "verified",
      lastVerifiedAt: "2026-08-06",
      verifiedBy: "Anna John",
      reviewCadenceDays: 180,
      nextReviewAt: "2027-02-02",
    }),
  },
  {
    id: "pol-lg-31",
    group: "immigration",
    key: "sponsorship_general",
    label: "Visa sponsorship policy",
    value: "Varies by role",
    immigrationValue: "role_dependent",
    candidateFacingText:
      "Sponsorship is evaluated per role. I can tell you what applies to this specific role.",
    visibility: vis("cleared_for_candidates", "on_request", "published", {
      source: "Priya Raghunathan, 6 Aug 2026",
      verification: "verified",
      lastVerifiedAt: "2026-08-06",
      verifiedBy: "Anna John",
      reviewCadenceDays: 180,
      nextReviewAt: "2027-02-02",
    }),
  },
  {
    id: "pol-lg-32",
    group: "immigration",
    key: "h1b_transfer",
    label: "H-1B transfer policy",
    value: "May be considered, subject to legal review",
    immigrationValue: "case_by_case",
    candidateFacingText:
      "H-1B transfers may be considered for candidates already authorized to work in the US, subject to legal review.",
    visibility: vis("cleared_for_candidates", "on_request", "published", {
      source: "Client counsel via Priya Raghunathan, 6 Aug 2026",
      verification: "verified",
      lastVerifiedAt: "2026-08-06",
      verifiedBy: "Anna John",
      reviewCadenceDays: 90,
      nextReviewAt: "2026-11-04",
      isPresetDefault: false,
    }),
  },
  {
    id: "pol-lg-33",
    group: "immigration",
    key: "h1b_new_petition",
    label: "H-1B new-petition policy",
    value: null,
    immigrationValue: "unknown",
    candidateFacingText: null,
    visibility: vis("cleared_for_candidates", "escalate", "published", {
      source: "Asked 6 Aug 2026; awaiting counsel",
      verification: "unverified",
      lastVerifiedAt: null,
      isPresetDefault: false,
    }),
  },
  {
    id: "pol-lg-34",
    group: "immigration",
    key: "green_card",
    label: "Green-card sponsorship policy",
    value: null,
    immigrationValue: "unknown",
    candidateFacingText: null,
    visibility: vis("cleared_for_candidates", "escalate", "published", {
      source: "Asked 6 Aug 2026; awaiting counsel",
      verification: "unverified",
      lastVerifiedAt: null,
      isPresetDefault: false,
    }),
  },
  {
    id: "pol-lg-35",
    group: "immigration",
    key: "everify",
    label: "E-Verify status",
    value: "Enrolled",
    immigrationValue: "confirmed_yes",
    candidateFacingText: "LumaGrid is enrolled in E-Verify.",
    visibility: vis("cleared_for_candidates", "on_request", "published", {
      source: "Priya Raghunathan, 6 Aug 2026",
      verification: "verified",
      lastVerifiedAt: "2026-08-06",
      verifiedBy: "Anna John",
    }),
  },

  // Internal
  {
    id: "pol-lg-40",
    group: "internal",
    key: "sponsorship_budget",
    label: "Role-specific sponsorship budget",
    value: "[Restricted] Legal spend approved per requisition",
    candidateFacingText: null,
    visibility: vis("restricted", null, "published", {
      source: "Priya Raghunathan, 6 Aug 2026",
      verification: "verified",
      lastVerifiedAt: "2026-08-06",
      verifiedBy: "Anna John",
    }),
  },
  {
    id: "pol-lg-41",
    group: "internal",
    key: "offer_exceptions",
    label: "Offer and mobility exception process",
    value:
      "Priya approves to $180K OTE; above that goes to the CFO and adds roughly a week",
    candidateFacingText: null,
    visibility: vis("recruiters_only", null, "published", {
      source: "Client intake call, 4 Aug 2026",
      verification: "verified",
      lastVerifiedAt: "2026-08-04",
      verifiedBy: "Anna John",
    }),
  },
]

/**
 * Company-scoped questions — the genuinely bespoke.
 *
 * *"Is the Central territory an existing book of business or greenfield?"* is
 * not a question any other customer's candidates will ever ask. Anything a
 * second company would recognise belongs in `GLOBAL_QUESTIONS` instead, where
 * every customer gets it for free; these are the exception, and they should stay
 * rare.
 */
const LUMAGRID_CUSTOM_QUESTIONS: Question[] = [
  {
    id: "q-lg-central-territory",
    intent: "Is the Central territory an existing book of business or greenfield?",
    category: "why_role_open",
    variants: [],
    sensitive: false,
    // About one specific territory on one specific req.
    answerableAt: "job",
    onlyForJobId: "job-lg-01",
    defaultAgentUse: "on_request",
    prohibitions: [],
  },
]

const LUMAGRID_QUESTIONS: CompanyQuestion[] = [
  {
    questionId: "q-company-size",
    asks: [{ jobId: null, count: 34, lastAskedAt: "2026-08-15" }],
    askedClientAt: null,
    answers: [
      {
        id: "ans-lumagrid-01",
        scope: COMPANY_SCOPE,
        body:
        "LumaGrid has between 150 and 200 employees. It's growth-stage and privately held, and the go-to-market organization is the part growing fastest right now.",
        expandedAnswer: 
        "The company has roughly doubled headcount since 2023, with most of that growth in go-to-market and customer-facing engineering.",
        escalationInstructions: null,
        prohibitedClaims: [
          "Never give a specific revenue figure or growth rate.",
          "Never characterize funding status beyond 'privately held'.",
        ],
        visibility: vis("cleared_for_candidates", "on_request", "published", {
        source: "Client intake call, 4 Aug 2026",
        verification: "verified",
        lastVerifiedAt: "2026-08-04",
        verifiedBy: "Anna John",
        reviewCadenceDays: 180,
        nextReviewAt: "2027-01-31",
      }),
      },
    ],
  },
  {
    questionId: "q-culture",
    asks: [{ jobId: null, count: 28, lastAskedAt: "2026-08-16" }],
    askedClientAt: null,
    answers: [
      {
        id: "ans-lumagrid-02",
        scope: COMPANY_SCOPE,
        body:
        "Customer-focused, high-ownership, and practical. Decisions get made close to the customer rather than escalated, and people are expected to come with a recommendation rather than a status update. It moves quickly.",
        expandedAnswer: 
        "In the go-to-market org specifically, that means a regional lead sets their own territory strategy rather than executing a plan handed down from headquarters.",
        escalationInstructions: null,
        prohibitedClaims: [
          "Never characterize work-life balance in hours-per-week terms.",
          "Never compare the culture to a named competitor.",
        ],
        visibility: vis("cleared_for_candidates", "on_request", "published", {
        source: "Client intake call, 4 Aug 2026",
        verification: "verified",
        lastVerifiedAt: "2026-08-04",
        verifiedBy: "Anna John",
        reviewCadenceDays: 180,
        nextReviewAt: "2027-01-31",
      }),
      },
    ],
  },
  {
    questionId: "q-visa-sponsorship",
    asks: [{ jobId: null, count: 19, lastAskedAt: "2026-08-16" }],
    askedClientAt: null,
    answers: [
      {
        id: "ans-lumagrid-03",
        scope: COMPANY_SCOPE,
        body:
        "Work authorization is evaluated per role. For this role, an H-1B transfer may be considered for candidates already authorized to work in the United States, subject to legal review.",
        expandedAnswer: null,
        escalationInstructions: 
        "If the candidate asks about a new H-1B petition or a green-card timeline, hand off to the recruiter — those policies are not confirmed.",
        prohibitedClaims: [
          "Never state or imply that sponsorship is guaranteed.",
          "Never predict an immigration outcome or timeline.",
          "Never advise on immigration eligibility.",
          "Never confirm a new H-1B petition — that policy is unconfirmed.",
        ],
        visibility: vis("cleared_for_candidates", "on_request", "published", {
        source: "Client counsel via Priya Raghunathan, 6 Aug 2026",
        verification: "verified",
        lastVerifiedAt: "2026-08-06",
        verifiedBy: "Anna John",
        reviewCadenceDays: 90,
        nextReviewAt: "2026-11-04",
        isPresetDefault: false,
      }),
      },
    ],
  },
  {
    questionId: "q-comp-approach",
    asks: [{ jobId: null, count: 41, lastAskedAt: "2026-08-16" }],
    askedClientAt: null,
    answers: [
      {
        id: "ans-lumagrid-04",
        scope: COMPANY_SCOPE,
        body:
        "LumaGrid shares the range for a role in the first recruiter conversation. Quota-carrying roles are base plus uncapped commission, and all full-time roles include stock options.",
        expandedAnswer: null,
        escalationInstructions: 
        "If the candidate wants to negotiate, name a target number, or ask about an exception, hand off to the recruiter immediately.",
        prohibitedClaims: [
          "Never confirm a specific offer figure.",
          "Never suggest a number is negotiable or that an exception is possible.",
          "Never compare compensation to another company or another candidate.",
        ],
        visibility: vis("cleared_for_candidates", "on_request", "published", {
        source: "Client intake call, 4 Aug 2026",
        verification: "verified",
        lastVerifiedAt: "2026-08-04",
        verifiedBy: "Anna John",
        reviewCadenceDays: 90,
        nextReviewAt: "2026-11-02",
        isPresetDefault: false,
      }),
      },
    ],
  },
  {
    questionId: "q-remote",
    asks: [{ jobId: null, count: 52, lastAskedAt: "2026-08-16" }],
    askedClientAt: null,
    answers: [
      {
        id: "ans-lumagrid-05",
        scope: COMPANY_SCOPE,
        body:
        "Austin-based teams work hybrid, three days a week in the office. Approved field roles, including regional channel roles, are fully remote — this role is remote within the Central United States.",
        expandedAnswer: null,
        escalationInstructions: null,
        prohibitedClaims: [
          "Never promise a permanent remote arrangement for an Austin-based role.",
        ],
        visibility: vis("cleared_for_candidates", "on_request", "published", {
        source: "Client intake call, 4 Aug 2026",
        verification: "verified",
        lastVerifiedAt: "2026-08-04",
        verifiedBy: "Anna John",
        reviewCadenceDays: 180,
        nextReviewAt: "2027-01-31",
      }),
      },
    ],
  },
  {
    questionId: "q-interview-process",
    // Asked on the role, not in the abstract — which is what makes the per-role
    // count meaningful and the company-wide one misleading.
    asks: [
      { jobId: "job-lg-01", count: 44, lastAskedAt: "2026-08-16" },
      { jobId: null, count: 3, lastAskedAt: "2026-08-02" },
    ],
    askedClientAt: null,
    answers: [
      {
        id: "ans-lumagrid-06",
        scope: COMPANY_SCOPE,
        body:
        "Four stages: a recruiter screen, a conversation with the hiring manager, a working session on territory or partner strategy, and a panel with go-to-market leadership. Most candidates go from first call to decision in about three weeks.",
        expandedAnswer: 
        "The working session is a discussion, not a presentation to prepare — you'll talk through how you'd approach a region.",
        escalationInstructions: 
        "Never confirm a specific interview date or commit to scheduling. Route scheduling to the recruiter.",
        prohibitedClaims: [
          "Never promise an interview or a next round.",
          "Never commit to a specific date or timeline for a decision.",
        ],
        visibility: vis("cleared_for_candidates", "on_request", "published", {
        source: "Client intake call, 4 Aug 2026",
        verification: "verified",
        lastVerifiedAt: "2026-08-04",
        verifiedBy: "Anna John",
        reviewCadenceDays: 90,
        nextReviewAt: "2026-11-02",
      }),
      },
    ],
  },
  {
    questionId: "q-product",
    asks: [{ jobId: null, count: 30, lastAskedAt: "2026-08-15" }],
    askedClientAt: null,
    answers: [
      {
        id: "ans-lumagrid-07",
        scope: COMPANY_SCOPE,
        body:
        "LumaGrid Command is an open-platform video management system with cloud device management and AI-assisted incident search. It's software — LumaGrid doesn't make cameras. Customers are security integrators and enterprise security teams in education, healthcare, logistics, and multi-site retail.",
        expandedAnswer: 
        "The open-platform part is the point: customers keep the mixed camera hardware they already own and manage all of it from one place.",
        escalationInstructions: null,
        prohibitedClaims: [
          "Never name a specific customer that isn't in an approved case study.",
        ],
        visibility: vis("cleared_for_candidates", "on_request", "published", {
        source: "Product marketing one-pager, v4.2",
        verification: "verified",
        lastVerifiedAt: "2026-08-12",
        verifiedBy: "Anna John",
        reviewCadenceDays: 180,
        nextReviewAt: "2027-02-08",
      }),
      },
    ],
  },
  {
    questionId: "q-why-role-open",
    asks: [{ jobId: null, count: 22, lastAskedAt: "2026-08-14" }],
    askedClientAt: null,
    answers: [
      {
        id: "ans-lumagrid-08",
        scope: COMPANY_SCOPE,
        body:
        "It's a new position. LumaGrid is building out a regional channel structure and the Central region doesn't have dedicated coverage yet.",
        expandedAnswer: null,
        escalationInstructions: null,
        prohibitedClaims: [
          "Never discuss a previous employee's departure.",
          "Never speculate about restructuring.",
        ],
        visibility: vis("cleared_for_candidates", "on_request", "published", {
        source: "Client intake call, 4 Aug 2026",
        verification: "verified",
        lastVerifiedAt: "2026-08-04",
        verifiedBy: "Anna John",
      }),
      },
    ],
  },
  {
    questionId: "q-benefits",
    asks: [{ jobId: null, count: 38, lastAskedAt: "2026-08-16" }],
    askedClientAt: null,
    answers: [
      {
        id: "ans-lumagrid-09",
        scope: COMPANY_SCOPE,
        body:
        "PPO and high-deductible health options with 90% of the employee premium covered, company-paid dental and vision, a 401(k) with a 4% immediately-vesting match, flexible PTO with a 15-day minimum, and 12 weeks of fully paid primary parental leave.",
        expandedAnswer: 
        "There's also a $2,000 annual learning allowance and a $1,500 home-office stipend for remote roles.",
        escalationInstructions: null,
        prohibitedClaims: [
          "Never quote a specific premium dollar amount.",
        ],
        visibility: vis("cleared_for_candidates", "on_request", "published", {
        source: "2026 benefits summary",
        verification: "verified",
        lastVerifiedAt: "2026-07-15",
        verifiedBy: "Anna John",
        reviewCadenceDays: 365,
        nextReviewAt: "2027-07-15",
      }),
      },
    ],
  },
  {
    questionId: "q-financial-stability",
    asks: [{ jobId: null, count: 11, lastAskedAt: "2026-08-13" }],
    askedClientAt: null,
    answers: [
      {
        id: "ans-lumagrid-10",
        scope: COMPANY_SCOPE,
        body:
        "LumaGrid is a growth-stage private company with an established customer base. I'm not able to share financial details — the recruiter can talk through what's public.",
        expandedAnswer: null,
        escalationInstructions: 
        "Always hand off. Do not attempt to reassure the candidate beyond this answer.",
        prohibitedClaims: [
          "Never comment on runway, profitability, or funding.",
          "Never comment on layoffs, past or anticipated.",
          "Never reassure the candidate about job security.",
        ],
        visibility: vis("cleared_for_candidates", "escalate", "published", {
        source: "Recruiter policy",
        verification: "verified",
        lastVerifiedAt: "2026-08-04",
        verifiedBy: "Anna John",
        isPresetDefault: false,
      }),
      },
    ],
  },
  {
    questionId: "q-typical-week",
    asks: [{ jobId: null, count: 16, lastAskedAt: "2026-08-16" }],
    askedClientAt: null,
    answers: [
      {
        id: "ans-lumagrid-11",
        scope: COMPANY_SCOPE,
        body:
          "It varies by function. Field roles are travel-heavy; Austin-based roles are in the office three days a week.",
        expandedAnswer: null,
        escalationInstructions: null,
        prohibitedClaims: [],
        visibility: vis("cleared_for_candidates", "on_request", "published", {
          source: "Client intake call, 4 Aug 2026",
          verification: "verified",
          lastVerifiedAt: "2026-08-04",
          verifiedBy: "Anna John",
          reviewCadenceDays: 180,
          nextReviewAt: "2027-01-31",
        }),
      },
      {
        id: "ans-lumagrid-11b",
        scope: { kind: "team", refId: "team-lg-channel" },
        body:
          "Partner visits and enablement sessions, distributor coordination, partner pipeline reviews, joint business planning, sales-engineering coordination, and regional travel. Travel runs 40 to 60%.",
        expandedAnswer:
          "A typical week has two or three days on the road with partners and the rest on pipeline and planning work.",
        escalationInstructions: null,
        prohibitedClaims: [
          "Never promise a specific travel percentage below the stated range.",
        ],
        visibility: vis("cleared_for_candidates", "on_request", "published", {
          source: "Marcus Ellery, 5 Aug 2026",
          verification: "verified",
          lastVerifiedAt: "2026-08-05",
          verifiedBy: "Anna John",
          reviewCadenceDays: 180,
          nextReviewAt: "2027-02-01",
        }),
      },
    ],
  },
  {
    // The three-deep example: a company default, a team answer, and a role that
    // needs its own. "Who would I report to?" is the question this whole model
    // exists for — the same question everywhere, a different true answer at
    // every scope.
    questionId: "q-reporting-line",
    asks: [{ jobId: null, count: 24, lastAskedAt: "2026-08-15" }],
    askedClientAt: null,
    answers: [
      {
        id: "ans-lumagrid-12",
        scope: COMPANY_SCOPE,
        body:
          "Every role reports into the function it sits in. Your recruiter will name the specific hiring manager in the first conversation.",
        expandedAnswer: null,
        escalationInstructions: null,
        prohibitedClaims: [
          "Never characterize a manager's management style beyond an approved bio.",
        ],
        visibility: vis("cleared_for_candidates", "on_request", "published", {
          source: "Client intake call, 4 Aug 2026",
          verification: "verified",
          lastVerifiedAt: "2026-08-04",
          verifiedBy: "Anna John",
          reviewCadenceDays: 180,
          nextReviewAt: "2027-01-31",
        }),
      },
      {
        id: "ans-lumagrid-12b",
        scope: { kind: "team", refId: "team-lg-channel" },
        body:
          "You'd report to Marcus Ellery, VP of Channel Growth. He spent twelve years building integrator and distributor programs in physical security before joining LumaGrid, and he still runs partner visits himself most weeks.",
        expandedAnswer: null,
        escalationInstructions: null,
        prohibitedClaims: [],
        visibility: vis("cleared_for_candidates", "on_request", "published", {
          source: "Bio approved by client marketing, 2 Aug 2026",
          verification: "verified",
          lastVerifiedAt: "2026-08-02",
          verifiedBy: "Anna John",
          reviewCadenceDays: 180,
          nextReviewAt: "2027-01-29",
        }),
      },
      {
        id: "ans-lumagrid-12c",
        scope: { kind: "job", refId: "job-lg-01" },
        body:
          "You'd report to Marcus Ellery, VP of Channel Growth, with a dotted line to Revenue Operations for territory planning — the Central region reports through RevOps for forecasting.",
        expandedAnswer: null,
        escalationInstructions: null,
        prohibitedClaims: ["Never describe the dotted line as a second manager."],
        visibility: vis("cleared_for_candidates", "on_request", "published", {
          source: "Marcus Ellery, 12 Aug 2026",
          verification: "verified",
          lastVerifiedAt: "2026-08-12",
          verifiedBy: "Anna John",
          isPresetDefault: false,
        }),
      },
    ],
  },
  {
    questionId: "q-travel",
    asks: [{ jobId: null, count: 20, lastAskedAt: "2026-08-16" }],
    askedClientAt: null,
    answers: [
      {
        id: "ans-lumagrid-13",
        scope: COMPANY_SCOPE,
        body:
        "Travel runs 40 to 60% for this role — partner visits, enablement sessions, and distributor meetings across the Central region.",
        expandedAnswer: null,
        escalationInstructions: null,
        prohibitedClaims: [
          "Never promise travel below the stated range.",
        ],
        visibility: vis("cleared_for_candidates", "on_request", "published", {
        source: "Marcus Ellery, 5 Aug 2026",
        verification: "verified",
        lastVerifiedAt: "2026-08-05",
        verifiedBy: "Anna John",
      }),
      },
    ],
  },
  {
    questionId: "q-team-collaboration",
    asks: [{ jobId: null, count: 9, lastAskedAt: "2026-08-12" }],
    askedClientAt: null,
    answers: [
      {
        id: "ans-lumagrid-14",
        scope: COMPANY_SCOPE,
        body:
        "The go-to-market org covers direct sales, channel, customer success, and revenue operations. Channel roles work closely with sales engineering on partner technical enablement and with revenue operations on partner pipeline reporting.",
        expandedAnswer: null,
        escalationInstructions: null,
        prohibitedClaims: [],
        visibility: vis("cleared_for_candidates", "on_request", "published", {
        source: "Marcus Ellery, 5 Aug 2026",
        verification: "verified",
        lastVerifiedAt: "2026-08-05",
        verifiedBy: "Anna John",
      }),
      },
    ],
  },
  {
    questionId: "q-lg-central-territory",
    asks: [{ jobId: "job-lg-01", count: 6, lastAskedAt: "2026-08-16" }],
    askedClientAt: null,
    answers: [],
  },
  {
    questionId: "q-new-h1b-petition",
    asks: [{ jobId: null, count: 4, lastAskedAt: "2026-08-16" }],
    askedClientAt: "2026-08-12",
    answers: [],
  },
  {
    questionId: "q-quota-attainment",
    asks: [{ jobId: null, count: 3, lastAskedAt: "2026-08-15" }],
    askedClientAt: null,
    // Recruiters-only: we know the number, and a candidate never hears it from
    // an agent. The one fixture that makes the audience toggle observable — a
    // candidate gets the withheld fallback, an internal agent gets the figure.
    answers: [
      {
        id: "ans-lumagrid-quota",
        scope: COMPANY_SCOPE,
        body:
          "Quota for a regional channel role is $1.4M in partner-sourced pipeline, and 6 of 9 on the team hit it last year. Marcus is candid about the two who didn't — both inherited cold territories.",
        expandedAnswer: null,
        escalationInstructions: null,
        prohibitedClaims: [],
        visibility: vis("recruiters_only", null, "published", {
          source: "Marcus Ellery, 12 Aug 2026",
          verification: "verified",
          lastVerifiedAt: "2026-08-12",
          verifiedBy: "Anna John",
          isPresetDefault: false,
        }),
      },
    ],
  },
  {
    questionId: "q-wellness-benefit",
    asks: [{ jobId: null, count: 2, lastAskedAt: "2026-08-14" }],
    askedClientAt: null,
    answers: [],
  },
]

const LUMAGRID_TEAMS: Team[] = [
  {
    id: "team-lg-gtm",
    parentTeamId: null,
    name: "Go-to-Market",
    mission:
      "Build scalable revenue through direct sales, channel partnerships, customer expansion, and market development.",
    description:
      "The go-to-market organization covers direct sales, channel partnerships, customer success, and revenue operations. It's the part of LumaGrid growing fastest, and the channel program is its newest investment.",
    leaderId: "sh-lg-01",
    sizeRange: "40–55",
    operatingModel: "Hybrid in Austin; regional roles fully remote",
    locations: ["Austin, TX"],
    timezoneSpread: null,
    workingStyle: null,
    collaborationCadence: null,
    dayInTheLife: null,
    goals: [],
    crossFunctionalPartners: ["Sales Engineering", "Product Marketing", "Revenue Operations"],
    commonRoleFamilies: [
      "Channel development",
      "Enterprise sales",
      "Sales engineering",
      "Customer success",
    ],
    cultureNotes: null,
    internalNotes:
      "Marcus owns headcount for the whole GTM org and moves budget between teams mid-quarter. Confirm the req is still funded before a long search.",
    visibility: vis("cleared_for_candidates", "on_request", "published", {
      source: "Marcus Ellery, 5 Aug 2026",
      verification: "verified",
      lastVerifiedAt: "2026-08-05",
      verifiedBy: "Anna John",
      reviewCadenceDays: 180,
      nextReviewAt: "2027-02-01",
    }),
    createdBecauseJobId: "job-lg-01",
  },
  {
    // Nested one level under Go-to-Market — what used to be "a team inside a
    // department" is now just a team with a parent.
    id: "team-lg-channel",
    parentTeamId: "team-lg-gtm",
    name: "Channel Growth",
    mission:
      "Recruit, enable, and grow strategic security integrator and distributor relationships across the United States.",
    description: null,
    leaderId: "sh-lg-01",
    sizeRange: "6–9",
    operatingModel: null,
    locations: ["Austin, TX", "Remote — US regional"],
    timezoneSpread: "US Central and Eastern",
    workingStyle:
      "Field-heavy and autonomous. Regional leads own their territory strategy end to end and are measured on partner-sourced pipeline rather than activity.",
    collaborationCadence:
      "Weekly regional pipeline review, monthly partner business reviews, quarterly in-person team offsite in Austin.",
    dayInTheLife:
      "Partner visits and enablement sessions, distributor coordination, partner pipeline reviews, joint business planning, sales-engineering coordination, and regional travel. Two or three days on the road in a typical week.",
    goals: [
      "Build a repeatable regional channel motion",
      "Grow partner-sourced pipeline in underserved regions",
      "Activate and enable new integrator and distributor partners",
    ],
    crossFunctionalPartners: [],
    commonRoleFamilies: [],
    cultureNotes:
      "Small enough that one region's strategy visibly moves the team number. People are expected to build process rather than inherit it.",
    internalNotes:
      "Marcus will override the scorecard if he personally likes a candidate's partner relationships. Lead with named integrator relationships in submissions.",
    visibility: vis("cleared_for_candidates", "on_request", "published", {
      source: "Marcus Ellery, 5 Aug 2026",
      verification: "verified",
      lastVerifiedAt: "2026-08-05",
      verifiedBy: "Anna John",
      reviewCadenceDays: 180,
      nextReviewAt: "2027-02-01",
    }),
    createdBecauseJobId: "job-lg-01",
  },
]

const LUMAGRID_JOBS: CompanyJob[] = [
  {
    id: "job-lg-01",
    title: "Regional Channel Development Manager, Central",
    teamId: "team-lg-channel",
    location: "Texas preferred; remote within the Central United States",
    travel: "40–60%",
    reportsTo: "VP of Channel Growth",
    rolePurpose:
      "Build a repeatable Central-region channel ecosystem by recruiting, activating, enabling, and growing integrator and distributor partners.",
    compensation: "$115K base; $200K OTE; uncapped commission",
    sponsorshipPolicy: "case_by_case",
    typicalWeek:
      "Partner visits, enablement sessions, distributor coordination, partner pipeline reviews, joint business planning, sales-engineering coordination, and regional travel.",
    first90DayOutcomes: [
      "Map the Central-region partner landscape and rank targets",
      "Re-engage the three largest inherited integrator relationships",
      "Stand up a repeatable partner onboarding and enablement sequence",
    ],
    roleRisks:
      "The territory is broad and partially greenfield, so the candidate must be comfortable building process and operating amid ambiguity.",
    interviewStages: [
      "Recruiter screen",
      "Hiring manager interview",
      "Partner-strategy exercise",
      "Panel with sales engineering",
      "Offer",
    ],
    overrides: [
      {
        fieldKey: "location",
        label: "Location",
        inheritedFromLevel: "company",
        inheritedValue: "Hybrid — Austin, 3 days per week",
        overrideValue: "Remote within the Central United States",
        reason: "Approved field role",
        conflictsWithVerified: false,
      },
      {
        fieldKey: "travel",
        label: "Travel",
        inheritedFromLevel: "company",
        inheritedValue: "Not specified",
        overrideValue: "40–60%",
        reason: null,
        conflictsWithVerified: false,
      },
      {
        fieldKey: "sponsorship",
        label: "Sponsorship eligibility",
        inheritedFromLevel: "company",
        inheritedValue: "Role-dependent",
        overrideValue: "Case-by-case — H-1B transfer only, subject to legal review",
        reason: "Confirmed with client counsel 6 Aug 2026",
        conflictsWithVerified: false,
      },
    ],
    status: "open",
  },
]

const LUMAGRID_ACTIVITY: ActivityEntry[] = [
  {
    id: "act-lg-01",
    event: "agent_used_item",
    entityLabel: "FAQ — Do you sponsor visas?",
    actor: "Screening agent",
    actorType: "system",
    at: "2026-08-16T15:42:00Z",
    detail: "Used in a candidate screen; new-petition follow-up escalated to recruiter.",
  },
  {
    id: "act-lg-02",
    event: "verified",
    entityLabel: "Policy — H-1B transfer policy",
    actor: "Anna John",
    actorType: "user",
    at: "2026-08-06T11:20:00Z",
    detail: "Confirmed with client counsel via Priya Raghunathan.",
  },
  {
    id: "act-lg-03",
    event: "agent_use_changed",
    entityLabel: "FAQ — Is the company financially stable?",
    actor: "Anna John",
    actorType: "user",
    at: "2026-08-05T09:05:00Z",
    detail: "Answer only if asked → Always escalate.",
  },
  {
    id: "act-lg-04",
    event: "published",
    entityLabel: "Narrative — Why the company is growing or hiring",
    actor: "Anna John",
    actorType: "user",
    at: "2026-08-04T16:30:00Z",
    detail: null,
  },
  {
    id: "act-lg-05",
    event: "created",
    entityLabel: "Department — Go-to-Market",
    actor: "Anna John",
    actorType: "user",
    at: "2026-08-04T16:12:00Z",
    detail: "Created for Regional Channel Development Manager, Central.",
  },
  {
    id: "act-lg-06",
    event: "restricted_expanded",
    entityLabel: "Brief — Commercial terms and account health",
    actor: "Anna John",
    actorType: "user",
    at: "2026-08-04T10:02:00Z",
    detail: null,
  },
  {
    id: "act-lg-07",
    event: "created",
    entityLabel: "Company — LumaGrid Security",
    actor: "Anna John",
    actorType: "user",
    at: "2026-08-04T09:40:00Z",
    detail: "Created after client intake call. Disclosure preset: Standard.",
  },
]

const LUMAGRID: Company = {
  id: "co-lumagrid",
  slug: "lumagrid-security",
  preferredName: "LumaGrid Security",
  legalName: "LumaGrid Systems, Inc.",
  tagline: "Open-platform video intelligence for modern physical-security teams",
  website: "https://lumagrid.com",
  linkedinUrl: "https://linkedin.com/company/lumagrid",
  logoPath: null,
  headquarters: "Austin, Texas",
  officeLocations: ["Austin, TX (HQ)", "Remote — US field"],
  countriesOfOperation: ["United States"],
  industry: "Physical security software",
  subIndustry: "Video management systems",
  stage: "growth_private",
  foundedYear: 2017,
  employeeRange: "150–200",
  operatingModel: "hybrid",
  productCategories: [
    "Open-platform VMS",
    "Cloud device management",
    "AI-assisted incident search",
  ],
  customerTypes: [
    "Security integrators",
    "Enterprise security teams",
    "Education",
    "Healthcare",
    "Logistics",
    "Multi-site retail",
  ],
  verticals: ["Education", "Healthcare", "Logistics", "Retail", "Commercial real estate"],
  accountOwner: "Anna John",
  contractStatus: "active",
  searchExclusivity: "Non-exclusive; two agencies on GTM roles",
  relationshipHealth: "strong",
  internalPriority: "high",
  responsivenessNotes:
    "Priya responds within a day. Marcus is fastest on mobile and slow on email.",
  disclosurePreset: "standard",
  createdAt: "2026-08-04",
  updatedAt: "2026-08-16",
  knowledge: LUMAGRID_KNOWLEDGE,
  policies: LUMAGRID_POLICIES,
  questions: LUMAGRID_QUESTIONS,
  customQuestions: LUMAGRID_CUSTOM_QUESTIONS,
  teams: LUMAGRID_TEAMS,
  fallbacks: {
    withheld:
      "I'd rather Anna walk you through that than give you half an answer — she owns this search and knows the detail. I'll let her know you asked.",
    reassure:
      "Completely fair to be weighing that up. Where things stand: the team is moving quickly on this one, and I'll make sure you hear back either way rather than being left wondering.",
  },
  stakeholders: LUMAGRID_STAKEHOLDERS,
  jobs: LUMAGRID_JOBS,
  activity: LUMAGRID_ACTIVITY,
  versions: [
    {
      id: "ver-lg-04",
      publishedAt: "2026-08-12T14:05:00Z",
      publishedBy: "Anna John",
      changeCount: 6,
      summary: "Product overview refreshed for Command 4.2; differentiators approved.",
    },
    {
      id: "ver-lg-03",
      publishedAt: "2026-08-06T11:40:00Z",
      publishedBy: "Anna John",
      changeCount: 3,
      summary: "H-1B transfer policy confirmed with client counsel.",
    },
    {
      id: "ver-lg-02",
      publishedAt: "2026-08-05T09:20:00Z",
      publishedBy: "Anna John",
      changeCount: 11,
      summary: "Channel Growth team context and hiring-manager bio added.",
    },
    {
      id: "ver-lg-01",
      publishedAt: "2026-08-04T17:02:00Z",
      publishedBy: "Anna John",
      changeCount: 24,
      summary: "First publish after the intake call.",
    },
  ],
}

// ===========================================================================
// Fixture 2 — Verity Health (just after intake → "Blocked")
// ===========================================================================

const VERITY: Company = {
  id: "co-verity",
  slug: "verity-health",
  preferredName: "Verity Health Analytics",
  legalName: null,
  tagline: null,
  website: "https://verityhealth.io",
  linkedinUrl: null,
  logoPath: null,
  headquarters: "Boston, Massachusetts",
  officeLocations: [],
  countriesOfOperation: [],
  industry: "Healthcare analytics",
  subIndustry: null,
  stage: "early_venture",
  foundedYear: null,
  employeeRange: "50–80",
  operatingModel: null,
  productCategories: [],
  customerTypes: [],
  verticals: [],
  accountOwner: "Anna John",
  contractStatus: "pending",
  searchExclusivity: null,
  relationshipHealth: "unknown",
  internalPriority: "medium",
  responsivenessNotes: null,
  disclosurePreset: "conservative",
  createdAt: "2026-08-15",
  updatedAt: "2026-08-15",
  knowledge: [
    {
      id: "ki-vh-01",
      level: "company",
      levelRefId: null,
      kind: "one_liner",
      title: "One-sentence description",
      body: "",
      visibility: vis("cleared_for_candidates", "on_request", "draft", {
        source: "",
        verification: "unverified",
        lastVerifiedAt: null,
      }),
    },
    {
      id: "ki-vh-02",
      level: "company",
      levelRefId: null,
      kind: "brief_note",
      title: "Intake call notes",
      body: "First call with the VP of Engineering on 15 Aug. Two backend roles and a data platform role coming. She mentioned they're picky about healthcare-data experience but didn't say whether it's a hard requirement. Needs a follow-up call before we can write anything candidate-facing.",
      visibility: vis("recruiters_only", null, "published", {
        source: "Intake call, 15 Aug 2026",
        verification: "unverified",
        lastVerifiedAt: null,
      }),
    },
  ],
  policies: [
    {
      id: "pol-vh-01",
      group: "immigration",
      key: "work_auth_requirement",
      label: "Work authorization requirements",
      value: null,
      immigrationValue: "unknown",
      candidateFacingText: null,
      visibility: vis("cleared_for_candidates", "escalate", "draft", {
        source: "",
        verification: "unverified",
        lastVerifiedAt: null,
      }),
    },
    {
      id: "pol-vh-02",
      group: "immigration",
      key: "sponsorship_general",
      label: "Visa sponsorship policy",
      value: null,
      immigrationValue: "unknown",
      candidateFacingText: null,
      visibility: vis("cleared_for_candidates", "escalate", "draft", {
        source: "",
        verification: "unverified",
        lastVerifiedAt: null,
      }),
    },
    {
      id: "pol-vh-03",
      group: "employment",
      key: "work_model",
      label: "Remote/hybrid/on-site policy",
      value: null,
      candidateFacingText: null,
      visibility: vis("cleared_for_candidates", "on_request", "draft", {
        source: "",
        verification: "unverified",
        lastVerifiedAt: null,
      }),
    },
  ],
  questions: [],
  customQuestions: [],
  teams: [],
  stakeholders: [
    {
      id: "sh-vh-01",
      name: "Dana Okonkwo",
      title: "VP of Engineering",
      role: "hiring_manager",
      candidateFacingBio: null,
      internalNotes: "Primary contact. Prefers a written brief before calls.",
      visibility: vis("recruiters_only", null, "published", {
        source: "Intake call, 15 Aug 2026",
        verification: "unverified",
        lastVerifiedAt: null,
      }),
    },
  ],
  // The req the intake call happened for, three days old and empty — the state
  // the Jobs section's coverage row exists to show. Verity is already `blocked`
  // on company-level checks, so this exercises the row without moving the
  // fixture off the readiness state it was built to demonstrate.
  jobs: [
    {
      id: "job-vh-01",
      title: "Senior Data Engineer",
      interviewStages: [],
      teamId: null,
      location: "Boston, MA",
      travel: null,
      reportsTo: null,
      rolePurpose: null,
      compensation: null,
      sponsorshipPolicy: null,
      typicalWeek: null,
      first90DayOutcomes: [],
      roleRisks: null,
      overrides: [],
      status: "open",
    },
  ],
  activity: [
    {
      id: "act-vh-01",
      event: "created",
      entityLabel: "Company — Verity Health Analytics",
      actor: "Anna John",
      actorType: "user",
      at: "2026-08-15T14:20:00Z",
      detail: "Created after client intake call. Disclosure preset: Conservative.",
    },
  ],
  versions: [],
}

// ===========================================================================
// Fixture 3 — Harborline Freight (expired → "Recruiter review required")
// ===========================================================================

const HARBORLINE_CUSTOM_QUESTIONS: Question[] = [
  {
    id: "q-hl-newark-req",
    intent: "Is the Newark req still open after the hiring freeze?",
    category: "hiring_timeline",
    variants: [],
    sensitive: false,
    // The Newark req question is about one specific role, so it can only be
    // answered there.
    answerableAt: "job",
    defaultAgentUse: "on_request",
    prohibitions: [],
  },
]

const HARBORLINE: Company = {
  id: "co-harborline",
  slug: "harborline-freight",
  preferredName: "Harborline Freight Systems",
  legalName: "Harborline Freight Systems LLC",
  tagline: "Port-to-door visibility for regional freight networks",
  website: "https://harborline.com",
  linkedinUrl: "https://linkedin.com/company/harborline",
  logoPath: null,
  headquarters: "Long Beach, California",
  officeLocations: ["Long Beach, CA (HQ)", "Newark, NJ"],
  countriesOfOperation: ["United States"],
  industry: "Logistics software",
  subIndustry: "Freight visibility",
  stage: "late_stage",
  foundedYear: 2012,
  employeeRange: "400–600",
  operatingModel: "onsite",
  productCategories: ["Freight visibility", "Yard management"],
  customerTypes: ["Regional carriers", "Port operators", "3PLs"],
  verticals: ["Logistics", "Manufacturing"],
  accountOwner: "Anna John",
  contractStatus: "active",
  searchExclusivity: "Exclusive on operations roles",
  relationshipHealth: "at_risk",
  internalPriority: "low",
  responsivenessNotes:
    "Went quiet after the Q1 hiring freeze. Nothing verified since February.",
  disclosurePreset: "standard",
  createdAt: "2025-11-03",
  updatedAt: "2026-02-10",
  knowledge: [
    {
      id: "ki-hl-01",
      level: "company",
      levelRefId: null,
      kind: "one_liner",
      title: "One-sentence description",
      body: "Harborline gives regional freight networks a single view of a shipment from port arrival to final delivery.",
      visibility: vis("cleared_for_candidates", "on_request", "published", {
        source: "Client marketing site",
        verification: "stale",
        lastVerifiedAt: "2025-12-02",
        verifiedBy: "Anna John",
        reviewCadenceDays: 180,
        nextReviewAt: "2026-05-31",
        isPresetDefault: false,
      }),
    },
    {
      id: "ki-hl-02",
      level: "company",
      levelRefId: null,
      kind: "culture",
      title: "Culture and working style",
      body: "Operations-driven and on-site. Teams sit near the yards they support, and most decisions get made in person.",
      visibility: vis("cleared_for_candidates", "on_request", "published", {
        source: "Client intake call, Nov 2025",
        verification: "stale",
        lastVerifiedAt: "2025-11-03",
        verifiedBy: "Anna John",
        reviewCadenceDays: 180,
        nextReviewAt: "2026-05-02",
      }),
    },
    {
      id: "ki-hl-03",
      level: "company",
      levelRefId: null,
      kind: "why_hiring",
      title: "Why the company is growing or hiring",
      body: "Expanding yard-management coverage to East Coast ports.",
      visibility: vis("cleared_for_candidates", "on_request", "published", {
        source: "Client intake call, Nov 2025",
        verification: "stale",
        lastVerifiedAt: "2025-11-03",
        verifiedBy: "Anna John",
        reviewCadenceDays: 90,
        nextReviewAt: "2026-02-01",
      }),
    },
    {
      id: "ki-hl-04",
      level: "company",
      levelRefId: null,
      kind: "brief_note",
      title: "Client relationship summary",
      body: "Hiring froze in Q1 2026 and the account has been quiet since. Two open reqs are technically still live but unconfirmed. Re-qualify before sourcing.",
      visibility: vis("recruiters_only", null, "published", {
        source: "Account history",
        verification: "needs_review",
        lastVerifiedAt: "2026-02-10",
        verifiedBy: "Anna John",
      }),
    },
  ],
  policies: [
    {
      id: "pol-hl-01",
      group: "employment",
      key: "work_model",
      label: "Remote/hybrid/on-site policy",
      value: "On-site, five days a week",
      candidateFacingText: "Harborline roles are on-site five days a week.",
      visibility: vis("cleared_for_candidates", "on_request", "published", {
        source: "Client intake call, Nov 2025",
        verification: "stale",
        lastVerifiedAt: "2025-11-03",
        verifiedBy: "Anna John",
        reviewCadenceDays: 180,
        nextReviewAt: "2026-05-02",
      }),
    },
    {
      id: "pol-hl-02",
      group: "immigration",
      key: "work_auth_requirement",
      label: "Work authorization requirements",
      value: "Must be authorized to work in the United States",
      immigrationValue: "confirmed_yes",
      candidateFacingText: "Candidates need to be authorized to work in the United States.",
      visibility: vis("cleared_for_candidates", "on_request", "published", {
        source: "Client intake call, Nov 2025",
        verification: "stale",
        lastVerifiedAt: "2025-11-03",
        verifiedBy: "Anna John",
        reviewCadenceDays: 180,
        nextReviewAt: "2026-05-02",
      }),
    },
    {
      id: "pol-hl-03",
      group: "immigration",
      key: "sponsorship_general",
      label: "Visa sponsorship policy",
      value: "Not offered",
      immigrationValue: "confirmed_no",
      candidateFacingText: "Harborline doesn't sponsor work visas.",
      visibility: vis("cleared_for_candidates", "on_request", "published", {
        source: "Client intake call, Nov 2025",
        verification: "stale",
        lastVerifiedAt: "2025-11-03",
        verifiedBy: "Anna John",
        reviewCadenceDays: 180,
        nextReviewAt: "2026-05-02",
      }),
    },
    {
      id: "pol-hl-04",
      group: "benefits",
      key: "health",
      label: "Health benefits",
      value: "PPO; company covers 75% of employee premium",
      candidateFacingText:
        "Harborline offers a PPO plan and covers 75% of the employee premium.",
      visibility: vis("cleared_for_candidates", "on_request", "published", {
        source: "2025 benefits summary",
        verification: "stale",
        lastVerifiedAt: "2025-11-03",
        verifiedBy: "Anna John",
        reviewCadenceDays: 365,
        nextReviewAt: "2026-11-03",
      }),
    },
  ],
  customQuestions: HARBORLINE_CUSTOM_QUESTIONS,
  questions: [
  {
    questionId: "q-remote",
    asks: [{ jobId: null, count: 18, lastAskedAt: "2026-01-28" }],
    askedClientAt: null,
    answers: [
      {
        id: "ans-harborline-01",
        scope: COMPANY_SCOPE,
        body:
        "Harborline roles are on-site five days a week, near the yard the team supports.",
        expandedAnswer: null,
        escalationInstructions: null,
        prohibitedClaims: [
          "Never suggest a remote exception is possible.",
        ],
        visibility: vis("cleared_for_candidates", "on_request", "published", {
        source: "Client intake call, Nov 2025",
        verification: "stale",
        lastVerifiedAt: "2025-11-03",
        verifiedBy: "Anna John",
        reviewCadenceDays: 180,
        nextReviewAt: "2026-05-02",
      }),
      },
    ],
    },
    {
    questionId: "q-company-size",
    asks: [{ jobId: null, count: 12, lastAskedAt: "2026-01-22" }],
    askedClientAt: null,
    answers: [
      {
        id: "ans-harborline-02",
        scope: COMPANY_SCOPE,
        body:
        "Harborline has between 400 and 600 employees across Long Beach and Newark.",
        expandedAnswer: null,
        escalationInstructions: null,
        prohibitedClaims: [],
        visibility: vis("cleared_for_candidates", "on_request", "published", {
        source: "Client marketing site",
        verification: "stale",
        lastVerifiedAt: "2025-12-02",
        verifiedBy: "Anna John",
        reviewCadenceDays: 180,
        nextReviewAt: "2026-05-31",
      }),
      },
    ],
    },
    {
    questionId: "q-interview-process",
    asks: [{ jobId: null, count: 15, lastAskedAt: "2026-01-30" }],
    askedClientAt: null,
    answers: [
      {
        id: "ans-harborline-03",
        scope: COMPANY_SCOPE,
        body:
        "Three stages: a recruiter screen, an on-site with the yard operations director, and a shift walkthrough at the facility.",
        expandedAnswer: null,
        escalationInstructions: 
        "Never confirm a specific interview date or commit to scheduling. Route scheduling to the recruiter.",
        prohibitedClaims: [
          "Never promise an interview or a next round.",
          "Never commit to a timeline — the req is on hold.",
        ],
        visibility: vis("cleared_for_candidates", "on_request", "published", {
        source: "Client intake call, Nov 2025",
        verification: "stale",
        lastVerifiedAt: "2025-11-03",
        verifiedBy: "Anna John",
        reviewCadenceDays: 180,
        nextReviewAt: "2026-05-02",
      }),
      },
    ],
    },
    {
    questionId: "q-culture",
    asks: [{ jobId: null, count: 9, lastAskedAt: "2026-01-25" }],
    askedClientAt: null,
    answers: [
      {
        id: "ans-harborline-04",
        scope: COMPANY_SCOPE,
        body:
        "Operations-driven and hands-on. Teams sit near the yards they support, and most decisions get made in person rather than over email.",
        expandedAnswer: null,
        escalationInstructions: null,
        prohibitedClaims: [
          "Never characterize shift expectations or overtime.",
        ],
        visibility: vis("cleared_for_candidates", "on_request", "published", {
        source: "Client intake call, Nov 2025",
        verification: "stale",
        lastVerifiedAt: "2025-11-03",
        verifiedBy: "Anna John",
        reviewCadenceDays: 180,
        nextReviewAt: "2026-05-02",
      }),
      },
    ],
    },
    {
    questionId: "q-hl-newark-req",
    asks: [{ jobId: null, count: 5, lastAskedAt: "2026-02-08" }],
    askedClientAt: "2026-02-09",
    answers: [],
    },
  ],
  teams: [],
  stakeholders: [
    {
      id: "sh-hl-01",
      name: "Ray Delgado",
      title: "Director of Yard Operations",
      role: "hiring_manager",
      candidateFacingBio: null,
      internalNotes: "Unresponsive since February. Try mobile, not email.",
      visibility: vis("recruiters_only", null, "published", {
        source: "Account history",
        verification: "needs_review",
        lastVerifiedAt: "2026-02-10",
        verifiedBy: "Anna John",
      }),
    },
  ],
  jobs: [
    {
      id: "job-hl-01",
      title: "Yard Operations Supervisor",
      interviewStages: ["Recruiter screen", "On-site with the yard director", "Shift walkthrough"],
      teamId: null,
      location: "Newark, NJ",
      travel: null,
      reportsTo: "Director of Yard Operations",
      rolePurpose: null,
      compensation: null,
      sponsorshipPolicy: "confirmed_no",
      typicalWeek: null,
      first90DayOutcomes: [],
      roleRisks: null,
      overrides: [],
      status: "paused",
    },
  ],
  activity: [
    {
      id: "act-hl-01",
      event: "marked_stale",
      entityLabel: "Company knowledge — 7 items",
      actor: "System",
      actorType: "system",
      at: "2026-06-01T00:00:00Z",
      detail: "Review cadence elapsed with no re-verification.",
    },
    {
      id: "act-hl-02",
      event: "edited",
      entityLabel: "Brief — Client relationship summary",
      actor: "Anna John",
      actorType: "user",
      at: "2026-02-10T13:15:00Z",
      detail: "Noted Q1 hiring freeze.",
    },
    {
      id: "act-hl-03",
      event: "created",
      entityLabel: "Company — Harborline Freight Systems",
      actor: "Anna John",
      actorType: "user",
      at: "2025-11-03T10:00:00Z",
      detail: "Created after client intake call. Disclosure preset: Standard.",
    },
  ],
  versions: [
    {
      id: "ver-hl-02",
      publishedAt: "2026-02-10T13:20:00Z",
      publishedBy: "Anna John",
      changeCount: 1,
      summary: "Noted the Q1 hiring freeze in the recruiter brief.",
    },
    {
      id: "ver-hl-01",
      publishedAt: "2025-11-03T10:15:00Z",
      publishedBy: "Anna John",
      changeCount: 18,
      summary: "First publish after the intake call.",
    },
  ],
}

// ===========================================================================
// Exports
// ===========================================================================

export const MOCK_COMPANIES: Company[] = [LUMAGRID, VERITY, HARBORLINE]

export function getMockCompany(id: string): Company | undefined {
  return MOCK_COMPANIES.find((c) => c.id === id || c.slug === id)
}

/**
 * Kept as a named helper even though it's now a field read: call sites say
 * "every team at this company", and `company.teams` being flat (with nesting in
 * `parentTeamId`) is the thing that replaced flattening departments.
 */
export function allTeams(company: Company): Team[] {
  return company.teams
}

/** Narrative blocks only — everything except the internal brief notes. */
export function narrativeItems(company: Company): KnowledgeItem[] {
  return company.knowledge.filter((k) => k.kind !== "brief_note")
}

/** Internal recruiter brief notes only. */
export function briefItems(company: Company): KnowledgeItem[] {
  return company.knowledge.filter((k) => k.kind === "brief_note")
}
