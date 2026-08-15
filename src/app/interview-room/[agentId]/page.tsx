import { notFound } from "next/navigation"

import { InterviewRoom } from "@/components/interview-room/interview-room"
import { getAgentById } from "@/lib/data"

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

  // The token is minted from the client on "Start Interview" rather than here,
  // so it isn't already ticking down while the candidate reads the briefing and
  // sorts out camera permissions.
  return (
    <InterviewRoom
      agentId={agent.id}
      agentName={agent.name}
      agentDescription={agent.description}
      estimatedMinutes={
        agent.avg_handle_time_minutes === null
          ? null
          : Math.round(Number(agent.avg_handle_time_minutes))
      }
    />
  )
}
