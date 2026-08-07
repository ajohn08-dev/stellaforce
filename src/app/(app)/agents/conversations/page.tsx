import { ConversationsTable } from "@/components/agents/conversations-table"
import { ConversationSearch } from "@/components/agents/conversation-search"
import { ConversationFilterButton } from "@/components/agents/conversation-filter-button"
import { ConversationAgentChip } from "@/components/agents/conversation-agent-chip"
import { MOCK_CONVERSATIONS } from "@/lib/mock-conversations"
import { parseAgentNamesParam } from "@/lib/conversation-filters"

export default async function AgentConversationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = await searchParams
  const get = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined)

  const agents = parseAgentNamesParam(get("agents") ?? null)
  const q = get("q")?.trim().toLowerCase()

  const conversations = MOCK_CONVERSATIONS.filter((c) => {
    if (!agents.includes(c.agent_name)) return false
    if (q && !c.candidate_name.toLowerCase().includes(q)) return false
    return true
  })

  return (
    <div
      className="flex flex-col overflow-hidden"
      style={{ height: "calc(100vh - 3.5rem)" }}
    >
      <div className="shrink-0 border-b border-border px-4 py-4">
        <div className="flex items-center gap-2">
          <ConversationSearch />
          <ConversationFilterButton />
        </div>
      </div>

      <div className="shrink-0 px-4 pt-4">
        <ConversationAgentChip />
      </div>

      <div className="min-h-0 flex-1 p-4">
        <ConversationsTable data={conversations} />
      </div>
    </div>
  )
}
