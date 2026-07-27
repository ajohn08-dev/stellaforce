"use client"

import * as React from "react"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { CandidateFunnelChart } from "@/components/agents/analytics/candidate-funnel-chart"
import {
  AGENT_TYPE_OPTIONS,
  AGENT_CANDIDATE_FUNNELS,
  type AgentType,
} from "@/lib/mock-agent-analytics"

export function CandidateFunnelCard() {
  const [agentType, setAgentType] = React.useState<AgentType>("screening")
  const funnel = AGENT_CANDIDATE_FUNNELS[agentType]

  return (
    <div className="rounded-lg border border-border bg-white p-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h2 className="text-sm font-medium text-foreground">Candidate Funnel</h2>
        <Select
          value={agentType}
          onValueChange={(value) => value && setAgentType(value as AgentType)}
        >
          <SelectTrigger>
            <SelectValue>
              {(value: AgentType) =>
                AGENT_TYPE_OPTIONS.find((o) => o.value === value)?.label ?? value
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {AGENT_TYPE_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <CandidateFunnelChart
        sourceNodes={funnel.sourceNodes}
        targetNodes={funnel.targetNodes}
        links={funnel.links}
      />
    </div>
  )
}
