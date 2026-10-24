# AstralCanvas

Multilingual AI horoscope experience with a pre-generated content bank, a deterministic composition engine, and an interactive shader-based zodiac scene. Built with Next.js, TypeScript, next-intl, Supabase, and Three.js.

**Core principle:** a user request never calls an AI model. All horoscope text is written with AI ahead of time in batch runs, validated, stored in a content bank (Supabase in production, local JSONL fixtures in development), and assembled at request time by a pure, testable TypeScript composition engine. See [`docs/architecture.md`](docs/architecture.md).

> **AI disclosure:** All horoscopes on AstralCanvas are AI-generated and assembled from pre-generated AI-written content. They are intended for entertainment and self-reflection only — not as factual predictions or professional advice. Astrology is not scientifically established as a reliable way to predict individual events.

## Status

Spec: `AstralCanvas_Technical_Specification(1).md` (implementation plan §18).

| Milestone                    | Scope                                                                                                              | Status                                                              |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------- |
| 1 — Foundation & i18n        | Next.js + TS strict, `/en` `/ru` locale routing, dictionaries, responsive UI, AI notice/disclaimer                 | ✅ Done                                                             |
| 2 — Supabase content model   | SQL migrations + RLS, repository interface, fixtures, schema validation, coverage report                           | ✅ Done (applied to the live project)                               |
| 3 — Pre-generation pipeline  | Batch AI provider adapter, bounded generation with dry-run/mock/resume/retry, validation, idempotent import/export | ✅ Done                                                             |
| 4 — Composition engine & API | Pure composition engine, `/api/horoscope` (no AI calls), localized errors, “Show another”, repetition avoidance    | ✅ Done (smoke-tested incl. 503 path)                               |
| 5 — Three.js zodiac scene    | Browser-only scene, 2+ custom GLSL shaders, controls, performance panel                                            | ✅ Done (first measurements collected)                              |
| 6 — Performance & deployment | Real-device measurements, Vercel deploy                                                                            | ⬜ Partial — env/deploy steps documented; deploy pending            |
| 7 — Portfolio polish         | Screenshots, demo recording, published measurements                                                                | ⬜ Partial — measurements + coverage published; screenshots pending |

