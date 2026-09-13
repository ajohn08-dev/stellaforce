"use client"

import { useSetBreadcrumb } from "@/lib/breadcrumb-context"

/**
 * Puts "← Back | Advanced Search" in the top header.
 *
 * A client component purely to reach the breadcrumb context from a Server
 * Component page — the same shape as set-candidate-breadcrumb / set-job-breadcrumb.
 * The back link matters more here than elsewhere: this screen hides the main
 * side navigation, so without it there is no way out of the page.
 */
export function SetAdvancedSearchBreadcrumb() {
  useSetBreadcrumb([{ label: "Advanced Search" }], { href: "/candidates" })
  return null
}
