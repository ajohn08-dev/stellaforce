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
  /** Overrides the agent's opening line. Requires
   * `overrides.…agent.first_message = true` in ElevenLabs, same as above. */
  firstMessage?: string
}

const DEFAULT_COMPANY = "Stella Force"

export const INTERVIEW_AGENT_CONFIGS: Record<string, InterviewAgentConfig> = {
  // CSM Onboarding Screen
  "40ed8d0c-5362-410a-aa65-9cdb46cae53b": {
    interviewName: "Customer Success Screen",
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

  // Data & Analytics Screen
  "8490ea4c-ad8f-4f25-a0f7-74ff7e50b737": {
    interviewName: "Data & Analytics Screen",
    agentDisplayName: "Priya",
    companyName: DEFAULT_COMPANY,
    questions: [
      "Walk me through your SQL experience — what's the most complex query or pipeline you've owned?",
      "Which tools do you reach for day to day: warehouse, BI, orchestration?",
      "Tell me about an analysis where the result changed a decision.",
      "How comfortable are you presenting findings to non-technical stakeholders?",
      "Are you prepared to complete a short take-home case study?",
    ],
    guidance:
      "Probe for depth on SQL specifically — self-reported fluency varies wildly. Ask one follow-up when an answer stays abstract.",
  },

  // Engineering First-Pass Screen
  "696a04bd-4ae4-432a-896f-c62a1a077ef4": {
    interviewName: "Engineering First-Pass Screen",
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

export function getInterviewAgentConfig(agentId: string): InterviewAgentConfig | null {
  return INTERVIEW_AGENT_CONFIGS[agentId] ?? null
}
