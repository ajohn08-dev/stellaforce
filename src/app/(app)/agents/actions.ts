"use server"

import { randomUUID } from "crypto"

import { getCurrentProfile } from "@/lib/auth"
import { serverEnv } from "@/lib/env"

type TriggerAgentTestCallResult = { ok: true } | { ok: false; error: string }

// E.164: leading +, country code 1-9, up to 15 digits total.
const E164_RE = /^\+[1-9]\d{7,14}$/

/**
 * Screening-agent "test run" — places a one-off outbound call to a phone
 * number the recruiter supplies, using a dummy candidate identity (this is a
 * test of the agent's voice script, not a real screen). Fires the n8n
 * webhook that actually places the call; no local persistence, since there's
 * no `screening_agents`/`campaigns` table yet (see src/lib/mock-agents.ts).
 */
export async function triggerAgentTestCall(
  agentName: string,
  toNumber: string
): Promise<TriggerAgentTestCallResult> {
  const profile = await getCurrentProfile()
  if (!profile) {
    return { ok: false, error: "You must be signed in to run a test call." }
  }

  if (!E164_RE.test(toNumber)) {
    return { ok: false, error: "Enter a valid phone number, e.g. +12065551234." }
  }

  const candidateId = randomUUID()
  const jobId = randomUUID()
  const campaignId = randomUUID()

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15_000)
  try {
    const response = await fetch(serverEnv.n8nVoiceTestCallWebhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serverEnv.n8nWebhookSecret}`,
      },
      body: JSON.stringify({
        to_number: toNumber,
        candidate_id: candidateId,
        candidate_name: "Jane Doe",
        job_id: jobId,
        job_title: "Test Screening Call",
        agent_name: agentName,
        campaign_id: campaignId,
        idempotency_key: `${campaignId}:${candidateId}:attempt_1`,
      }),
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout))
    if (!response.ok) {
      const body = await response.text()
      return {
        ok: false,
        error: `Test call failed (n8n returned ${response.status}). ${body.slice(0, 200)}`,
      }
    }
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error
          ? `Could not reach the calling service: ${err.message}`
          : "Could not reach the calling service.",
    }
  }

  return { ok: true }
}
