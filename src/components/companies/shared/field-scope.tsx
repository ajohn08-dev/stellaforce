"use client"

import * as React from "react"

/**
 * Tells a field which section it sits in, so a pending change can be listed as
 * "Benefits › Health benefits" in the publish review without every call site
 * passing its section down by hand.
 *
 * `SectionShell` provides it once per section; fields read it.
 */
const FieldScopeContext = React.createContext<string>("")

export function FieldScopeProvider({
  section,
  children,
}: {
  section: string
  children: React.ReactNode
}) {
  return (
    <FieldScopeContext.Provider value={section}>{children}</FieldScopeContext.Provider>
  )
}

/** Returns the `{ section, label }` metadata a dirty field registers with. */
export function useFieldScope(label: string) {
  const section = React.useContext(FieldScopeContext)
  return React.useMemo(() => ({ section, label }), [section, label])
}
