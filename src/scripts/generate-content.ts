import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { ZODIAC_SIGN_IDS, isZodiacSignId, type ZodiacSignId } from '@/lib/astrology/zodiacSigns';
import { canonicalBlockContent, type ContentBlock } from '@/lib/content/contentSchema';
import { createProviderFromEnv, PROMPT_VERSION, type AiProvider } from '@/lib/content/provider';
import { isLocale, locales, type Locale } from '@/lib/i18n/locales';
import { parseArgs, writeJsonlFile } from './lib/cli';

/**
 * Batch AI content generation (spec §7.1, Milestone 3).
 *
 * Examples:
 *   npm run content:generate -- --locale en --signs aries,taurus --variants 3
 *   npm run content:generate -- --locale ru --signs all --dry-run
 *   npm run content:generate -- --locale en --signs aries --mock --out content-out
 *
 * Writes DRAFT blocks to local JSONL artifacts for review/validation before
 * import. Supports dry-run, bounded batches (--signs/--variants), retry, and
 * resume (skips signs whose artifact already exists unless --force).
 * This script is the ONLY place the AI provider is called.
 */

const ARCS: Array<{
  slot: ContentBlock['slot'];
  theme: 'general' | 'relationships' | 'work' | 'growth' | 'any';
}> = [
  { slot: 'title', theme: 'any' },
  { slot: 'overview', theme: 'any' },
  { slot: 'focus', theme: 'general' },
  { slot: 'relationships', theme: 'relationships' },
  { slot: 'work', theme: 'work' },
  { slot: 'growth', theme: 'growth' },
];

const RETRIES = 3;

async function main(): Promise<void> {
  const { flags, values } = parseArgs(process.argv.slice(2));

  const localeArg = values.get('locale');
  if (!localeArg || !isLocale(localeArg)) {
    fail(`--locale is required and must be one of: ${locales.join(', ')}`);
  }
  const locale = localeArg as Locale;

  const signsArg = values.get('signs') ?? 'all';
  const signs: ZodiacSignId[] =
    signsArg === 'all'
      ? [...ZODIAC_SIGN_IDS]
      : signsArg
          .split(',')
          .map((s) => s.trim())
          .filter(isZodiacSignId);

  const variants = Math.max(1, Math.min(6, Number(values.get('variants') ?? 2)));
  const outDir =
    values.get('out') ?? path.join('content-out', values.get('batch-id') ?? defaultBatchId());
  const contentVersion = values.get('content-version') ?? 'bank-v1';
  const dryRun = flags.has('dry-run');
  const mock = flags.has('mock');
  const resume = flags.has('resume') && !flags.has('force');

  const perSignBlocks = signs.length * ARCS.length * variants;
  console.log(`Plan: locale=${locale} signs=${signs.length} variants(signs→arcs)=${variants}`);
  console.log(`Would write ~${perSignBlocks} draft blocks to ${outDir}/`);

  if (dryRun) {
    console.log('Dry run: no provider calls, no files written.');
    return;
  }

  const provider = createProviderFromEnv(process.env, mock);
  if (!mock && !process.env.AI_PROVIDER_API_KEY) {
    fail('AI_PROVIDER_API_KEY is required unless --mock or --dry-run is used.');
  }

  const totalUsage = { inputTokens: 0, outputTokens: 0 };
  let written = 0;

  for (const signId of signs) {
    const artifact = path.join(outDir, `${locale}-${signId}.jsonl`);
    if (resume && fileExists(artifact)) {
      console.log(`resume: skip ${artifact} (already exists)`);
      continue;
    }
    const blocks = await generateForSign(provider, { locale, signId, variants, contentVersion });
    writeJsonlFile(artifact, blocks);
    written += blocks.length;
    console.log(`wrote ${blocks.length} drafts → ${artifact}`);
  }

  console.log(`Done. ${written} draft blocks. Usage: ${JSON.stringify(totalUsage)}.`);
  console.log(
    'Next: npm run content:validate -- --input <artifact> && npm run content:import -- --input <artifact> --approve',
  );

  async function generateForSign(
    prov: AiProvider,
    ctx: { locale: Locale; signId: ZodiacSignId; variants: number; contentVersion: string },
  ): Promise<ContentBlock[]> {
    let lastError: unknown = null;
    for (let attempt = 1; attempt <= RETRIES; attempt++) {
      try {
        const result = await prov.generateBatch({
          locale: ctx.locale,
          signId: ctx.signId,
          slots: ARCS.map((arc) => ({ slot: arc.slot, theme: arc.theme, count: ctx.variants })),
        });
        totalUsage.inputTokens += result.usage?.inputTokens ?? 0;
        totalUsage.outputTokens += result.usage?.outputTokens ?? 0;
        return toBlocks(result.candidates, ctx, result.model);
      } catch (error) {
        lastError = error;
        console.warn(`attempt ${attempt}/${RETRIES} failed for ${ctx.signId}: ${String(error)}`);
        await new Promise((resolve) => setTimeout(resolve, attempt * 1500));
      }
    }
    throw lastError instanceof Error ? lastError : new Error(String(lastError));
  }
}

function toBlocks(
  candidates: Array<{ slot: string; body: string }>,
  ctx: { locale: Locale; signId: ZodiacSignId; variants: number; contentVersion: string },
  model: string,
): ContentBlock[] {
  const perSlotIndex = new Map<string, number>();
  const now = new Date().toISOString();
  const blocks: ContentBlock[] = [];

  for (const candidate of candidates) {
    const arcDef = ARCS.find((arc) => arc.slot === candidate.slot);
    if (!arcDef) {
      console.warn(`skipping unknown slot "${candidate.slot}"`);
      continue;
    }
    const index = perSlotIndex.get(candidate.slot) ?? 0;
    perSlotIndex.set(candidate.slot, index + 1);
    const arcNo = (index % ctx.variants) + 1;
    const arcId = `${ctx.locale}-${ctx.signId}-g${arcNo}`;
    const block: ContentBlock = {
      id: `${ctx.locale}-${ctx.signId}-${candidate.slot}-${arcNo}-${ctx.contentVersion}`,
      locale: ctx.locale,
      signId: ctx.signId,
      period: 'any',
      theme: arcDef.theme,
      slot: candidate.slot as ContentBlock['slot'],
      narrativeArcId: arcId,
      variantGroup: `${arcId}:${candidate.slot}`,
      body: candidate.body.slice(0, 2000),
      title: null,
      tags: [],
      excludedTags: [],
      weight: 50,
      contentHash: '',
      contentVersion: ctx.contentVersion,
      promptVersion: PROMPT_VERSION,
      sourceModel: model,
      status: 'draft',
      createdAt: now,
      reviewedAt: null,
    };
    block.contentHash = createHash('sha256')
      .update(canonicalBlockContent(block), 'utf8')
      .digest('hex');
    blocks.push(block);
  }
  return blocks;
}

function fileExists(filePath: string): boolean {
  return fs.existsSync(filePath);
}

function defaultBatchId(): string {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 17);
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
