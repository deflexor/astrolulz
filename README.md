# AstralCanvas

Multilingual AI horoscope experience with a pre-generated content bank, a deterministic composition engine, and (planned) an interactive shader-based zodiac scene. Built with Next.js, TypeScript, next-intl, Supabase, and Three.js.

**Core principle:** a user request never calls an AI model. All horoscope text is written with AI ahead of time in batch runs, validated, stored in a content bank (Supabase in production, local JSONL fixtures in development), and assembled at request time by a pure, testable TypeScript composition engine. See [`docs/architecture.md`](docs/architecture.md).

> **AI disclosure:** All horoscopes on AstralCanvas are AI-generated and assembled from pre-generated AI-written content. They are intended for entertainment and self-reflection only — not as factual predictions or professional advice. Astrology is not scientifically established as a reliable way to predict individual events.

## Status

Spec: `AstralCanvas_Technical_Specification(1).md` (implementation plan §18).

| Milestone                    | Scope                                                                                                              | Status                            |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------ | --------------------------------- |
| 1 — Foundation & i18n        | Next.js + TS strict, `/en` `/ru` locale routing, dictionaries, responsive UI, AI notice/disclaimer                 | ✅ Done                           |
| 2 — Supabase content model   | SQL migrations + RLS, repository interface, fixtures, schema validation, coverage report                           | ✅ Done                           |
| 3 — Pre-generation pipeline  | Batch AI provider adapter, bounded generation with dry-run/mock/resume/retry, validation, idempotent import/export | ✅ Done                           |
| 4 — Composition engine & API | Pure composition engine, `/api/horoscope` (no AI calls), localized errors, “Show another”, repetition avoidance    | ✅ Done                           |
| 5 — Three.js zodiac scene    | Browser-only scene, 2+ custom GLSL shaders, controls, performance panel                                            | ⬜ Pending (placeholder page)     |
| 6 — Performance & deployment | Real-device measurements, Vercel deploy                                                                            | ⬜ Config-ready, not yet deployed |
| 7 — Portfolio polish         | Screenshots, demo recording, published measurements                                                                | ⬜ Pending                        |

The Three.js dependencies are pinned but the scene itself is not implemented; `/[locale]/explorer` states this honestly rather than shipping a fake canvas.

## Quickstart (no external services needed)

```bash
npm install
npm run dev        # http://localhost:3000 → redirects to /en
```

Local development runs against the committed fixtures in `fixtures/content/*.jsonl` (192 approved blocks, English + Russian, all 12 signs) — no Supabase project or AI key required.

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
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` — the service-role key is **server-only** and must never reach the browser bundle.
- `CONTENT_SOURCE` — `fixtures` (default without Supabase config) or `supabase`.

## Supabase setup

1. Create a project; run the migration in `supabase/migrations/0001_init.sql` (SQL editor or `supabase db push`).
2. RLS is enabled on all tables with **no anonymous policies** — the app serves content exclusively through its server-side API using the service-role key. See `supabase/seed/README.md` for the content workflow.
3. Set the three Supabase variables in your environment; the app switches to the database automatically (or force it with `CONTENT_SOURCE=supabase`).

## Deploying to Vercel

1. Push the repo; import it in Vercel (Next.js is auto-detected).
2. Configure the environment variables above for Production/Preview.
3. API route `/api/horoscope` is a Node runtime route handler; pages are statically prerendered per locale.
4. Verify with a Preview deployment before promoting (production checklist in the spec §10.4).

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
├── components/            # horoscope form/result, locale switcher, notices
├── lib/content/           # schema, composition engine, repositories, coverage, prompts, provider
├── lib/{astrology,i18n,validation}/  # zodiac data, locale config, request validation
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
- [`docs/shaders.md`](docs/shaders.md) — planned shader design (Milestone 5)
- [`docs/performance.md`](docs/performance.md) — methodology; measurements pending

## Known limitations

- The zodiac explorer scene (Three.js/GLSL) is not implemented yet.
- No performance measurements have been collected; nothing is claimed without evidence.
- The dev fixture bank provides ~72 valid combinations per scope — far below the production variety target of 1,000/scope; the coverage report reports this honestly.
- The in-memory rate limiter is per-instance (Vercel functions); it is basic abuse protection, not a durable quota.
- Planet positions shown in future visuals will be decorative, not astronomically computed.
