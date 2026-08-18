/**
 * Per-agent interview content — the prompt, the questions, and the identity the
 * agent presents with — passed to ElevenLabs at session start.
 *
 * **This is a temporary fixture.** It exists so interview content can be
 * authored and iterated in code before there is any UI for it. The eventual home
 * is the database: `job_competencies` and the job's scorecard already model
 * competencies and questions, and `job_workflow_sub_stages` already knows which
 * agent runs a stage. When that wiring lands, this file becomes the fallback for
 * agents with no job attached (which is exactly what an Agents-page test run
 * is), and everything else resolves per-application.
 *
 * Keyed by `agents.id` (our UUID), not `external_agent_id` — the ElevenLabs id
 * is null on most rows and can be re-pointed, whereas ours is stable.
 *
 * ── Two delivery mechanisms, and they are not equivalent ──
 *
 * 1. **Dynamic variables** (always sent). ElevenLabs substitutes `{{var}}`
 *    placeholders that already appear in the agent's own prompt. Safe, but it
 *    does nothing unless the prompt in ElevenLabs actually references them.
 *
 * 2. **Prompt override** (sent only when `allowPromptOverride` is true). Replaces
 *    the agent's prompt wholesale, so content lives entirely here. This requires
 *    `overrides.conversation_config_override.agent.prompt.prompt = true` on the
 *    ElevenLabs agent — it is **false by default on every agent**, and sending an
 *    override the agent hasn't permitted causes ElevenLabs to reject the
 *    session. Hence the per-agent opt-in flag rather than a global switch.
 */

import type { CompiledAgentContext } from "@/lib/company-agent-context"

export type InterviewAgentConfig = {
  /** What this interview is called, e.g. "Customer Success Screen". Sent as
   * `{{interview_name}}`. */
  interviewName: string
  /** The name the agent introduces itself with — a person's name, not the
   * agent row's internal label. Sent as `{{agent_display_name}}`. */
  agentDisplayName: string
  /** The employer the agent is calling on behalf of. Sent as
   * `{{company_name}}`. */
  companyName: string
  /** Asked in order. Sent both as a numbered `{{questions}}` block and as
   * `{{question_count}}`, so a prompt can reference either. */
  questions: string[]
  /** Free-form guidance appended to the generated prompt — tone, disqualifiers,
   * anything role-specific that isn't a question. */
  guidance?: string
  /** Opt in **only** once prompt overrides are enabled for this agent in
   * ElevenLabs. See the note above; leaving it false is the safe default. */
  allowPromptOverride?: boolean
  /** Overrides the agent's opening line. Normally leave unset: the ElevenLabs
   * agent's own first message is templated with the dynamic variables this
   * config supplies, so it already varies per interview. Set this only to
   * depart from that greeting entirely. */
  firstMessage?: string
}

const DEFAULT_COMPANY = "Stellaforce"

