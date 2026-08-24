"use client"

import * as React from "react"
import { Ban, EyeOff, Lock, MessageCircle, Megaphone, Sparkles } from "lucide-react"

import { cn } from "@/lib/utils"
import type { CompiledAgentContext } from "@/lib/company-agent-context"
import {
  AGENT_AUDIENCE_HELP,
  AGENT_AUDIENCE_LABELS,
  type AgentAudience,
} from "@/lib/company-visibility"

/**
 * **What the agent knows** — the bundle an agent actually receives, with a
 * switch between the two audiences.
 *
 * Until now this existed only as a collapsed disclosure inside the Publish
 * dialog: company-scoped, candidate-only, and reachable solely when you had
 * unpublished edits. So the most basic question a recruiter has — *"what will
 * the agent say on this job?"* — had no destination at all.
 *
 * The **audience switch is the point**. Flip it and the withheld items move up
 * into the list, because an agent working alongside you is cleared for the
 * recruiter brief and a candidate agent never is. One toggle explains the
 * clearance ladder better than any badge: you see the same knowledge base
 * produce two different agents.
 *
 * Both bundles come from `compileAgentContext(company, job, audience)` — one
 * function, one gate — so what this screen promises and what the agent receives
 * cannot drift.
 */
export function AgentKnowledgePanel({
  bundles,
  className,
}: {
  /** One compiled bundle per audience. Compiled on the server, switched here. */
  bundles: Record<AgentAudience, CompiledAgentContext>
  className?: string
}) {
  const [audience, setAudience] = React.useState<AgentAudience>("candidate")
  const context = bundles[audience]

  const proactive = context.blocks
  const onRequest = context.answers
  const withheld =
    context.excluded.internal + context.excluded.restricted + context.excluded.unpublished

  return (
    <section className={cn("space-y-3", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-medium">What the agent knows</h3>
          <p className="text-xs text-muted-foreground">
            {AGENT_AUDIENCE_HELP[audience]}
          </p>
        </div>

        <div
          role="radiogroup"
          aria-label="Agent audience"
          className="flex shrink-0 rounded-lg border border-border p-0.5"
        >
          {(Object.keys(AGENT_AUDIENCE_LABELS) as AgentAudience[]).map((key) => (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={audience === key}
              onClick={() => setAudience(key)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                audience === key
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {AGENT_AUDIENCE_LABELS[key]}
            </button>
          ))}
        </div>
      </div>

      <div className="divide-y divide-border rounded-lg border border-border">
        <Group
          icon={<Megaphone className="size-3.5" />}
          title={audience === "candidate" ? "Says without being asked" : "Works from"}
          count={proactive.length}
          empty="Nothing yet — the agent opens with nothing about this company."
          items={proactive.map((b) => ({
            id: b.id,
            text: b.heading,
            note: b.sourceName,
          }))}
        />

        <Group
          icon={<MessageCircle className="size-3.5" />}
          title={audience === "candidate" ? "Answers if asked" : "Can answer"}
          count={onRequest.length}
          empty="No answers reach this role yet."
          items={onRequest.map((a) => ({
            id: a.id,
            text: a.question,
            // The whole reason the cascade exists, on the one screen where it
            // matters: not just *that* there's an answer, but which scope won.
            note:
              a.level === "job"
                ? "Set for this role"
                : a.level === "team"
                  ? "From a team"
                  : "From company",
          }))}
        />

        <Group
          icon={<Sparkles className="size-3.5" />}
          title="Policies it may state"
          count={context.policies.length}
          empty="No published policies."
          items={context.policies.map((p) => ({ id: p.id, text: p.label, note: null }))}
        />

        <Group
          icon={<Ban className="size-3.5" />}
          title="Hands back to you"
          count={context.escalations.length}
          empty="Nothing routes to a recruiter."
          items={context.escalations.map((e) => ({
            id: e.id,
            text: e.topic,
            note: null,
          }))}
        />

        <Group
          icon={<Lock className="size-3.5" />}
          title="Never says"
          count={context.prohibitedClaims.length}
          empty="No standing constraints."
          items={context.prohibitedClaims.map((c) => ({ id: c, text: c, note: null }))}
        />

        {withheld > 0 && (
          <Group
            icon={<EyeOff className="size-3.5" />}
            title="Withheld from this agent"
            count={withheld}
            empty=""
            items={[
              ...(context.excluded.internal > 0
                ? [
                    {
                      id: "internal",
                      text: `${context.excluded.internal} recruiters-only`,
                      note: "Switch to Internal to see these",
                    },
                  ]
                : []),
              ...(context.excluded.restricted > 0
                ? [
                    {
                      id: "restricted",
                      text: `${context.excluded.restricted} restricted`,
                      note: "Named staff only — no agent receives these",
                    },
                  ]
                : []),
              ...(context.excluded.unpublished > 0
                ? [
                    {
                      id: "unpublished",
                      text: `${context.excluded.unpublished} unpublished`,
                      note: "Publish to include",
                    },
                  ]
                : []),
            ]}
            // Contents are deliberately not listed — a withheld item's *body* is
            // the thing being withheld.
            summaryOnly
          />
        )}
      </div>

      {/* The counterpart to "Never says". A prohibition without a replacement
          sentence leaves the agent improvising at the worst possible moment, so
          the two belong on the same screen. */}
      <details className="rounded-lg border border-border">
        <summary className="cursor-pointer p-3 text-sm">
          When it can&apos;t answer
          <span className="ml-2 text-xs text-muted-foreground">
            {context.fallbacks.length} ways, by reason
          </span>
        </summary>
        <ul className="space-y-2 border-t border-border p-3">
          {context.fallbacks.map((f) => (
            <li key={f.kind}>
              <p className="text-xs font-medium text-muted-foreground">{f.label}</p>
              <p className="text-sm">“{f.text}”</p>
            </li>
          ))}
        </ul>
      </details>
    </section>
  )
}

function Group({
  icon,
  title,
  count,
  empty,
  items,
  summaryOnly = false,
}: {
  icon: React.ReactNode
  title: string
  count: number
  empty: string
  items: { id: string; text: string; note: string | null }[]
  summaryOnly?: boolean
}) {
  // Collapsed by default: the counts are the answer most of the time, and five
  // always-open lists is a wall of text nobody reads twice.
  const [open, setOpen] = React.useState(false)

  return (
    <div className="p-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        disabled={count === 0}
        className="flex w-full items-center gap-2 text-left disabled:opacity-70"
      >
        <span className="text-muted-foreground">{icon}</span>
        <span className="min-w-0 flex-1 text-sm">{title}</span>
        <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
          {count}
        </span>
      </button>

      {count === 0 && empty && (
        <p className="mt-1 pl-5.5 text-xs text-muted-foreground">{empty}</p>
      )}

      {open && count > 0 && (
        <ul className="mt-2 space-y-1 pl-5.5">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex flex-wrap items-baseline justify-between gap-2 text-sm text-muted-foreground"
            >
              <span className="min-w-0">{item.text}</span>
              {item.note && (
                <span className="shrink-0 text-xs opacity-80">{item.note}</span>
              )}
            </li>
          ))}
          {summaryOnly && (
            <li className="text-xs text-muted-foreground opacity-80">
              Contents aren&apos;t shown here — that&apos;s what withheld means.
            </li>
          )}
        </ul>
      )}
    </div>
  )
}
