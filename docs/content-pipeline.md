# Content pipeline

How horoscope text is produced, validated, imported, and versioned — and why the user request path never calls the AI provider.

## Workflow

```
npm run content:generate   (AI provider, offline batch; --dry-run / --mock / --resume)
        ↓  drafts (.jsonl, status: "draft")
npm run content:validate   (schema + duplicates + near-duplicates gate)
        ↓  human editorial review (recommended before --approve)
npm run content:import     (--into supabase|fixtures, --approve marks reviewed; idempotent)
        ↓
content bank  ──►  npm run content:export  (JSONL backups, no lock-in)
        │
        └► npm run content:coverage  (scope health + valid-combination counts)
```

## Content block shape

Defined by `contentBlockSchema` (Zod) in `src/lib/content/contentSchema.ts`; mirrored by the `content_blocks` table. Key fields:

- `locale`, `signId` (null = sign-agnostic free-slot content), `period`/`theme` (`any` marks cross-scope reuse), `slot` (one of nine roles)
- `narrativeArcId` — groups `title`/`overview`/theme-body blocks into one coherent story; null for free slots
- `tags` / `excludedTags` — pairwise tone-compatibility constraints enforced by the engine
- `weight` — selection priority
- `contentHash` — SHA-256 of the canonical block content (`canonicalBlockContent`); exact-duplicate detection
- `contentVersion` + `promptVersion` + `sourceModel` — provenance and reproducibility
- `status` — `draft` → `approved` (only approved blocks are ever served) → `retired`

## Prompts and safety

`src/lib/content/prompts.ts` holds the system prompt: calm, non-alarmist, culturally respectful, non-deterministic framing; hard prohibitions on death/disasters/medical/legal/financial claims; everything phrased as optional reflection. The prompt version (`gen-v1`) is stamped onto generated blocks.

## Validation gates (`content:validate`)

- Zod schema violations → **error** (non-zero exit)
- Exact duplicates by `contentHash` or normalized body → **error**
- Near-duplicates (trigram Jaccard ≥ 0.85, same locale+slot) → **warning** for human judgment — a similarity score never replaces review
- Title length and slot/locale/sign sanity → **error**

## Idempotent import

- Fixtures mode: appends to `fixtures/content/<locale>.jsonl`, skipping existing ids — safe to re-run.
- Supabase mode: upsert with `ignoreDuplicates` on `id`, chunked, server-side only. Two transports: the REST API with `SUPABASE_SERVICE_ROLE_KEY` (primary), or a direct database connection via `SUPABASE_DB_URL` / `NEXT_PUBLIC_SUPABASE_CONNSTR` (fallback when no service-role API key is configured; also Supabase's recommended transport for bulk loads). Both are semantically identical; chunks are kept small because some TLS-inspecting networks drop large Postgres messages.
- `--approve` flips drafts to `approved` with a `reviewedAt` timestamp. Only use it after editorial review — if no human reviewed a batch, documentation and UI must not claim one did. (The 192-block fixture bank was hand-authored and reviewed in Milestones 1–4; its 2026-10-24 import to the production Supabase project used `--approve` on that basis.)

## Variety measurement

`content:coverage` enumerates tag-compatible selections per scope (capped at 20,000; capped counts are reported as conservative lower bounds, never raw Cartesian products). Fixture bank: **192/192 scopes supported, 72 valid combinations each** — sufficient for development, below the 1,000/scope production target; grow the bank with `content:generate --variants N` per sign. The same report run against the production Supabase database on 2026-10-24: **192/192 scopes supported, 0 missing, 0 duplicate hashes** (snapshot: `docs/reports/coverage-supabase-2026-10-24.json`).

## Versioning & reproducibility

Every block carries `contentVersion` (bank generation), `promptVersion`, and `sourceModel`. `compositionId` fingerprints the selected block ids + content versions, so a reading can be reproduced exactly for QA. Batches are tracked in `content_batches` when imported to Supabase.