export const INTERVIEW_AGENT_CONFIGS: Record<string, InterviewAgentConfig> = {
  // CSM Onboarding Screen
  "40ed8d0c-5362-410a-aa65-9cdb46cae53b": {
    interviewName: "Customer Success Screen",
    allowPromptOverride: true,
    agentDisplayName: "Neha",
    companyName: DEFAULT_COMPANY,
    questions: [
      "Tell me briefly about your customer-facing experience — what kinds of accounts have you owned?",
      "What is your availability to start a new role, if selected?",
      "Are you comfortable with the working hours and location for this role?",
      "Describe a time you turned around an unhappy customer. What did you actually do?",
    ],
    guidance:
      "Keep it light and conversational — this is a first touch, not a deep evaluation. If the candidate is clearly unavailable or not customer-facing, close politely rather than working through every question.",
  },

  // Who Interview (repurposed from the seeded "Data & Analytics Screen" — see
  // the repurpose_data_agent_as_who_interview migration, which renames the row
  // the UI actually renders)
  "8490ea4c-ad8f-4f25-a0f7-74ff7e50b737": {
    interviewName: "Who Interview",
    allowPromptOverride: true,
    agentDisplayName: "Priya",
    companyName: "Nehaes",
    questions: [
      "Walk me through your career decisions and the experiences that best prepared you for this role.",
      "Why this role and company now, and what would make it a meaningful next step for you?",
      "Tell me about the accomplishment most relevant to this job. What was the situation, your specific role, the actions you took, and the measurable outcome?",
      "Describe the hardest goal you have achieved. What obstacles did you face, and how did you overcome them?",
      "Tell me about a complex or ambiguous problem you solved. How did you diagnose it, decide what to do, and measure whether your solution worked?",
      "Describe a time your initial approach failed or new information changed your plan. What did you do differently, and what did you learn?",
      "Tell me about a difficult stakeholder or team relationship. How did you build alignment or resolve the conflict?",
      "What is the most useful critical feedback you have received, and what concrete change did you make because of it?",
      "Here is a realistic problem you would face in this role. What questions would you ask first, what would your plan be, and what result would you aim to achieve?",
      "If hired, what would you aim to accomplish in your first 90 days, what support would you need, and what questions or concerns do you have about the role?",
    ],
    guidance: [
      "This is a structured Who-style interview: a deep, evidence-gathering conversation, not a quick screen. Your job is to collect specific, verifiable detail — not to sell the role, coach the candidate, or evaluate them aloud.",
      "For every answer, drive to four things: the situation, what THIS candidate personally did, the actions they took, and the measurable outcome. When someone says 'we', ask what their own part was. When you hear an adjective ('significant', 'successful', 'a lot'), ask for the number.",
      "Ask at most two follow-ups per question, then move on. Good follow-ups are short and neutral: 'What was your role specifically?', 'What was the result?', 'How did you know it worked?', 'What would you do differently?'. Never suggest an answer or finish their sentence.",
      "Stay warm but neutral. Do not praise answers, agree with judgements, or signal whether something was the right call — that biases everything after it. A brief acknowledgement and the next question is enough.",
      "For question 9, if the candidate asks what the problem is, give them one concrete, plausible scenario from this role and let them work it. Do not grade their answer; capture their reasoning.",
      "Ten questions is a lot of ground. Keep your own turns short, do not recap what they just said, and if time is running long, prioritise questions 3, 5, 6, and 10 — accomplishment, problem-solving, adaptability, and the first 90 days.",
      "Close by thanking them, telling them the team will follow up, and asking if they have questions about the process.",
    ].join(" "),
  },

  // Engineering First-Pass Screen
  "696a04bd-4ae4-432a-896f-c62a1a077ef4": {
    interviewName: "Engineering First-Pass Screen",
    allowPromptOverride: true,
    agentDisplayName: "Sam",
    companyName: DEFAULT_COMPANY,
    questions: [
      "How many years have you been writing production code, and in which languages?",
      "Describe the architecture of something you've built end to end.",
      "How do you approach testing and code review on your current team?",
      "What's a technical decision you got wrong, and what did you change afterwards?",
    ],
    guidance:
      "Focus on fundamentals and ownership rather than trivia. Do not ask puzzle questions.",
  },

  // Executive Search Pre-Screen
  "749af294-97c7-4ead-b1c7-ff40bfa458f3": {
    interviewName: "Executive Pre-Screen",
    allowPromptOverride: true,
    agentDisplayName: "Alexandra",
    companyName: DEFAULT_COMPANY,
    questions: [
      "What's the scope of the organisation you run today — headcount, budget, remit?",
      "What's motivating you to look externally right now?",
      "What are your compensation expectations, including equity?",
      "Which parts of this mandate would you want to reshape in your first year?",
    ],
    guidance:
      "Senior audience — be concise and deferential. Ask compensation once, plainly, and move on without pressing.",
  },

  // Generalist Recruiter Screen
  "ad106fe1-3bb7-498a-bc98-a699d7870b20": {
    interviewName: "Recruiter Screen",
    allowPromptOverride: true,
    agentDisplayName: "Jordan",
    companyName: DEFAULT_COMPANY,
    questions: [
      "What are you looking for in your next role?",
      "What's your current notice period and availability to start?",
      "What are your salary expectations for this role?",
      "Are you able to work from the role's location, and are you authorised to work there?",
    ],
    guidance:
      "Baseline screen reused across roles — stay neutral about the specific job and gather the logistics cleanly.",
  },

  // Sales AE Qualifier
  "a568d985-c551-4d56-91a2-3cf0033fc51b": {
    interviewName: "Account Executive Qualifier",
    allowPromptOverride: true,
    agentDisplayName: "Marcus",
    companyName: DEFAULT_COMPANY,
    questions: [
      "What quota have you carried, and what was your attainment over the last two years?",
      "What deal sizes and sales cycles are you used to?",
      "Which territories or segments have you sold into?",
      "Walk me through how you'd open a cold account from scratch.",
    ],
    guidance:
      "Get specific numbers for quota and attainment — vague answers here are the signal worth capturing.",
  },
}

/** Numbered list, so a prompt can drop `{{questions}}` in and get readable
 * structure rather than a comma-splice. */
export function formatQuestions(questions: string[]): string {
  return questions.map((q, i) => `${i + 1}. ${q}`).join("\n")
}

