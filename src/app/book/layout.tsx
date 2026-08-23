import type { Metadata } from "next"

/**
 * The candidate's scheduling surface — outside the `(app)` route group, so it
 * gets no sidebar, no header, and no session.
 *
 * `/book` is excluded from the proxy matcher (`src/proxy.ts`): candidates have
 * no login, and passing this through `updateSession` would redirect every one of
 * them to `/login`.
 */
export const metadata: Metadata = {
  title: "Schedule your interview",
  // The URL contains a capability. It must not be indexed, and it must not
  // travel in a Referer header to any third-party asset the page loads.
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
}

export default function BookLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-muted/30">
      <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col justify-center px-4 py-10">
        {children}
      </main>
    </div>
  )
}
