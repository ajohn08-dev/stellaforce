# Google Calendar Team-Member Consent Flow — Planning Doc

## Problem restatement
- When someone is added to a job's hiring team in Stellaforce, we need a way for them to grant Google Calendar access so the platform can later help schedule interviews on their behalf.
- This is a consent/authorization flow (OAuth-style), not just a UI feature — it has identity, security, and token-lifecycle implications.
- The trigger event is "added to a job," but the underlying calendar connection may logically belong to the person, not the job — this needs to be resolved before anything else.
- n8n is in the stack for external side effects (this looks like a strong candidate: calendar API calls, token refresh orchestration), while Stellaforce likely owns state, consent tracking, and UI.
- Must account for revocation, reconnection, multiple jobs per person, and people who may not have Stellaforce accounts at all.
- Goal of this session: reach a decided, opinionated plan (MVP vs later) before any implementation, schema, or code work begins.

## Decision areas
1. Ideal user flow (trigger → consent screen → confirmation → ongoing use)
2. Permissions/consent model (what scopes, what's disclosed, what's stored)
3. What happens automatically when a team member is added to a job
4. Auth scope: tied to the **job**, the **person**, or the **organization**
5. Reconnect / revoked-access handling
6. Simplest MVP slice
7. App-side vs n8n-side responsibilities
8. Risks, edge cases, tradeoffs
9. Phased rollout plan

