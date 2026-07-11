/**
 * Seed script — populates the demo database with realistic data.
 *
 * Run with:  pnpm seed   (which is: tsx --env-file=.env.local scripts/seed.ts)
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.local
 * and the migrations already applied. Uses the service-role key (bypasses RLS).
 *
 * ⚠️ Destructive: clears the demo tables before inserting so re-runs are clean.
 * This is DEMO data only. It does NOT touch auth users or storage.
 */
import { createClient } from "@supabase/supabase-js"

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Set them in .env.local."
  )
  process.exit(1)
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const EMBEDDING_DIM = 1536

/** Deterministic placeholder embedding (see src/lib/ai/embeddings.ts). */
function placeholderEmbedding(text: string): string {
  const vec = new Array<number>(EMBEDDING_DIM).fill(0)
  for (let i = 0; i < text.length; i++) {
    vec[(text.charCodeAt(i) * 31 + i) % EMBEDDING_DIM] += 1
  }
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1
  return `[${vec.map((v) => v / norm).join(",")}]`
}

type Tier = "gold" | "silver" | "bronze"
type Prof = "novice" | "beginner" | "intermediate" | "advanced" | "expert"

type SeedSkill = {
  name: string
  type: "hard" | "soft"
  level: Prof
  ai?: { tool_used: string; how_used: string; measurable_outcome: string }
}

type SeedCandidate = {
  full_name: string
  email: string
  location: string
  tz: string
  title: string
  company: string
  years: number
  tier: Tier
  summary: string
  languages: string[]
  skills: SeedSkill[]
}

const FIRST = [
  "Ava", "Liam", "Sofia", "Noah", "Mia", "Ethan", "Isabella", "Lucas",
  "Priya", "Marcus", "Elena", "Kai", "Zara", "Diego", "Nina", "Omar",
  "Grace", "Tobias", "Yuki", "Sam",
]
const LAST = [
  "Chen", "Patel", "Garcia", "Kim", "Okafor", "Nguyen", "Rossi", "Haddad",
  "Silva", "Johansson", "Ahmed", "Weber", "Costa", "Ivanov", "Tanaka",
  "Mbeki", "Larsen", "Reyes", "Novak", "Flores",
]

const TIERS: Tier[] = ["gold", "silver", "bronze"]
const LEVELS: Prof[] = ["intermediate", "advanced", "expert"]

const HARD_POOL = [
  "TypeScript", "React", "Next.js", "Node.js", "Python", "Go", "PostgreSQL",
  "AWS", "Kubernetes", "GraphQL", "Machine Learning", "Data Engineering",
  "Product Management", "Figma", "Terraform",
]
const SOFT_POOL = [
  "Communication", "Leadership", "Stakeholder Management", "Mentorship",
]
const AI_SIGNALS = [
  { tool_used: "Claude", how_used: "Refactored a legacy service with AI pair-programming", measurable_outcome: "Cut cycle time 40%" },
  { tool_used: "GitHub Copilot", how_used: "Scaffolded test suites", measurable_outcome: "Coverage 55%→85%" },
  { tool_used: "Cursor", how_used: "Automated schema migrations", measurable_outcome: "Shipped 3x faster" },
  { tool_used: "LangChain", how_used: "Built a RAG support bot", measurable_outcome: "Deflected 30% of tickets" },
]

function pick<T>(arr: T[], i: number): T {
  return arr[i % arr.length]
}

function buildCandidates(): SeedCandidate[] {
  const out: SeedCandidate[] = []
  for (let i = 0; i < 20; i++) {
    const first = FIRST[i]
    const last = LAST[i]
    const tier = TIERS[i % 3]
    const hardA = pick(HARD_POOL, i)
    const hardB = pick(HARD_POOL, i + 5)
    const soft = pick(SOFT_POOL, i)
    const skills: SeedSkill[] = [
      { name: hardA, type: "hard", level: pick(LEVELS, i) },
      { name: hardB, type: "hard", level: pick(LEVELS, i + 1) },
      { name: soft, type: "soft", level: pick(LEVELS, i + 2) },
    ]
    // Give ~60% of candidates a concrete AI-literacy signal on their top skill.
    if (i % 5 !== 0) {
      skills[0].ai = pick(AI_SIGNALS, i)
    }
    out.push({
      full_name: `${first} ${last}`,
      email: `${first.toLowerCase()}.${last.toLowerCase()}@example.com`,
      location: pick(
        ["Remote (US)", "New York, NY", "London, UK", "Berlin, DE", "Austin, TX", "Toronto, CA"],
        i
      ),
      tz: pick(["America/New_York", "Europe/London", "Europe/Berlin", "America/Chicago"], i),
      title: pick(
        ["Senior Software Engineer", "Staff Engineer", "Product Manager", "Data Scientist", "Engineering Manager", "Frontend Engineer"],
        i
      ),
      company: pick(
        ["Northwind", "Acme Labs", "Globex", "Initech", "Umbrella", "Hooli"],
        i
      ),
      years: 2 + (i % 12),
      tier,
      summary: `${tier === "gold" ? "Exceptional" : tier === "silver" ? "Strong" : "Developing"} ${pick(["engineer", "builder", "operator"], i)} with depth in ${hardA} and ${hardB}.`,
      languages: pick([["English"], ["English", "Spanish"], ["English", "German"], ["English", "Mandarin"]], i),
      skills,
    })
  }
  return out
}

