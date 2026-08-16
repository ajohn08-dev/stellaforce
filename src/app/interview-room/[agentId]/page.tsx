import { notFound } from "next/navigation"

import { InterviewRoom } from "@/components/interview-room/interview-room"
import { getAgentById } from "@/lib/data"
import { getInterviewAgentConfig } from "@/lib/interview-agent-config"

export const metadata = {
  title: "Interview Room — Stella Force",
}

export default async function InterviewRoomPage({
  params,
}: {
  params: Promise<{ agentId: string }>
}) {
  const { agentId } = await params
  const agent = await getAgentById(agentId)
  if (!agent) notFound()

  // The person the agent presents as ("Priya"), distinct from the interview's
  // own name ("Who Interview"). The interviewer is who *speaks*, so that's what
  // belongs on the tile and against each transcript turn.
  const config = getInterviewAgentConfig(agent.id)

  // The token is minted from the client on "Start Interview" rather than here,
  // so it isn't already ticking down while the candidate reads the briefing and
  // sorts out camera permissions.
  return (
    <InterviewRoom
      agentId={agent.id}
      agentName={agent.name}
      agentDisplayName={config?.agentDisplayName ?? agent.name}
      agentDescription={agent.description}
      estimatedMinutes={
        agent.avg_handle_time_minutes === null
          ? null
          : Math.round(Number(agent.avg_handle_time_minutes))
      }
    />
  )
}
