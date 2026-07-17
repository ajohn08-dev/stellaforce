import type { InteractionType } from "@/lib/supabase/types"

/**
 * UI-preview data only — nothing queries the real `interactions` table for
 * this page yet. Typed against the real InteractionType enum so swapping
 * this for a real query later is a drop-in change.
 */
export type ActivityEntry = {
  type: InteractionType
  body: string
  at: string // ISO datetime
  author: string
}

export const MOCK_ACTIVITY: Record<string, ActivityEntry[]> = {
  // Khanh Le
  "6bb5e7b2-0014-41e2-a54d-96bf1e048a97": [
    {
      type: "note",
      body: "Sourced via LinkedIn — strong Python background, good match for the Data Platform team.",
      at: "2026-06-02T10:00:00Z",
      author: "Anna John",
    },
    {
      type: "call",
      body: "30-minute screening call. Confirmed interest in a senior IC track.",
      at: "2026-06-05T15:30:00Z",
      author: "Anna John",
    },
    {
      type: "email",
      body: "Sent the take-home exercise for the Data Platform role.",
      at: "2026-06-06T09:15:00Z",
      author: "Anna John",
    },
  ],
  // Maria Rodriguez
  "ce0f7133-fdf4-48e9-aaaf-021efc72e0f4": [
    {
      type: "note",
      body: "Referred by a current employee. ML infra background is a strong fit for Acme Fintech.",
      at: "2026-05-20T12:00:00Z",
      author: "Anna John",
    },
    {
      type: "interview",
      body: "Technical interview with the Acme Fintech data team — positive feedback.",
      at: "2026-05-28T18:00:00Z",
      author: "Anna John",
    },
  ],
  // James Park
  "a9ce90fa-ed48-4d93-86d4-b00faa6b8ec8": [
    {
      type: "call",
      body: "Intro call — open to relocating for the right autonomy/robotics role.",
      at: "2026-06-10T16:00:00Z",
      author: "Anna John",
    },
  ],
  // Sarah Chen
  "ad3d983a-236d-4d96-8b9a-48912f9b3ec6": [
    {
      type: "note",
      body: "Manually added from a conference contact exchange.",
      at: "2026-04-15T09:00:00Z",
      author: "Anna John",
    },
    {
      type: "email",
      body: "Followed up re: interest in design-systems-heavy roles.",
      at: "2026-04-22T11:30:00Z",
      author: "Anna John",
    },
  ],
  // Marcus Johnson
  "b9cf4fcf-7908-43fa-8c4a-098d2ca52e5b": [
    {
      type: "note",
      body: "Manually added — portfolio includes strong B2B SaaS case studies.",
      at: "2026-03-30T14:00:00Z",
      author: "Anna John",
    },
  ],
}