async function clearTables() {
  // Order matters (children first) though FKs cascade.
  const tables = [
    "applications",
    "placements",
    "interactions",
    "candidate_client_fit",
    "skills",
    "job_orders",
    "candidates",
    "clients",
  ]
  for (const t of tables) {
    const { error } = await supabase.from(t).delete().neq("created_at", "1970-01-01")
    if (error) console.warn(`  clear ${t}: ${error.message}`)
  }
}

async function main() {
  console.log("Clearing existing demo data…")
  await clearTables()

  console.log("Inserting clients…")
  const { data: clients, error: clientErr } = await supabase
    .from("clients")
    .insert([
      { client_name: "Northwind Logistics", status: "active", notes: "Series C. Hiring platform + data roles." },
      { client_name: "Acme Fintech", status: "active", notes: "Regulated. Needs senior backend + compliance-savvy ICs." },
      { client_name: "Globex Media", status: "paused", notes: "Hiring paused pending budget review." },
    ])
    .select("client_id, client_name")
  if (clientErr || !clients) throw new Error(clientErr?.message)

  const northwind = clients.find((c) => c.client_name.startsWith("Northwind"))!
  const acme = clients.find((c) => c.client_name.startsWith("Acme"))!
  const globex = clients.find((c) => c.client_name.startsWith("Globex"))!

  console.log("Inserting job orders…")
  const { data: jobs, error: jobErr } = await supabase
    .from("job_orders")
    .insert([
      {
        client_id: northwind.client_id,
        title: "Senior Full-Stack Engineer",
        description: "Own the shipment-tracking product surface end to end.",
        required_skills: ["TypeScript", "React", "Next.js", "PostgreSQL"],
        salary_range: { min: 160000, max: 200000, currency: "$", period: "year" },
        status: "open",
      },
      {
        client_id: northwind.client_id,
        title: "Data Engineer",
        description: "Build the analytics + ML feature pipeline.",
        required_skills: ["Python", "Data Engineering", "AWS"],
        salary_range: { min: 150000, max: 185000, currency: "$", period: "year" },
        status: "open",
      },
      {
        client_id: acme.client_id,
        title: "Staff Backend Engineer",
        description: "Lead the ledger + payments core.",
        required_skills: ["Go", "PostgreSQL", "Kubernetes"],
        salary_range: { min: 190000, max: 240000, currency: "$", period: "year" },
        status: "on_hold",
      },
      {
        client_id: globex.client_id,
        title: "Product Manager, Growth",
        description: "Drive activation + retention experiments.",
        required_skills: ["Product Management", "Stakeholder Management"],
        salary_range: { min: 140000, max: 175000, currency: "$", period: "year" },
        status: "open",
      },
    ])
    .select("job_id, title")
  if (jobErr || !jobs) throw new Error(jobErr?.message)

  console.log("Inserting candidates + skills…")
  const seeds = buildCandidates()
  const candidateIds: string[] = []

  for (const s of seeds) {
    const embedding = placeholderEmbedding(
      [s.full_name, s.title, s.summary, s.skills.map((k) => k.name).join(", ")].join("\n")
    )
    const { data: cand, error: candErr } = await supabase
      .from("candidates")
      .insert({
        full_name: s.full_name,
        contact_info: { email: s.email, phone: "", location: s.location, tz: s.tz },
        current_title: s.title,
        current_company: s.company,
        years_experience: s.years,
        professional_summary: s.summary,
        languages: s.languages,
        candidate_tier: s.tier,
        tier_rationale: `Auto-assigned ${s.tier} for seed data.`,
        source: "seed",
        data_provenance: "recruiter_confirmed",
        freshness_score: Math.round((0.6 + Math.random() * 0.4) * 100) / 100,
        last_verified: new Date().toISOString(),
        embedding_vector: embedding,
      })
      .select("candidate_id")
      .single()
    if (candErr || !cand) throw new Error(candErr?.message)
    candidateIds.push(cand.candidate_id)

    const { error: skillErr } = await supabase.from("skills").insert(
      s.skills.map((k) => ({
        candidate_id: cand.candidate_id,
        skill_name: k.name,
        skill_type: k.type,
        proficiency_level: k.level,
        ai_literacy_signal: k.ai ?? { tool_used: "", how_used: "", measurable_outcome: "" },
      }))
    )
    if (skillErr) console.warn(`  skills for ${s.full_name}: ${skillErr.message}`)
  }

  console.log("Inserting applications…")
  const stages = ["sourced", "screened", "submitted", "interviewing", "offer"] as const
  const applications = candidateIds.slice(0, 8).map((cid, i) => {
    const job = jobs[i % jobs.length]
    // Determine the client for this job (first two jobs → northwind, etc.)
    const clientId =
      i % jobs.length < 2
        ? northwind.client_id
        : i % jobs.length === 2
          ? acme.client_id
          : globex.client_id
    return {
      candidate_id: cid,
      job_id: job.job_id,
      client_id: clientId,
      stage: stages[i % stages.length],
      status_reason: "Seed application",
      human_review_flag: i % 4 === 0,
    }
  })
  const { error: appErr } = await supabase.from("applications").insert(applications)
  if (appErr) console.warn(`  applications: ${appErr.message}`)

  console.log(
    `\n✅ Seeded ${clients.length} clients, ${jobs.length} job orders, ${candidateIds.length} candidates, ${applications.length} applications.`
  )
}

main().catch((err) => {
  console.error("Seed failed:", err.message)
  process.exit(1)
})
