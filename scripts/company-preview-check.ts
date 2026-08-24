import { getMockCompany } from "@/lib/mock-companies"
import { previewAsk, previewSuggestions } from "@/lib/company-preview"

const c = getMockCompany("lumagrid-security")!
const job = c.jobs[0]

console.log("Suggestions for", job.title, "→")
for (const s of previewSuggestions(c, job.id)) console.log("   ", s)

const asks = [
  "Who would I report to?",
  "What's the interview process like?",
  "Do you sponsor visas?",
  "Would you file a brand new H-1B petition for me?",
  "What's the salary for this role?",
  "How big is the company?",
  "Who else are you interviewing?",
]

for (const audience of ["candidate", "internal"] as const) {
  console.log(`\n===== ${audience} · on ${job.title}`)
  for (const q of asks) {
    const t = previewAsk(c, q, { jobId: job.id, audience }, "x")
    const src = t.resolved && t.reason === "answered" ? t.resolved.scope.badge : (t.fallback?.label ?? "")
    console.log(`\n  Q ${q}`)
    console.log(`  A ${t.says.slice(0, 92)}${t.says.length > 92 ? "…" : ""}`)
    console.log(`    [${t.reason}] ${src}${t.prohibitions.length ? ` · ${t.prohibitions.length} rules` : ""}`)
  }
}

console.log("\n===== same question, no role in play")
const t = previewAsk(c, "Who would I report to?", { jobId: null, audience: "candidate" }, "y")
console.log("  A", t.says.slice(0, 92))
console.log("   ", t.resolved?.scope.badge)

console.log("\n===== the audience toggle, on one question")
for (const audience of ["candidate", "internal"] as const) {
  const r = previewAsk(c, "What's the quota and how many people hit it?", { jobId: job.id, audience }, "z")
  console.log(`  ${audience.padEnd(10)} [${r.reason}] ${r.says.slice(0, 80)}…`)
}
