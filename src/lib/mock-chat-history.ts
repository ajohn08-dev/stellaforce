/**
 * UI-preview data only, for the /chat page's history rail — there is no
 * chat/conversation persistence yet (see CLAUDE.md build order).
 */

export type ChatHistoryEntry = {
  id: string
  title: string
  timestamp: string
}

export const MOCK_CHAT_HISTORY: ChatHistoryEntry[] = [
  { id: "chat-1", title: "Which reqs are thin right now?", timestamp: "2 hours ago" },
  { id: "chat-2", title: "Show delayed reqs by hiring manager", timestamp: "Yesterday" },
  { id: "chat-3", title: "Weekly momentum summary", timestamp: "3 days ago" },
  { id: "chat-4", title: "Candidates at risk of SLA breach", timestamp: "Last week" },
]
