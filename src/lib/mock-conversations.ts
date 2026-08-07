/**
 * UI-preview data only — the Agent Conversations page renders entirely from
 * this array, there is no `conversations`/`interview_transcripts` table yet
 * (see CLAUDE.md build order; n8n.md marks interview_transcripts ⛔ blocked).
 * `agent_name` values match a few entries in MOCK_SCREENING_AGENTS for
 * continuity.
 */

export type ConversationTranscriptTurn = {
  speaker: "agent" | "candidate"
  text: string
}

export type MockConversation = {
  conversation_id: string
  agent_name: string
  candidate_name: string
  started_at: string // "YYYY-MM-DD", see formatDate in lib/constants
  duration_seconds: number
  is_test_call: boolean
  transcript: ConversationTranscriptTurn[]
}

export const MOCK_CONVERSATIONS: MockConversation[] = [
  {
    conversation_id: "conv-01",
    agent_name: "Engineering First-Pass Screen",
    candidate_name: "Priya Natarajan",
    started_at: "2026-07-22",
    duration_seconds: 271,
    is_test_call: false,
    transcript: [
      { speaker: "agent", text: "Hi Priya, thanks for taking the time. Do you have about 5 minutes for a quick screen for the Senior Backend Engineer role?" },
      { speaker: "candidate", text: "Yes, sounds good." },
      { speaker: "agent", text: "Great. Can you walk me through your experience with distributed systems?" },
      { speaker: "candidate", text: "I spent the last three years building the payments pipeline at my current company, mostly in Go, handling around 10k transactions a second." },
      { speaker: "agent", text: "That's helpful. And how many years of professional experience do you have overall?" },
      { speaker: "candidate", text: "About seven years total." },
      { speaker: "agent", text: "Thanks, Priya — a recruiter will follow up within two business days." },
    ],
  },
  {
    conversation_id: "conv-02",
    agent_name: "Sales AE Qualifier",
    candidate_name: "Marcus Webb",
    started_at: "2026-07-23",
    duration_seconds: 198,
    is_test_call: false,
    transcript: [
      { speaker: "agent", text: "Hi Marcus, this is a quick pre-screen for the Account Executive role at Acme Fintech. Are you currently quota-carrying?" },
      { speaker: "candidate", text: "Yes, I've carried a $1.2M annual quota for the last two years." },
      { speaker: "agent", text: "And what territory or vertical have you been focused on?" },
      { speaker: "candidate", text: "Mid-market fintech, mostly in the Northeast." },
      { speaker: "agent", text: "Perfect, that lines up well. Someone from the team will reach out to schedule the next round." },
    ],
  },
  {
    conversation_id: "conv-03",
    agent_name: "Generalist Recruiter Screen",
    candidate_name: "Devon Ashworth",
    started_at: "2026-07-20",
    duration_seconds: 143,
    is_test_call: false,
    transcript: [
      { speaker: "agent", text: "Hi Devon, quick baseline check — are you open to relocating for this role, or would you need it to be remote?" },
      { speaker: "candidate", text: "Remote only, I'm not able to relocate right now." },
      { speaker: "agent", text: "Understood. And what's your expected compensation range?" },
      { speaker: "candidate", text: "Somewhere between $140k and $160k base." },
      { speaker: "agent", text: "Got it, thanks for confirming." },
    ],
  },
  {
    conversation_id: "conv-04",
    agent_name: "Data & Analytics Screen",
    candidate_name: "Lena Ortiz",
    started_at: "2026-07-25",
    duration_seconds: 312,
    is_test_call: false,
    transcript: [
      { speaker: "agent", text: "Hi Lena, this screen covers a few SQL and case-study readiness questions for the Data Engineer role. Ready to start?" },
      { speaker: "candidate", text: "Yep, go ahead." },
      { speaker: "agent", text: "How would you approach deduplicating rows in a table with no unique key?" },
      { speaker: "candidate", text: "I'd typically use a window function like ROW_NUMBER partitioned over the columns that should be unique, then filter to row number one." },
      { speaker: "agent", text: "Good. Have you worked with dbt or a similar transformation layer?" },
      { speaker: "candidate", text: "Yes, about two years with dbt on top of Snowflake." },
    ],
  },
  {
    conversation_id: "conv-05",
    agent_name: "Engineering First-Pass Screen",
    candidate_name: "Jane Doe",
    started_at: "2026-08-01",
    duration_seconds: 42,
    is_test_call: true,
    transcript: [
      { speaker: "agent", text: "This is a test call for the Engineering First-Pass Screen agent." },
      { speaker: "candidate", text: "Test response — checking audio quality and pacing." },
      { speaker: "agent", text: "Test call complete." },
    ],
  },
  {
    conversation_id: "conv-06",
    agent_name: "CSM Onboarding Screen",
    candidate_name: "Harold Kim",
    started_at: "2026-07-15",
    duration_seconds: 118,
    is_test_call: false,
    transcript: [
      { speaker: "agent", text: "Hi Harold, quick availability check — when could you start if offered the role?" },
      { speaker: "candidate", text: "I'd need to give two weeks' notice, so about three weeks out." },
      { speaker: "agent", text: "That works. Do you have direct customer-facing experience in a CSM or account management role?" },
      { speaker: "candidate", text: "Yes, four years as a CSM at a healthcare SaaS company." },
    ],
  },
  {
    conversation_id: "conv-07",
    agent_name: "Sales AE Qualifier",
    candidate_name: "Isabelle Fournier",
    started_at: "2026-07-28",
    duration_seconds: 205,
    is_test_call: false,
    transcript: [
      { speaker: "agent", text: "Hi Isabelle, are you currently quota-carrying, and if so what's your attainment been like?" },
      { speaker: "candidate", text: "I'm at 118% of quota this year, 104% last year." },
      { speaker: "agent", text: "Strong numbers. What's your average deal size?" },
      { speaker: "candidate", text: "Around $45k ACV." },
      { speaker: "agent", text: "Great, thanks Isabelle — next steps will come from a recruiter shortly." },
    ],
  },
  {
    conversation_id: "conv-08",
    agent_name: "Generalist Recruiter Screen",
    candidate_name: "Tomas Reyes",
    started_at: "2026-07-18",
    duration_seconds: 97,
    is_test_call: false,
    transcript: [
      { speaker: "agent", text: "Hi Tomas, are you currently employed, and if so what's your notice period?" },
      { speaker: "candidate", text: "Yes, currently employed — two weeks' notice." },
      { speaker: "agent", text: "Understood, thanks for confirming." },
    ],
  },
  {
    conversation_id: "conv-09",
    agent_name: "Data & Analytics Screen",
    candidate_name: "Jane Doe",
    started_at: "2026-07-30",
    duration_seconds: 35,
    is_test_call: true,
    transcript: [
      { speaker: "agent", text: "This is a test call for the Data & Analytics Screen agent." },
      { speaker: "candidate", text: "Test response — confirming call routing works end to end." },
    ],
  },
  {
    conversation_id: "conv-10",
    agent_name: "Executive Search Pre-Screen",
    candidate_name: "Grace Whitfield",
    started_at: "2026-07-10",
    duration_seconds: 486,
    is_test_call: false,
    transcript: [
      { speaker: "agent", text: "Hi Grace, thanks for making time. Can you tell me about the scope of your current VP role?" },
      { speaker: "candidate", text: "I lead a 40-person org spanning engineering and product for our core platform." },
      { speaker: "agent", text: "And what's driving your interest in a move right now?" },
      { speaker: "candidate", text: "I'm looking for a bigger scope, ideally with P&L ownership." },
      { speaker: "agent", text: "That's helpful context. What comp range are you targeting?" },
      { speaker: "candidate", text: "Base around $280k, with a meaningful equity component." },
    ],
  },
  {
    conversation_id: "conv-11",
    agent_name: "Engineering First-Pass Screen",
    candidate_name: "Wei Zhang",
    started_at: "2026-08-02",
    duration_seconds: 264,
    is_test_call: false,
    transcript: [
      { speaker: "agent", text: "Hi Wei, quick screen for the Senior Backend Engineer role. How many years of experience do you have with Go or a similar systems language?" },
      { speaker: "candidate", text: "About five years with Go specifically, eight years total in backend engineering." },
      { speaker: "agent", text: "Great. Have you worked on any high-throughput or low-latency systems?" },
      { speaker: "candidate", text: "Yes, I built a real-time bidding service handling sub-10ms response times." },
    ],
  },
  {
    conversation_id: "conv-12",
    agent_name: "CSM Onboarding Screen",
    candidate_name: "Renee Castillo",
    started_at: "2026-07-05",
    duration_seconds: 88,
    is_test_call: false,
    transcript: [
      { speaker: "agent", text: "Hi Renee, quick availability check — what's your notice period?" },
      { speaker: "candidate", text: "I'm available immediately, I'm between roles right now." },
      { speaker: "agent", text: "Got it, thanks Renee." },
    ],
  },
]
