import { createClient } from "@/lib/supabase/client"
import { publicEnv } from "@/lib/env"
import { RESUME_ACCEPTED_MIME_TYPES, RESUME_MAX_SIZE_BYTES } from "@/lib/constants"

/**
 * Client-side resume upload to the private `resumes` Storage bucket.
 *
 * Uses a raw XHR request instead of `supabase.storage.from(bucket).upload()`
 * because the storage-js client has no upload-progress hook. The request is
 * built to match exactly what `.upload()` sends under the hood — same
 * endpoint (`{SUPABASE_URL}/storage/v1/object/{bucket}/{path}`), same
 * headers (`apikey` + `Authorization: Bearer <session token>`), same
 * multipart body shape (`cacheControl` field + the file under an empty
 * field name) — verified against the installed storage-js source, not
 * guessed. If the SDK's `upload()` ever changes its wire format, this needs
 * updating too.
 */

export class ResumeValidationError extends Error {}
export class ResumeUploadError extends Error {}

/** Throws ResumeValidationError with a user-facing message if the file is unusable. */
export function validateResumeFile(file: File): void {
  const looksLikeAcceptedExtension = /\.(pdf|docx?|PDF|DOCX?)$/i.test(file.name)
  if (
    !RESUME_ACCEPTED_MIME_TYPES.includes(file.type) &&
    !looksLikeAcceptedExtension
  ) {
    throw new ResumeValidationError(
      "Only PDF, DOC, or DOCX files are accepted."
    )
  }
  if (file.size > RESUME_MAX_SIZE_BYTES) {
    throw new ResumeValidationError(
      `File is too large — max ${(RESUME_MAX_SIZE_BYTES / (1024 * 1024)).toFixed(0)}MB.`
    )
  }
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9.\-_]/g, "_")
}

/**
 * Uploads `file` to `{userId}/{timestamp}-{sanitizedFilename}` in the
 * `resumes` bucket, reporting progress via `onProgress` (0–100).
 */
export function uploadResumeWithProgress({
  file,
  userId,
  onProgress,
}: {
  file: File
  userId: string
  onProgress: (percent: number) => void
}): { promise: Promise<{ storagePath: string }>; abort: () => void } {
  const storagePath = `${userId}/${Date.now()}-${sanitizeFilename(file.name)}`
  const xhr = new XMLHttpRequest()

  const promise = new Promise<{ storagePath: string }>((resolve, reject) => {
    void (async () => {
      const supabase = createClient()
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session) {
        reject(
          new ResumeUploadError("Your session has expired. Sign in and try again.")
        )
        return
      }

      const url = `${publicEnv.supabaseUrl}/storage/v1/object/resumes/${storagePath}`
      const body = new FormData()
      body.append("cacheControl", "3600")
      body.append("", file)

      xhr.open("POST", url, true)
      xhr.setRequestHeader("apikey", publicEnv.supabaseAnonKey)
      xhr.setRequestHeader("Authorization", `Bearer ${session.access_token}`)
      xhr.setRequestHeader("x-upsert", "false")

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          onProgress(Math.round((e.loaded / e.total) * 100))
        }
      }

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve({ storagePath })
          return
        }
        let message = `Upload failed (status ${xhr.status}).`
        try {
          const parsed = JSON.parse(xhr.responseText) as { message?: string }
          if (parsed.message) message = parsed.message
        } catch {
          // Response wasn't JSON — keep the generic message.
        }
        reject(new ResumeUploadError(message))
      }

      xhr.onerror = () =>
        reject(
          new ResumeUploadError(
            "Network error during upload. Check your connection and try again."
          )
        )
      xhr.onabort = () => reject(new ResumeUploadError("Upload canceled."))

      xhr.send(body)
    })().catch(reject)
  })

  return { promise, abort: () => xhr.abort() }
}
