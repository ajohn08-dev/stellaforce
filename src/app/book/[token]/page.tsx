import { BookingPage } from "@/components/booking/booking-page"
import { GENERIC_CANDIDATE_MESSAGE } from "@/lib/scheduling-reason-codes"
import { loadBooking, markBookingOpened } from "@/app/book/actions"

/**
 * The candidate's booking page.
 *
 * ⚠️ **Runs with the service-role client** — see the header of
 * `src/app/book/actions.ts` for the three rules that entails. Nothing here
 * accepts an identifier from the URL except the token itself, and every Server
 * Action re-resolves it rather than trusting anything the page hands back.
 *
 * Every failure — token never existed, expired, cancelled, stage deleted —
 * renders the *same* page. Distinguishing them would confirm to someone
 * guessing that a token existed, which is the only thing worth guessing here.
 */
export default async function BookInterviewPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const view = await loadBooking(token)

  if (!view) return <LinkNotValid />

  // Best-effort and after the load, so a logging failure can never cost the
  // candidate their page. Idempotent — re-reading the email is not news.
  await markBookingOpened(token)

  return <BookingPage token={token} view={view} />
}

function LinkNotValid() {
  return (
    <div className="rounded-xl border border-border bg-white p-8 text-center shadow-sm">
      <h1 className="text-lg font-semibold text-foreground">{GENERIC_CANDIDATE_MESSAGE}</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        It may have already been used, or it may have expired. Reply to the email you received
        and someone will send you a new one.
      </p>
    </div>
  )
}
