import { diffWords, similarity, diffLists } from "@/lib/text-diff"

const render = (b: string, a: string) => {
  const segs = diffWords(b, a)
  const sim = similarity(segs)
  const inline = segs
    .map((s) => (s.kind === "same" ? s.text : s.kind === "added" ? `[+${s.text}]` : `[-${s.text}]`))
    .join("")
  console.log(`\n  similarity ${(sim * 100).toFixed(0)}%  → ${sim < 0.3 ? "was/now blocks" : "inline"}`)
  console.log(`  ${inline}`)
}

console.log("— the one-word legal change —")
render(
  "For this role, an H-1B transfer may be considered for candidates already authorized to work in the United States, subject to legal review.",
  "For this role, an H-1B transfer will be provided for candidates already authorized to work in the United States, subject to legal review."
)

console.log("\n— a small tightening —")
render("LumaGrid has between 150 and 200 employees.", "LumaGrid has around 180 employees.")

console.log("\n— a wholesale rewrite —")
render(
  "Customer-focused, high-ownership, and practical. Decisions get made close to the customer.",
  "We move fast and expect people to bring recommendations, not status updates."
)

console.log("\n— a list —")
console.log(" ", diffLists(["Austin, TX", "Remote — US regional"], ["Austin, TX", "Boston, MA"]))
