/**
 * Word-level diffing for the publish review.
 *
 * Publish used to list the *names* of changed fields — "Health benefits",
 * "Sponsorship policy" — which is the wrong altitude for reviewing a
 * candidate-facing claim. You cannot approve a sentence you can't see, and the
 * most consequential edits in this product are one word inside a paragraph:
 * "may be considered" becoming "will be provided" changes a legal position and
 * looks identical at field-name resolution.
 *
 * Standard LCS over words. Field-sized text is at most a few hundred tokens, so
 * the O(n·m) table is irrelevant here and the result is exact rather than
 * heuristic.
 */

export type DiffSegment = {
  text: string
  kind: "same" | "added" | "removed"
}

/** Split into words *and* the spaces between them, so output reassembles cleanly. */
function tokenize(text: string): string[] {
  return text.match(/\s+|[^\s]+/g) ?? []
}

export function diffWords(before: string, after: string): DiffSegment[] {
  const a = tokenize(before)
  const b = tokenize(after)

  // table[i][j] = length of the longest common subsequence of a[i:] and b[j:]
  const table: number[][] = Array.from({ length: a.length + 1 }, () =>
    new Array<number>(b.length + 1).fill(0)
  )
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      table[i][j] =
        a[i] === b[j]
          ? table[i + 1][j + 1] + 1
          : Math.max(table[i + 1][j], table[i][j + 1])
    }
  }

  const out: DiffSegment[] = []
  const push = (kind: DiffSegment["kind"], text: string) => {
    const last = out.at(-1)
    if (last?.kind === kind) last.text += text
    else out.push({ kind, text })
  }

  let i = 0
  let j = 0
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      push("same", a[i])
      i++
      j++
    } else if (table[i + 1][j] >= table[i][j + 1]) {
      push("removed", a[i])
      i++
    } else {
      push("added", b[j])
      j++
    }
  }
  while (i < a.length) push("removed", a[i++])
  while (j < b.length) push("added", b[j++])

  return out
}

/**
 * How much of the text survived, 0–1.
 *
 * Below a threshold, an interleaved diff degenerates into "everything removed,
 * everything added" with the two texts shredded together — less readable than
 * simply showing the old and the new. The caller uses this to pick.
 */
export function similarity(segments: DiffSegment[]): number {
  const kept = segments
    .filter((s) => s.kind === "same")
    .reduce((n, s) => n + s.text.trim().length, 0)
  const total = segments.reduce((n, s) => n + s.text.trim().length, 0)
  return total === 0 ? 1 : kept / total
}

/** Added and removed entries for pill lists — locations, phrasings, goals. */
export function diffLists(
  before: string[],
  after: string[]
): { added: string[]; removed: string[]; kept: string[] } {
  const beforeSet = new Set(before)
  const afterSet = new Set(after)
  return {
    added: after.filter((v) => !beforeSet.has(v)),
    removed: before.filter((v) => !afterSet.has(v)),
    kept: after.filter((v) => beforeSet.has(v)),
  }
}
