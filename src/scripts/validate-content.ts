import { contentBlockSchema, type ContentBlock } from '@/lib/content/contentSchema';
import { parseArgs, readJsonlFile } from './lib/cli';

/**
 * Content QA gate (spec §7.9): validates generated/import batches before they
 * can reach the content bank.
 *
 *   npm run content:validate -- --input content-out/<batch>/en-aries.jsonl[,more files]
 *
 * Errors (schema violations, exact duplicates, unknown values) fail the run;
 * near-duplicate warnings are reported for human judgment.
 */

const NEAR_DUPLICATE_THRESHOLD = 0.85;

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function trigrams(text: string): Set<string> {
  const normalized = ` ${normalize(text)} `;
  const grams = new Set<string>();
  for (let i = 0; i + 3 <= normalized.length; i++) {
    grams.add(normalized.slice(i, i + 3));
  }
  return grams;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const gram of a) if (b.has(gram)) intersection += 1;
  return intersection / (a.size + b.size - intersection);
}

async function main(): Promise<void> {
  const { values } = parseArgs(process.argv.slice(2));
  const input = values.get('input');
  if (!input) {
    console.error('--input is required (one or more .jsonl files, comma-separated)');
    process.exit(1);
  }
  const files = input
    .split(',')
    .map((f) => f.trim())
    .filter(Boolean);

  const errors: string[] = [];
  const warnings: string[] = [];
  const byHash = new Map<string, string[]>();
  const byBody = new Map<string, string[]>();
  const valid: Array<{ block: ContentBlock; file: string }> = [];
  const slotCounts = new Map<string, number>();
  const localeCounts = new Map<string, number>();

  for (const file of files) {
    let records: unknown[];
    try {
      records = readJsonlFile(file);
    } catch (error) {
      errors.push(`${file}: unreadable — ${error instanceof Error ? error.message : error}`);
      continue;
    }
    for (let i = 0; i < records.length; i++) {
      const result = contentBlockSchema.safeParse(records[i]);
      if (!result.success) {
        errors.push(
          `${file}#${i + 1}: schema — ${result.error.issues[0]?.path.join('.')}: ${result.error.issues[0]?.message}`,
        );
        continue;
      }
      const block = result.data;
      valid.push({ block, file });
      slotCounts.set(block.slot, (slotCounts.get(block.slot) ?? 0) + 1);
      localeCounts.set(block.locale, (localeCounts.get(block.locale) ?? 0) + 1);
      byHash.set(block.contentHash, [...(byHash.get(block.contentHash) ?? []), block.id]);
      const bodyKey = `${block.locale}|${normalize(block.body)}`;
      byBody.set(bodyKey, [...(byBody.get(bodyKey) ?? []), block.id]);
      if (block.slot === 'title' && block.body.length > 300) {
        errors.push(`${block.id}: title exceeds 300 characters`);
      }
    }
  }

  for (const [hash, ids] of byHash)
    if (ids.length > 1)
      errors.push(`duplicate contentHash ${hash.slice(0, 12)}…: ${ids.join(', ')}`);
  for (const [, ids] of byBody)
    if (ids.length > 1) errors.push(`duplicate body text: ${ids.join(', ')}`);

  // Near-duplicate detection across same locale+slot pairs.
  const grams = valid.map((entry) => ({ ...entry, grams: trigrams(entry.block.body) }));
  for (let i = 0; i < grams.length; i++) {
    for (let j = i + 1; j < grams.length; j++) {
      const a = grams[i];
      const b = grams[j];
      if (a.block.locale !== b.block.locale || a.block.slot !== b.block.slot) continue;
      const similarity = jaccard(a.grams, b.grams);
      if (similarity >= NEAR_DUPLICATE_THRESHOLD) {
        warnings.push(
          `near-duplicate (${(similarity * 100).toFixed(0)}%): ${a.block.id} ↔ ${b.block.id}`,
        );
      }
    }
  }

  console.log(`Validated ${valid.length} blocks from ${files.length} file(s).`);
  console.log(`By locale: ${[...localeCounts.entries()].map(([k, v]) => `${k}=${v}`).join(' ')}`);
  console.log(`By slot: ${[...slotCounts.entries()].map(([k, v]) => `${k}=${v}`).join(' ')}`);
  if (warnings.length) {
    console.log(`\nWarnings (${warnings.length}):`);
    warnings.forEach((w) => console.log(`  ⚠ ${w}`));
  }
  if (errors.length) {
    console.error(`\nErrors (${errors.length}):`);
    errors.forEach((e) => console.error(`  ✗ ${e}`));
    process.exit(1);
  }
  console.log('\nOK — batch is structurally valid.');
}

main();
