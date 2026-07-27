"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import type { AgentFunnel, SankeyNode } from "@/lib/mock-agent-analytics"

const WIDTH = 1000
const HEIGHT = 320
const BAR_WIDTH = 18
const NODE_GAP = 16
/** Viewbox units reserved on each side, inside the same coordinate space, for label text — so the plot spans the full card width and labels overlay near its edges rather than sitting in separate reserved columns. */
const MARGIN = 190

const LEFT_LABEL_PCT = (MARGIN / WIDTH) * 100
const RIGHT_LABEL_PCT = ((WIDTH - MARGIN) / WIDTH) * 100

type NodePosition = { top: number; bottom: number }

/** Stacks a column's nodes top-to-bottom (proportional to value, fixed gap between), centered in HEIGHT. */
function layoutColumn(nodes: SankeyNode[], totals: Record<string, number>, scale: number) {
  let y = 0
  const positions: Record<string, NodePosition> = {}
  for (const node of nodes) {
    const h = totals[node.id] * scale
    positions[node.id] = { top: y, bottom: y + h }
    y += h + NODE_GAP
  }
  const stackHeight = y - NODE_GAP
  const offset = (HEIGHT - stackHeight) / 2
  for (const node of nodes) {
    positions[node.id].top += offset
    positions[node.id].bottom += offset
  }
  return positions
}