Milestones 1–5 are implemented and locally verified (62 Vitest tests, lint/typecheck/build clean, live browser smoke of the scene in both locales). Milestone 6 requires a Vercel project and the Supabase dashboard service-role key — both owner actions; see [Deploying to Vercel](#deploying-to-vercel).

## Quickstart (no external services needed)

```bash
npm install
npm run dev        # http://localhost:3000 → redirects to /en
```

Local development runs against the committed fixtures in `fixtures/content/*.jsonl` (396 approved blocks — two hand-authored narrative arcs per sign plus expanded free pools, English + Russian, all 12 signs) — no Supabase project or AI key required.

## Commands

| Command                                                 | What it does                                                                                                             |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `npm run dev`                                           | Dev server                                                                                                               |
| `npm run build` / `npm start`                           | Production build / serve                                                                                                 |
| `npm test`                                              | Vitest suite (55 tests: composition, schema, validation, locale coverage, fixtures, share text)                          |
| `npm run lint` / `npm run typecheck` / `npm run format` | ESLint / tsc / Prettier                                                                                                  |
| `npm run content:generate`                              | **Batch AI generation** (the only AI entry point) — `--dry-run`, `--mock`, `--resume`, bounded by `--signs`/`--variants` |
| `npm run content:validate`                              | Schema/duplicate/near-duplicate QA gate for a batch                                                                      |
| `npm run content:import`                                | Idempotent import into `fixtures` or Supabase (`--approve` after review)                                                 |
| `npm run content:export`                                | Supabase → JSONL backup                                                                                                  |
| `npm run content:coverage`                              | Health report: scope coverage, valid combinations, duplicates                                                            |

Examples:

```bash
npm run content:generate -- --locale en --signs aries,taurus --variants 3
npm run content:generate -- --locale ru --signs all --dry-run
npm run content:validate -- --input content-out/<batch>/en-aries.jsonl
npm run content:import -- --input content-out/<batch>/en-aries.jsonl --into supabase --approve
npm run content:coverage -- --source fixtures
```

## Environment variables

Copy `.env.example` → `.env.local`. Everything is optional for local development (defaults to the fixture bank):

- `AI_PROVIDER_API_KEY`, `AI_PROVIDER_MODEL`, optional `AI_PROVIDER_BASE_URL` — batch generation only; never used by `/api/horoscope`.
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (Supabase's current name for the legacy anon key; optional — server code doesn't read it), `SUPABASE_SERVICE_ROLE_KEY` (**required for DB-backed serving**; dashboard → Settings → API keys; server-only, never committed) — the service-role key bypasses RLS, so it must never reach the browser bundle (verified absent after builds).
- `SUPABASE_DB_URL` (or `NEXT_PUBLIC_SUPABASE_CONNSTR`) — optional direct database connection (dashboard → Connect → pooler URI). The content scripts fall back to it when no service-role API key is present; it is the recommended transport for bulk imports. Server/CLI only.
- `CONTENT_SOURCE` — `fixtures` (default without Supabase config) or `supabase`.

## Supabase setup

1. Create a project; apply `supabase/migrations/0001_init.sql` and `0002_lockdown_grants.sql` (SQL editor, `supabase db push`, or any Postgres client over the pooler URI).
2. RLS is enabled on all tables with **zero anonymous policies**, and migration `0002` additionally revokes the default `anon`/`authenticated` grants — no anonymous SQL privilege on the content bank exists at all (spec §9.3). The app serves content exclusively through its server-side API using the service-role key.
3. Set the Supabase variables in your environment; the app switches to the database automatically (or force it with `CONTENT_SOURCE=supabase`).
4. Import content and verify health:
   ```bash
   npm run content:import -- --input fixtures/content/en.jsonl,fixtures/content/ru.jsonl --into supabase --approve
   npm run content:coverage -- --source supabase
   ```
   Both commands work with either `SUPABASE_SERVICE_ROLE_KEY` (REST) or `SUPABASE_DB_URL` (direct connection). Current production state (2026-10-24): 396 blocks imported, 192/192 scopes supported at 2,560–4,000 valid combinations per scope (above the 1,000/scope target), 0 duplicates — snapshots in `docs/reports/`.

## Deploying to Vercel

1. Push the repo; import it in Vercel (Next.js is auto-detected).
2. Set environment variables for **Production and Preview**:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY` — from the Supabase dashboard (Settings → API keys); required for DB-backed serving
   - `CONTENT_SOURCE=supabase`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — optional (server code doesn't read it)
   - `AI_PROVIDER_API_KEY` / `AI_PROVIDER_MODEL` — only if batch generation will run against the live provider (never on Vercel's request path)
3. API route `/api/horoscope` is a Node runtime route handler; pages are statically prerendered per locale.
4. Deploy a Preview, verify, then promote. Production checklist (spec §10.4) status:
   - ✅ verified locally: production build; locales configured; `/api/horoscope` validates input and serves only complete approved compositions; no AI calls on the request path; secrets absent from the browser bundle (scanned); localized errors incl. `database_unavailable` (503) when Supabase env is missing; disclosure in both locales; mobile layout + WebGL smoke-tested (desktop browser, 390×740 viewport).
   - ⬜ pending deploy: Preview + Production URLs verified; RLS/grants re-checked on the live project; mobile WebGL on a real device; quota/pause behavior documented for the live project.

## How a horoscope is assembled

```
batch script (AI provider, offline)
   → drafts → validate → import → Supabase / fixtures (approved blocks)
        ↓ (request time, no AI)
POST /api/horoscope  (validate → rate limit → load eligible pool)
        → composeHoroscope()  (pure: pick narrative arc → tag-compatible blocks)
        → localized result + compositionId + AI disclosure
```

- **Narrative arcs:** `title`, `overview`, and the theme body (`focus`/`relationships`/`work`/`growth`) come from one coherent arc; `opening`, `reflection_prompt`, `closing` come from a sign-agnostic pool.
- **Tags & exclusions:** every picked pair is checked against `tags`/`excludedTags` (tone coherence).
- **Repetition avoidance:** the client sends its last ≤20 `compositionId`s (localStorage only); the engine prefers unseen combinations and honestly reports repeats.
- **Determinism:** seeded PRNG — same pool + seed always produces the same composition; the server uses a per-request nonce for variety.

## Project layout

```
src/
├── app/[locale]/          # pages: home (horoscope), about/disclaimer, explorer
├── app/api/horoscope/     # public composition endpoint (no AI on this path)
├── i18n/                  # next-intl routing/request/navigation
├── messages/{en,ru}.json  # UI dictionaries (bulk content lives in the bank, not here)
├── components/            # horoscope form/result, explorer scene, locale switcher, notices
├── lib/content/           # schema, composition engine, repositories, coverage, prompts, provider
├── lib/explorer/          # scene engine + pure preset/control config (Milestone 5)
├── lib/{astrology,i18n,validation}/  # zodiac data, locale config, request validation
├── shaders/               # original GLSL: planet surface (A) + star field (B)
├── proxy.ts               # locale negotiation (Next 16 proxy convention)
├── scripts/               # content pipeline + fixture generator
└── tests/                 # Vitest suites
fixtures/content/          # committed dev content bank (en/ru JSONL)
supabase/migrations/       # schema + RLS
docs/                      # architecture, content pipeline, localization, disclosure, shaders, performance
```

## Documentation

- [`docs/architecture.md`](docs/architecture.md) — system boundaries, composition engine, data flow
- [`docs/content-pipeline.md`](docs/content-pipeline.md) — generation, validation, import/export, versioning
- [`docs/localization.md`](docs/localization.md) — adding a locale and approving its content bank
- [`docs/ai-disclosure.md`](docs/ai-disclosure.md) — disclosure wording and placement
- [`docs/shaders.md`](docs/shaders.md) — shader design, attribute/uniform tables, rendering pipeline (Milestone 5)
- [`docs/performance.md`](docs/performance.md) — methodology + first measurements (2026-10-24)
- [`docs/reports/`](docs/reports/) — published snapshots (e.g. Supabase coverage report)

## Known limitations

- Not yet deployed: Vercel import + env vars are owner actions; the production checklist items that need a live deployment remain open (see above).
- Scene performance: first measurements exist (desktop, RTX 5060 laptop — `docs/performance.md`) but the full matrix (30 s windows per preset, High preset, density sweep, a real mobile device) is pending; nothing is claimed beyond what was measured.
- All current bank text is hand-authored template content (396 blocks, two arcs per sign). The AI batch pipeline (`content:generate`) remains the intended way to grow the bank further; hand-authored copy is varied but finite, and the repetition-avoidance window still bottoms out after dozens of readings in one scope.
- DB-backed serving (`CONTENT_SOURCE=supabase`) requires `SUPABASE_SERVICE_ROLE_KEY`, which only project owners can copy from the dashboard; the DB itself is imported, coverage-verified, and its anonymous surface fully closed.
- The WebGL fallback (no WebGL → readable notice + DOM-only sign guide) is implemented but was not exercised on a real no-WebGL browser this session.
- The in-memory rate limiter is per-instance (Vercel functions); it is basic abuse protection, not a durable quota.
- Planet positions in the scene are decorative, not astronomically computed (labeled in the UI in both locales).
