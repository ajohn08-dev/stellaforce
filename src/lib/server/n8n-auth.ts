import "server-only"

import { timingSafeEqual } from "node:crypto"

import type { NextRequest } from "next/server"

import { serverEnv } from "@/lib/env"

/** Shared constant-time bearer-token check for n8n → app callback routes. */
export function isN8nAuthorized(req: NextRequest): boolean {
  const header = req.headers.get("authorization") ?? ""
  const expected = `Bearer ${serverEnv.n8nWebhookSecret}`
  const a = Buffer.from(header)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}
