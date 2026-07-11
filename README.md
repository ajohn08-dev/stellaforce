# Stella Force

AI-native recruiting platform (demo scaffold). Recruiter-facing web app for
candidate intelligence: structured + semantic search, AI-assisted ingestion with
human confirmation, and a client/job/pipeline data model.

Built with **Next.js (App Router) + TypeScript**, **Tailwind v4 + shadcn/ui**,
**TanStack Table**, **Supabase (Postgres + pgvector)**, and the **Claude API**.

> **`CLAUDE.md` is the source of truth** for the schema, controlled vocabularies,
> workflow specs, and conventions. Read it before extending anything.

## Prerequisites
- Node `>= 20` (developed on v24)
- **pnpm** — if you don't have it: `npm i -g pnpm` (or via Corepack)
- A Supabase project (Postgres + pgvector), connected after setup
- An Anthropic API key (for AI ingestion)

## Setup

```bash
pnpm install
cp .env.example .env.local   # then fill in the values (see below)
pnpm dev                     # http://localhost:3000  → redirects to /candidates
```

The app runs before Supabase is connected — pages show a "connect Supabase"
notice and empty lists until env vars + migrations + seed are in place.

## Environment variables (`.env.local`)

| Variable | Scope | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | client + server | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | client + server | Anon key (RLS-governed) |
| `SUPABASE_SERVICE_ROLE_KEY` | **server only** | Bypasses RLS — server actions + seed |
| `ANTHROPIC_API_KEY` | **server only** | Claude API for AI parsing |

Never commit `.env.local`. `.env.example` documents the shape.

## Database migrations

SQL migrations live in [`supabase/migrations/`](supabase/migrations/), applied in
order:

1. `0001_extensions_and_enums.sql` — `vector` extension + all enum types
2. `0002_core_tables.sql` — tables, FKs, `updated_at` triggers
3. `0003_indexes.sql` — FK indexes + ivfflat vector index
4. `0004_rls.sql` — enable RLS + authenticated-recruiter policies

Apply them one of these ways once your Supabase project is connected:

- **Supabase MCP** (from Claude): run each migration file against the live schema.
- **Supabase SQL Editor**: paste each file in order and run.
- **Supabase CLI**: `supabase db push` (if you adopt the CLI's migration flow).

## Seed data

Populates ~20 candidates (mixed tiers, varied skills incl. AI-literacy signals),
3 clients, 4 job orders, and several applications:

```bash
pnpm seed
```

Requires `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`
and the migrations already applied. **The seed clears the demo tables first** so
re-runs are clean (demo data only; it never touches auth users).

> Because RLS allows only authenticated recruiters to read, seeded data appears in
> the UI once you're signed in. Until Supabase Auth is wired, use the Supabase
> dashboard (or a service-role query) to inspect seeded rows.

## Scripts

| Command | What it does |
|---|---|
| `pnpm dev` | Start the dev server |
| `pnpm build` | Production build |
| `pnpm start` | Run the production build |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm seed` | Seed demo data (see above) |

## Project structure

```
src/
  app/
    candidates/        list, [id] profile, new (ingestion), actions.ts
    job-orders/        list, [id] detail
    search/            Filters + Semantic (stub) tabs
  components/          main-nav, tier-badge, ui/ (shadcn), feature components
  lib/
    supabase/          client.ts (browser), server.ts (RLS), admin.ts (service-role), types.ts
    ai/                parse.ts (Claude), embeddings.ts (provider TODO)
    data.ts            Server-Component read helpers
    constants.ts       controlled vocabularies + skill taxonomy
    env.ts             validated env access (public vs server-only)
supabase/migrations/   0001–0004 SQL
scripts/seed.ts        seed script
CLAUDE.md              frozen schema + conventions (source of truth)
```

## Known TODOs (see CLAUDE.md build order)
- **Embeddings provider** — Anthropic has no embeddings API; `embeddings.ts`
  returns a placeholder. Wire OpenAI `text-embedding-3-small` (1536) or Voyage AI.
- **Semantic search** — add a pgvector similarity RPC + Server Action.
- **Refer/update loop** — applications, interactions, `candidate_client_fit`.
- **Auth** — wire Supabase Auth; then move write actions to the RLS server client.

## Deploy (Vercel)
Set the four env vars in the Vercel project settings, connect the repo, and
deploy. The service-role key and Anthropic key must be **server-side only** env
vars (not prefixed `NEXT_PUBLIC_`).