## Decisions log
- **Team member identity**: Hiring-team membership on a job is NOT restricted to existing Stellaforce/client profiles. Ad-hoc invitees (e.g. a client's interviewer who has no Stellaforce login) are in scope. → The flow must support two identity paths: (a) authenticated in-app connect for existing profiles, (b) passwordless/email-based consent for people with no account. This affects almost every downstream decision (identity model, reconnect, revocation, security).
- **Connection scope**: Per-person, not per-job. Connect once, reused automatically across every job that person is later staffed on. → Requires a stable identity key even for ad-hoc invitees with no profile row (likely their verified email / the Google account they authorize with) — open question: how do we key/match identity for people outside the profiles table, and what happens if the same human is invited under two different emails.
- **Consent timing**: Proactive, not just-in-time. Framed as an invite — "you've been added as a reviewer for this job/interview, connect your calendar" — sent at add-time, not deferred until scheduling needs it.
- **App/n8n split (confirmed direction)**: App generates the connect link (and whatever state/token it needs) and passes it to n8n via webhook; n8n composes and sends the actual invite email. Matches the existing pattern where n8n owns external side effects (email) and the app owns state/logic.
- **Trigger granularity**: Job-level. One invite per person per job, fired when added to the job's hiring team. Later interview assignments on the same job do NOT re-trigger a consent-link email — if already connected, they just get a normal notification.
- **OAuth scope**: Read + create/edit events (`calendar.events`-class scope), not just free/busy. Stellaforce will actually place/update/cancel interview events on their calendar, not just find open slots. → Flagged as a sensitive scope: implies Google OAuth app verification review, a fuller consent screen, and higher blast-radius-on-leak — carry into Risks section.
- **Scheduling call owner**: n8n makes the actual Google Calendar API calls (create/update/cancel events) at scheduling time, not the app — consistent with n8n owning all external side-effects. → Implication: n8n needs access to stored tokens (however they're persisted) to call Google on someone's behalf; app's job is to trigger scheduling intent via webhook and record results/state back. Token storage location/encryption is a shared concern between app and n8n now, not app-only.
- **Revocation handling**: Reactive, not proactive-periodic. Detected when n8n's Calendar API call actually fails at scheduling time. On failure: flag the connection as broken (in-app) and re-send the reconnect/consent-link email — no daily validation sweep for MVP.
- **MVP identity scope**: Both identity paths (profile-based in-app connect AND passwordless ad-hoc email-consent) ship together in MVP, not staged. → Raises the identity-matching question flagged earlier from "open" to "must resolve before MVP is buildable": how do we verify the person authorizing is who was actually invited?
- **Identity verification**: Enforce that the Google account used to authorize matches the invited email address. Reject/warn on mismatch — prevents a forwarded link granting access under the wrong identity.
- **Not-connected fallback**: Graceful degradation. Scheduling proceeds for everyone who IS connected; the not-yet-connected person gets a plain email invite/notification instead of an auto-managed calendar event, and the recruiter is flagged that this one is manual. Not a hard blocker.
- **Audit / lightweight pass**: User asked for a self-audit against "lightweight, execute via n8n, show value fast." Architecture skeleton (n8n owns Calendar API calls, per-person scope, job-level trigger) confirmed right-sized. Proposed trimming both identity paths down to profile-only for MVP — **rejected**; both identity paths stay in MVP as originally decided.
- **Google OAuth verification**: Don't wait for Google's formal app-verification review before building/testing. Build and pilot now — connectors will see Google's "unverified app" warning screen (fine for a pilot under 100 users) — and submit for review before wider rollout.
- **Recruiter visibility (revised, lightweight)**: Simple "Connected" / "Not connected" badge per team member, checked live — not a richer pending/revoked state machine, and no manual resend button in MVP.

## Synthesized flow (draft)
1. Recruiter adds a person to a job's hiring team (existing profile OR ad-hoc email invite).
2. On save, app checks: does this person already have a valid calendar connection (matched by profile id, or by verified email for ad-hoc people)?
   - If yes → skip the connect email, they're just notified they've been added.
   - If no → app generates a unique consent link/state, passes it to n8n via webhook; n8n sends the "you've been added — connect your calendar" invite email.
3. Person clicks the link → Google OAuth consent screen (scope: read + create/edit events; app is unverified for now, so a click-through warning screen precedes it) → app receives the callback, verifies the authorizing Google account's email matches the invited identity, stores the connection as **per-person** (reusable across future jobs).
4. Job detail page shows a live "Connected" / "Not connected" badge per team member (checked at render time, no separate tracked status states).
5. At scheduling time, n8n (holding/refreshing tokens) makes the actual Calendar API calls to create/update/cancel events for each connected person. Not-yet-connected people get a plain email instead — scheduling isn't blocked on them.
6. If a Calendar API call fails because access was revoked/expired, the connection is flagged broken and the reconnect email is re-sent automatically (reactive detection, no periodic sweep).

## Risks & edge cases (draft — needs your review)
- **Google OAuth verification**: `calendar.events`-class scope is sensitive → requires Google's app verification review (can take days–weeks) before the OAuth consent screen can go out to non-test users at scale; needs a public privacy policy page.
- **Token security**: refresh tokens now need to be readable by n8n as well as the app — encryption-at-rest and access-boundary need explicit design (who can decrypt, is it passed per-call or stored in n8n's own credential store).
- **Forwarded/leaked invite link**: mitigated by enforcing Google-account-email match, but the link itself should still be single-use or expiring to limit the window.
- **Duplicate/conflicting connections**: same human invited under two different emails (e.g. work vs personal) on different jobs — could create two separate "person" identities. Worth a light dedup strategy later, not necessarily MVP.
- **Client-side OAuth app policy**: some corporate Google Workspaces block third-party app authorization entirely (admin-restricted) — a client's own IT policy could silently break this for their staff; worth surfacing a clear error state rather than a silent failure.
- **Revoked mid-flight**: interviews already scheduled before a revocation aren't retroactively affected (the calendar event already exists) — only *future* create/update/cancel actions fail.
- **Rate limits/quota**: Google Calendar API quotas are per-project: for MVP with per-person tokens this is unlikely to matter, but worth a note for scale.

## MVP scope (confirmed, lightweight pass applied)
- Both identity paths (profile-based + ad-hoc/no-account) ship together.
- Per-person connection, reused across jobs.
- Proactive invite email at job-add time (job-level trigger, not per-interview).
- Scope: read + create/edit events.
- Email-match enforcement on ad-hoc consent.
- Recruiter-visible status: simple "Connected/Not connected" badge, no resend button.
- Reactive revocation detection + auto re-prompt.
- Graceful degradation for not-yet-connected people at scheduling time.
- Build/pilot now on an unverified Google OAuth app (accept the warning screen); submit for Google's formal verification before scaling past a pilot group.
- Explicitly deferred: periodic proactive token validation, identity dedup across multiple emails, Workspace domain-wide delegation as an alternative connection model, richer connection-status states + manual resend UI.

---
*Status: decisions finalized — ready to turn into an implementation prompt when requested.*
