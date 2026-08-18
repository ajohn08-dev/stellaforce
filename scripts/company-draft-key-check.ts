import { draftKey, parseDraftKey } from "@/lib/company-draft-keys"

// Every key the workspace can produce must resolve to a table + column.
const keys = [
  draftKey.company("preferredName"),
  draftKey.answer("q-reporting-line", "company", null),
  draftKey.answer("q-reporting-line", "team", "team-lg-channel"),
  draftKey.answer("q-reporting-line", "job", "job-lg-01"),
  draftKey.answer("q-reporting-line", "job", "job-lg-01", "expanded_answer"),
  draftKey.answerVisibility("q-reporting-line", "job", "job-lg-01") + "-clearance",
  draftKey.answerVisibility("q-reporting-line", "job", "job-lg-01") + "-agent-use",
  draftKey.askedClient("q-visa-sponsorship"),
  draftKey.extraVariants("q-visa-sponsorship"),
  draftKey.knowledge("ki-lg-01"),
  draftKey.knowledge("ki-lg-01") + "-clearance",
  draftKey.policy("pol-lg-03", "value"),
  draftKey.policy("pol-lg-03", "spoken"),
  draftKey.policyVisibility("pol-lg-03") + "-agent-use",
  draftKey.team("team-lg-gtm") + "-clearance",
  draftKey.fallback("withheld"),
]

let bad = 0
for (const k of keys) {
  const t = parseDraftKey(k)
  if (!t) { console.log(`  ✗ UNPARSEABLE  ${k}`); bad++; continue }
  console.log(`  ${k.padEnd(52)} → ${t.table}.${"column" in t ? t.column : "?"}`)
}
console.log(`\n${keys.length - bad}/${keys.length} keys resolve.`)
console.log("unknown key →", parseDraftKey("something-nobody-registered"))
if (bad) process.exit(1)
