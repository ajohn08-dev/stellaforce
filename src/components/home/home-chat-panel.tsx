"use client"

import * as React from "react"
import { MessageCircle, Send } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

/** UI-only placeholder — chat drilldown has no backend yet, sending is a no-op. */
export function HomeChatPanel({ prompts }: { prompts: string[] }) {
  const [value, setValue] = React.useState("")

  return (
    <div className="mx-auto flex w-[50vw] flex-col gap-3">
      <div className="flex flex-nowrap gap-2 overflow-x-auto no-scrollbar">
        {prompts.map((prompt) => (
          <Button
            key={prompt}
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0 gap-1.5 rounded-full"
            onClick={() => setValue(prompt)}
          >
            <MessageCircle className="size-3.5" />
            {prompt}
          </Button>
        ))}
      </div>
      <div className="flex items-end gap-2 rounded-lg border border-input bg-white p-2 dark:bg-white">
        <Textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Ask about your pipeline, reqs, or candidates…"
          className="min-h-28 border-0 bg-transparent dark:bg-transparent"
          rows={4}
        />
        <Button type="button" size="icon" disabled={!value.trim()}>
          <Send className="size-4" />
        </Button>
      </div>
    </div>
  )
}