/**
 * The prompt sent when `allowPromptOverride` is on. Deliberately assembled here
 * rather than stored as one blob per agent: the questions stay a real array (so
 * they can also be sent as a variable, and later be read from the database),
 * and every agent gets the same interviewer scaffolding around them.
 */
export function buildInterviewPrompt(
  config: InterviewAgentConfig,
  candidateName: string
): string {
  return [
    `You are ${config.agentDisplayName}, a recruiter at ${config.companyName} conducting the "${config.interviewName}".`,
    `You are speaking with ${candidateName}.`,
    "",
    "Work through the questions below in order, one at a time. Ask a brief follow-up when an answer is vague, then move on. Do not read the list aloud, do not number the questions, and do not ask more than one question at a time.",
    "",
    "Questions:",
    formatQuestions(config.questions),
    "",
    config.guidance ? `Guidance: ${config.guidance}` : "",
    "",
    "When the questions are covered, thank the candidate, tell them the team will follow up, and end the conversation.",
  ]
    .filter(Boolean)
    .join("\n")
}

/**
 * The fixture lookup.
 *
 * ⚠️ **Wiring point for company knowledge.** Once company profiles are
 * persisted, a call carrying a job resolves through
 * `interviewConfigFromContext(compileAgentContext(company, job, "candidate"), …)`
 * and this fixture stays only for Agents-page test runs, which have no job and
 * therefore no company to compile from.
 */
export function getInterviewAgentConfig(agentId: string): InterviewAgentConfig | null {
  return INTERVIEW_AGENT_CONFIGS[agentId] ?? null
}

// ---------------------------------------------------------------------------
// The seam: company knowledge → the agent that actually speaks
// ---------------------------------------------------------------------------

/**
 * Build an agent's content **from the compiled company bundle** rather than from
 * the hand-written fixture above.
 *
 * This is the join that was missing. `compileAgentContext()` decides what an
 * agent may say — clearance, the company → team → job cascade, accumulated
 * prohibitions — and until now its output went nowhere except a preview panel,
 * while the agent that actually dialled a candidate read a fixture where
 * `companyName` was the literal string "Stellaforce". The knowledge base had no
 * effect on a single real conversation.
 *
 * What the bundle supplies: the company's real name, the answers the agent is
 * cleared to give, the topics it must hand back, and the sentences it must never
 * say. What it does **not** supply is the interview's own questions — those come
 * from `job_competencies` and the job's scorecard, which is a different domain
 * and a different pass.
 *
 * ⚠️ **Not wired to a live agent yet, deliberately.** Calling this needs a
 * `Company` for the job being screened, and company profiles are still UI-only
 * mock data (`src/lib/mock-companies.ts`) with no key shared with `job_orders`.
 * The call sites are marked below; they start resolving the moment the company
 * profile is persisted and `CompanyJob.id` becomes `job_orders.job_id`.
 */
export function interviewConfigFromContext(
  context: CompiledAgentContext,
  base: {
    interviewName: string
    agentDisplayName: string
    /** The interview's own questions — from the job's competencies, not from here. */
    questions: string[]
    allowPromptOverride?: boolean
  }
): InterviewAgentConfig {
  if (context.audience !== "candidate") {
    // A screening call is a candidate conversation by definition. Compiling an
    // internal bundle into one would hand a candidate the recruiter brief, so
    // this is a hard stop rather than a silent filter.
    throw new Error(
      "interviewConfigFromContext requires a candidate-facing bundle; got an internal one."
    )
  }

  const guidance = [
    context.answers.length > 0 &&
      `Answer these if the candidate asks, and only these:\n${context.answers
        .map((a) => `- ${a.question} → ${a.answer}`)
        .join("\n")}`,
    context.escalations.length > 0 &&
      `Hand these topics to the recruiter instead of answering: ${context.escalations
        .map((e) => e.topic)
        .join("; ")}.`,
    context.prohibitedClaims.length > 0 &&
      `Never say any of the following, however the question is phrased:\n${context.prohibitedClaims
        .map((c) => `- ${c}`)
        .join("\n")}`,
    // The prohibitions above say what never to say; without these the agent is
    // improvising at exactly the moment it must not. Paired deliberately.
    `When you can't answer, use the wording below that fits the reason. Do not invent a different one.\n${context.fallbacks
      .map((f) => `- ${f.label} — ${f.when}\n  Say: "${f.text}"`)
      .join("\n")}`,
  ]
    .filter(Boolean)
    .join("\n\n")

  return {
    interviewName: base.interviewName,
    agentDisplayName: base.agentDisplayName,
    companyName: context.companyName,
    questions: base.questions,
    guidance,
    allowPromptOverride: base.allowPromptOverride ?? false,
  }
}
