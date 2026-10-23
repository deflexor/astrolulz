# Architecture

## System boundaries

Three strictly separated workflows (spec §7.1):

1. **Content production (offline)** — `src/scripts/generate-content.ts` calls the AI provider through `src/lib/content/provider.ts` (Anthropic Messages API adapter, or a deterministic `MockProvider` for tests/dry-runs). Drafts land in local JSONL artifacts, pass `content:validate`, and are imported idempotently into Supabase or the fixtures. This is the **only** code path that touches the AI provider.

2. **Serving (request time)** — `POST /api/horoscope` validates input (Zod), applies a soft rate limit, loads an eligible pool via a repository, and calls the pure composition engine. No AI SDK is imported anywhere on this path.

3. **Rendering** — static pages per locale (`/en`, `/ru`, `/en/about`, …) plus one client-side form; the browser only ever talks to `/api/horoscope`.

## The composition engine (`src/lib/content/composeHoroscope.ts`)

A pure function: `blocks + validated request + seed → result or typed failure`. No React, no Supabase, no filesystem, no AI — which is what makes variety, repetition avoidance, and failure paths unit-testable.

Algorithm (two-stage, spec §7.4):

1. **Defensive pool filter** — approved blocks only, exact locale match, sign-specific or sign-agnostic, period/theme scope match (`any` blocks are reusable).
2. **Narrative arcs** — arc-bound slots (`title`, `overview`, theme body) are grouped by `narrativeArcId`; only arcs with at least one eligible block per required slot are candidates. This prevents the "random collage" failure mode: the core of every reading tells one coherent story.
3. **Seeded selection** — `mulberry32` PRNG seeded by `stableId(serverNonce + scope + recentIds)`. Weighted picks favor sign-specific material (+10) and configured `weight`.
4. **Pairwise tag compatibility** — every pair of selected blocks is checked against `tags` × `excludedTags` (tone coherence, e.g. a calm arc refusing bold openings).
5. **Repetition avoidance** — up to 32 bounded attempts to find a combination whose `compositionId` is not in the client's recent list (≤20 ids, localStorage only). If none exists, the best valid candidate is returned with `repeated: true` and the UI shows an honest notice.
6. **Stable fingerprint** — `compositionId = stableId(sorted block ids + content versions)` (two-pass FNV-1a; non-cryptographic by design — it only needs stability and spread).

Slot model:

| Slot                                          | Source                    | Appears in result as  |
| --------------------------------------------- | ------------------------- | --------------------- |
| `title`                                       | arc                       | `title`               |
| `opening`                                     | free pool (sign-agnostic) | `overview` (the lede) |
| `overview`                                    | arc                       | first section         |
| `focus` / `relationships` / `work` / `growth` | arc (theme-selected)      | second section        |
| `reflection_prompt`                           | free pool                 | `reflectionPrompt`    |
| `closing`                                     | free pool                 | third section         |

## Repository layer (`src/lib/content/repository.ts`)

`HoroscopeContentRepository` exposes one method: `getEligibleBlocks(request)`. Two implementations:

- `FixtureContentRepository` — reads `fixtures/content/*.jsonl`, schema-validates every line, caches in memory. Default in development and tests.
- `SupabaseContentRepository` — server-only; narrow query (status/locale/slots/period/theme/sign) with a 2000-row cap; the SDK is imported lazily so the fixture path never bundles it.

`createContentRepository()` picks by `CONTENT_SOURCE` / env presence. Selection is injected at the API boundary, never inside the engine.

## API contract

`POST /api/horoscope`

- Request: `{ locale, signId, period, theme, recentCompositionIds?, timeZone? }` (all validated; IANA time zones verified; recents capped at 20 × 16-hex).
- Success: `{ result: HoroscopeResult, repeated: boolean }` with `generatedByAI: true`, `generationMode: "pre-generated-composition"`, `compositionId`, `contentVersion`, `assembledAt`, `disclaimerVersion`.
- Errors: `{ error: { code } }` with codes `invalid_request` (400), `rate_limited` (429), `content_unavailable` (404), `database_unavailable` (503). The UI maps codes to localized messages; internal details (SQL, provider errors, stack traces) are logged server-side only.

## Localization

`src/lib/i18n/locales.ts` is the single source of truth (`en`, `ru`, default `en`). next-intl's routing (`localePrefix: 'always'`) + `src/proxy.ts` (Next 16's successor to `middleware.ts`) negotiate the locale; the URL is authoritative. UI text lives in `src/messages/*.json`; horoscope text lives in the content bank. A result is assembled entirely in one locale — there is no runtime translation and no silent fallback (missing pools surface as `content_unavailable`).

## Data model

See `supabase/migrations/0001_init.sql`: `supported_locales`, `zodiac_sign_translations`, `content_batches` (provenance), `content_blocks` (the bank, with serving + partial indexes and a unique content hash), `composition_metrics_daily` (aggregates only). RLS is enabled on every table with **no anonymous policies** — all access goes through the server-side API with the service-role key.

## What is deliberately not here yet

- The Three.js/GLSL zodiac scene (Milestone 5) — `/[locale]/explorer` is an honest placeholder.
- Server-side composition metrics writes (`composition_metrics_daily` exists; the API does not write per-request rows — a deliberate free-tier-friendly default per spec §7.7).
