"use client"

import * as React from "react"
import { MessageCircle, Send } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

/** UI-only placeholder — chat drilldown has no backend yet, sending is a no-op. */
export function HomeChatPanel({ prompts }: { prompts: string[] }) {
  const [value, setValue] = React.useState("")

  return (
    <div className="mx-auto flex h-full w-[50vw] flex-col gap-3">
      <div className="flex shrink-0 flex-nowrap gap-2 overflow-x-auto no-scrollbar">
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
      <div className="flex min-h-0 flex-1 items-end gap-2 rounded-lg border border-input bg-white p-2 dark:bg-white">
        <Textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Ask about your pipeline, reqs, or candidates…"
          className="h-full flex-1 resize-none border-0 bg-transparent field-sizing-fixed dark:bg-transparent"
        />
        <Button type="button" size="icon" disabled={!value.trim()}>
          <Send className="size-4" />
        </Button>
      </div>
    </div>
  )
}
