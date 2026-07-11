import "server-only"

import { EMBEDDING_DIM } from "@/lib/constants"

/**
 * Embedding generation — SERVER ONLY.
 *
 * ⚠️ IMPORTANT: Anthropic (Claude) does NOT provide a text-embeddings endpoint.
 * The Claude API is used for parsing/reasoning only. To generate real
 * embeddings for `candidates.embedding_vector` (vector(1536)), wire a dedicated
 * embeddings provider here. Anthropic officially recommends Voyage AI.
 *
 * Provider options that produce 1536-dim vectors out of the box:
 *   - OpenAI `text-embedding-3-small` (1536 dims) — simplest drop-in
 *   - Voyage AI `voyage-3` (1024) / configurable — Anthropic's recommendation
 *     (would require changing EMBEDDING_DIM + the vector() column dimension)
 *
 * Until a provider is configured, this returns a DETERMINISTIC PLACEHOLDER
 * vector so the ingestion + add-candidate write paths work end-to-end in the
 * demo. Placeholder vectors are NOT semantically meaningful — semantic search
 * will not return useful results until a real provider is wired.
 *
 * TODO(embeddings): replace `placeholderEmbedding` with a real provider call.
 */

/** Cheap, deterministic pseudo-embedding derived from the input text. */
function placeholderEmbedding(text: string): number[] {
  const vec = new Array<number>(EMBEDDING_DIM).fill(0)
  // Simple bag-of-chars hashing so identical text yields identical vectors and
  // similar text yields somewhat-similar vectors. Purely a stand-in.
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i)
    vec[(code * 31 + i) % EMBEDDING_DIM] += 1
  }
  // L2-normalize (cosine-friendly).
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1
  return vec.map((v) => v / norm)
}

/**
 * Generate an embedding for the given text. Returns a 1536-dim vector.
 * Swap the body for a real provider call when ready (see file header).
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  // --- Real provider example (OpenAI), left commented until keys are added ---
  // const res = await fetch("https://api.openai.com/v1/embeddings", {
  //   method: "POST",
  //   headers: {
  //     "Content-Type": "application/json",
  //     Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
  //   },
  //   body: JSON.stringify({ model: "text-embedding-3-small", input: text }),
  // })
  // const json = await res.json()
  // return json.data[0].embedding as number[]

  return placeholderEmbedding(text)
}

/** Serialize a JS number[] into the pgvector text format: `[0.1,0.2,...]`. */
export function toPgVector(embedding: number[]): string {
  return `[${embedding.join(",")}]`
}

/** Build the text we embed for a candidate (summary + title + skills). */
export function candidateEmbeddingText(input: {
  full_name?: string | null
  current_title?: string | null
  professional_summary?: string | null
  skills?: string[]
}): string {
  return [
    input.full_name,
    input.current_title,
    input.professional_summary,
    (input.skills ?? []).join(", "),
  ]
    .filter(Boolean)
    .join("\n")
}
