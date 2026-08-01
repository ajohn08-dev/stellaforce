import "server-only"

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto"

import { serverEnv } from "@/lib/env"

/**
 * AES-256-GCM at-rest encryption for Google OAuth refresh tokens. Ciphertext
 * is stored as `iv:authTag:data`, all base64 — one column, no separate IV/tag
 * columns to keep in sync.
 */

function key(): Buffer {
  const raw = serverEnv.calendarTokenEncryptionKey
  const buf = Buffer.from(raw, "base64")
  if (buf.length !== 32) {
    throw new Error(
      "CALENDAR_TOKEN_ENCRYPTION_KEY must decode (base64) to exactly 32 bytes. Generate with `openssl rand -base64 32`."
    )
  }
  return buf
}

export function encryptToken(plaintext: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", key(), iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
  const authTag = cipher.getAuthTag()
  return `${iv.toString("base64")}:${authTag.toString("base64")}:${encrypted.toString("base64")}`
}

export function decryptToken(ciphertext: string): string {
  const [ivB64, tagB64, dataB64] = ciphertext.split(":")
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error("Malformed encrypted token payload.")
  }
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(ivB64, "base64"))
  decipher.setAuthTag(Buffer.from(tagB64, "base64"))
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ])
  return decrypted.toString("utf8")
}