export function CandidateFunnelChart({
  sourceNodes,
  targetNodes,
  links: linkData,
}: AgentFunnel) {
  const [hoveredLink, setHoveredLink] = React.useState<string | null>(null)

  const { sourcePositions, targetPositions, links, sourceTotals, targetTotals } =
    React.useMemo(() => {
      const sourceTotals: Record<string, number> = {}
      const targetTotals: Record<string, number> = {}
      let grandTotal = 0
      for (const link of linkData) {
        sourceTotals[link.source] = (sourceTotals[link.source] ?? 0) + link.value
        targetTotals[link.target] = (targetTotals[link.target] ?? 0) + link.value
        grandTotal += link.value
      }

      const maxGaps = Math.max(sourceNodes.length, targetNodes.length) - 1
      const scale = (HEIGHT - maxGaps * NODE_GAP) / grandTotal

      const sourcePositions = layoutColumn(sourceNodes, sourceTotals, scale)
      const targetPositions = layoutColumn(targetNodes, targetTotals, scale)

      const sourceCursor: Record<string, number> = Object.fromEntries(
        sourceNodes.map((n) => [n.id, sourcePositions[n.id].top])
      )
      const targetCursor: Record<string, number> = Object.fromEntries(
        targetNodes.map((n) => [n.id, targetPositions[n.id].top])
      )
      const sourceById = Object.fromEntries(sourceNodes.map((n) => [n.id, n]))
      const targetById = Object.fromEntries(targetNodes.map((n) => [n.id, n]))

      const x1 = MARGIN + BAR_WIDTH
      const x2 = WIDTH - MARGIN - BAR_WIDTH
      const midX = (x1 + x2) / 2

      const links = linkData.map((link, i) => {
        const h = link.value * scale
        const sTop = sourceCursor[link.source]
        const sBottom = sTop + h
        sourceCursor[link.source] = sBottom
        const tTop = targetCursor[link.target]
        const tBottom = tTop + h
        targetCursor[link.target] = tBottom

        const path = [
          `M ${x1} ${sTop}`,
          `C ${midX} ${sTop}, ${midX} ${tTop}, ${x2} ${tTop}`,
          `L ${x2} ${tBottom}`,
          `C ${midX} ${tBottom}, ${midX} ${sBottom}, ${x1} ${sBottom}`,
          "Z",
        ].join(" ")

        return {
          key: `${link.source}-${link.target}`,
          path,
          gradientId: `funnel-grad-${i}`,
          sourceColor: sourceById[link.source].colorHex,
          targetColor: targetById[link.target].colorHex,
          sourceLabel: sourceById[link.source].label,
          targetLabel: targetById[link.target].label,
          value: link.value,
        }
      })

      return { sourcePositions, targetPositions, links, sourceTotals, targetTotals }
    }, [sourceNodes, targetNodes, linkData])

  const hovered = links.find((l) => l.key === hoveredLink) ?? null

  return (
    <div className="flex flex-col gap-6">
      <div className="relative w-full" style={{ height: HEIGHT }}>
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          preserveAspectRatio="none"
          className="absolute inset-0 size-full"
        >
          <defs>
            {links.map((l) => (
              <linearGradient key={l.gradientId} id={l.gradientId} x1="0" x2="1" y1="0" y2="0">
                <stop offset="0%" stopColor={l.sourceColor} stopOpacity={0.55} />
                <stop offset="100%" stopColor={l.targetColor} stopOpacity={0.55} />
              </linearGradient>
            ))}
          </defs>

          {links.map((l) => (
            <path
              key={l.key}
              d={l.path}
              fill={`url(#${l.gradientId})`}
              className="cursor-pointer transition-opacity"
              opacity={hoveredLink === null || hoveredLink === l.key ? 1 : 0.25}
              onMouseEnter={() => setHoveredLink(l.key)}
              onMouseLeave={() => setHoveredLink((h) => (h === l.key ? null : h))}
            />
          ))}

          {sourceNodes.map((node) => {
            const pos = sourcePositions[node.id]
            return (
              <rect
                key={node.id}
                x={MARGIN}
                y={pos.top}
                width={BAR_WIDTH}
                height={Math.max(pos.bottom - pos.top, 1)}
                rx={3}
                fill={node.colorHex}
              />
            )
          })}
          {targetNodes.map((node) => {
            const pos = targetPositions[node.id]
            return (
              <rect
                key={node.id}
                x={WIDTH - MARGIN - BAR_WIDTH}
                y={pos.top}
                width={BAR_WIDTH}
                height={Math.max(pos.bottom - pos.top, 1)}
                rx={3}
                fill={node.colorHex}
              />
            )
          })}
        </svg>

        {sourceNodes.map((node) => {
          const pos = sourcePositions[node.id]
          const topPct = (((pos.top + pos.bottom) / 2) / HEIGHT) * 100
          return (
            <div
              key={node.id}
              className="absolute flex -translate-x-[calc(100%+10px)] -translate-y-1/2 flex-col items-end text-right"
              style={{ top: `${topPct}%`, left: `${LEFT_LABEL_PCT}%` }}
            >
              <span className="text-sm font-medium text-foreground">{node.label}</span>
              <span className="text-xs text-muted-foreground">
                {sourceTotals[node.id]} candidates
              </span>
            </div>
          )
        })}
        {targetNodes.map((node) => {
          const pos = targetPositions[node.id]
          const topPct = (((pos.top + pos.bottom) / 2) / HEIGHT) * 100
          return (
            <div
              key={node.id}
              className="absolute flex translate-x-[10px] -translate-y-1/2 flex-col items-start"
              style={{ top: `${topPct}%`, left: `${RIGHT_LABEL_PCT}%` }}
            >
              <span className="text-sm font-medium text-foreground">{node.label}</span>
              <span className="text-xs text-muted-foreground">
                {targetTotals[node.id]} candidates
              </span>
            </div>
          )
        })}

        {hovered && (
          <div className="pointer-events-none absolute top-2 left-1/2 -translate-x-1/2 rounded-md bg-foreground px-2 py-1 text-xs whitespace-nowrap text-background shadow-sm">
            <span className="font-semibold">{hovered.value}</span> candidates ·{" "}
            {hovered.sourceLabel} → {hovered.targetLabel}
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-x-6 gap-y-2 border-t border-border pt-4">
        {[...sourceNodes, ...targetNodes].map((node) => (
          <span
            key={node.id}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"
          >
            <span className={cn("size-2.5 rounded-full", node.colorClass)} />
            {node.label}
          </span>
        ))}
      </div>
    </div>
  )
}
