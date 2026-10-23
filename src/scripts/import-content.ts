import path from 'node:path';
import { contentBlockSchema, type ContentBlock } from '@/lib/content/contentSchema';
import { parseArgs, readJsonlFile, writeJsonlFile } from './lib/cli';

/**
 * Imports a validated batch into the content bank (spec §7.6).
 *
 *   npm run content:import -- --input <file>[,<file>] [--approve] [--into fixtures|supabase]
 *
 * Idempotent in both modes: existing IDs are skipped, never duplicated.
 * `--approve` marks imported drafts as approved (with reviewedAt) — only use
 * it after editorial review; documentation must not claim review otherwise.
 */

async function main(): Promise<void> {
  const { flags, values } = parseArgs(process.argv.slice(2));
  const input = values.get('input');
  const target = values.get('into') ?? 'fixtures';
  const approve = flags.has('approve');

  if (!input) {
    console.error('--input is required (one or more .jsonl files, comma-separated)');
    process.exit(1);
  }

  const incoming: ContentBlock[] = [];
  for (const file of input
    .split(',')
    .map((f) => f.trim())
    .filter(Boolean)) {
    for (const [index, record] of readJsonlFile(file).entries()) {
      const result = contentBlockSchema.safeParse(record);
      if (!result.success) {
        console.error(
          `${file}#${index + 1}: invalid record (${result.error.issues[0]?.message}) — aborting import`,
        );
        process.exit(1);
      }
      incoming.push(result.data);
    }
  }

  const prepared = incoming.map((block) =>
    approve && block.status === 'draft'
      ? { ...block, status: 'approved' as const, reviewedAt: new Date().toISOString() }
      : block,
  );

  if (target === 'fixtures') {
    await importIntoFixtures(prepared);
  } else {
    await importIntoSupabase(prepared);
  }
}

async function importIntoFixtures(blocks: ContentBlock[]): Promise<void> {
  const byLocale = new Map<string, ContentBlock[]>();
  for (const block of blocks)
    byLocale.set(block.locale, [...(byLocale.get(block.locale) ?? []), block]);

  let inserted = 0;
  let skipped = 0;
  for (const [locale, localeBlocks] of byLocale) {
    const fixtureFile = path.join(process.cwd(), 'fixtures', 'content', `${locale}.jsonl`);
    const existing: ContentBlock[] = readJsonlFileSafe(fixtureFile);
    const existingIds = new Set(existing.map((b) => b.id));
    const fresh = localeBlocks.filter((b) => !existingIds.has(b.id));
    existing.push(...fresh);
    writeJsonlFile(fixtureFile, existing);
    inserted += fresh.length;
    skipped += localeBlocks.length - fresh.length;
  }
  console.log(`Fixtures import: ${inserted} inserted, ${skipped} skipped (existing ids).`);
}

async function importIntoSupabase(blocks: ContentBlock[]): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error(
      'Supabase import requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (server-side only).',
    );
    process.exit(1);
  }
  const { createClient } = await import('@supabase/supabase-js');
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const rows = blocks.map(toRow);
  let inserted = 0;
  for (let i = 0; i < rows.length; i += 100) {
    const chunk = rows.slice(i, i + 100);
    const { data, error } = await client
      .from('content_blocks')
      .upsert(chunk, { onConflict: 'id', ignoreDuplicates: true })
      .select('id');
    if (error) {
      console.error(`Supabase import failed at chunk ${i / 100 + 1}: ${error.message}`);
      process.exit(1);
    }
    inserted += data?.length ?? 0;
  }
  console.log(
    `Supabase import: ${inserted} inserted, ${rows.length - inserted} skipped (existing ids).`,
  );
}

function toRow(block: ContentBlock): Record<string, unknown> {
  return {
    id: block.id,
    locale: block.locale,
    sign_id: block.signId,
    period: block.period,
    theme: block.theme,
    slot: block.slot,
    narrative_arc_id: block.narrativeArcId,
    variant_group: block.variantGroup ?? null,
    title: block.title ?? null,
    body: block.body,
    tags: block.tags,
    excluded_tags: block.excludedTags,
    weight: block.weight,
    content_hash: block.contentHash,
    content_version: block.contentVersion,
    prompt_version: block.promptVersion ?? null,
    source_model: block.sourceModel ?? null,
    status: block.status,
    created_at: block.createdAt,
    reviewed_at: block.reviewedAt ?? null,
  };
}

function readJsonlFileSafe(filePath: string): ContentBlock[] {
  try {
    return readJsonlFile(filePath) as ContentBlock[];
  } catch {
    return [];
  }
}

main();
