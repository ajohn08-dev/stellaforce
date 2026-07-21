"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

import { Sheet, SheetContent } from "@/components/ui/sheet"

/** Wraps the candidate profile in a wide right-side panel, closing back to the candidates list. */
export function CandidateProfileSheet({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [open, setOpen] = React.useState(true)

  return (
    <Sheet
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (!nextOpen) router.back()
      }}
    >
      <SheetContent className="max-w-4xl gap-0 bg-white p-0">
        <div
          className="flex flex-col gap-6 overflow-hidden p-6"
          style={{ height: "100dvh" }}
        >
          {children}
        </div>
      </SheetContent>
    </Sheet>
  )
}
