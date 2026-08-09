/**
 * Attaches playable audio to the QA fixture evaluations' call recordings.
 *
 * Run with:  npm run attach-fixture-audio
 *            (tsx --env-file=.env.local scripts/attach-fixture-call-audio.ts)
 *
 * `20260808140100_seed_evaluation_qa_and_transcripts` creates one
 * `call_recordings` row per fixture evaluation with a transcript but
 * `audio_status = 'pending'` — SQL can't put bytes in Storage. This copies one
 * real recording (from an earlier ElevenLabs test call) into a per-evaluation
 * object path so the evaluation panel's player actually plays something, then
 * flips the row to `audio_status = 'uploaded'`.
 *
 * The clip is a stand-in: it is the same short screening call for every
 * evaluation and does not match the seeded transcript. `duration_seconds` is
 * set from the clip so the metadata and the player agree.
 *
 * ⚠️ Fixtures only — every row it touches belongs to a candidate with
 * `source = 'qa_test_fixture'`, and the objects are removed with them. Safe to
 * re-run: existing fixture audio objects are replaced.
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

const BUCKET = "call-recordings"

async function main() {
  // Source clip: the longest real test-call recording already in the bucket.
  const { data: sources, error: sourceError } = await supabase
    .from("call_recordings")
    .select("storage_path, mime_type, duration_seconds, file_size")
    .eq("is_test", true)
    .eq("audio_status", "uploaded")
    .not("storage_path", "is", null)
    .order("duration_seconds", { ascending: false })
    .limit(1)
  if (sourceError) throw sourceError

  const source = sources?.[0]
  if (!source?.storage_path) {
    console.error(
      "No uploaded test-call recording to copy from — run a test call first, " +
        "or upload any allowed audio file to the call-recordings bucket."
    )
    process.exit(1)
  }

  const clip = await supabase.storage.from(BUCKET).download(source.storage_path)
  if (clip.error) throw clip.error
  const bytes = new Uint8Array(await clip.data.arrayBuffer())
  const mimeType = source.mime_type ?? "audio/mpeg"
  const extension = source.storage_path.split(".").pop() ?? "mp3"
  console.log(
    `Source clip: ${source.storage_path} (${bytes.byteLength} bytes, ${source.duration_seconds}s)`
  )

  // Fixture recordings still missing audio.
  const { data: recordings, error: recordingsError } = await supabase
    .from("call_recordings")
    .select(
      "id, application_id, interviewer_type, evaluation_id, applications!inner(candidates!inner(source))"
    )
    .eq("applications.candidates.source", "qa_test_fixture")
  if (recordingsError) throw recordingsError
  if (!recordings?.length) {
    console.log("No fixture call recordings found — nothing to attach.")
    return
  }

  let attached = 0
  for (const recording of recordings) {
    // Mirrors the bucket's documented shape:
    // applications/{application_id}/{interviewer_type}/{file}
    const path = `applications/${recording.application_id}/${recording.interviewer_type}/fixture-${recording.evaluation_id}.${extension}`

    const upload = await supabase.storage
      .from(BUCKET)
      .upload(path, bytes, { contentType: mimeType, upsert: true })
    if (upload.error) {
      console.error(`  ✗ ${path}: ${upload.error.message}`)
      continue
    }

    const { error: updateError } = await supabase
      .from("call_recordings")
      .update({
        storage_path: path,
        filename: path.split("/").pop(),
        mime_type: mimeType,
        file_size: bytes.byteLength,
        duration_seconds: source.duration_seconds,
        audio_status: "uploaded",
      })
      .eq("id", recording.id)
    if (updateError) {
      console.error(`  ✗ ${recording.id}: ${updateError.message}`)
      continue
    }
    attached += 1
  }

  console.log(`Attached audio to ${attached}/${recordings.length} fixture recordings.`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
