import fs from 'node:fs';
import path from 'node:path';
import { buildCoverageReport, VARIETY_TARGET_PER_SCOPE } from '@/lib/content/coverageReport';
import { contentBlockSchema, type ContentBlock } from '@/lib/content/contentSchema';
import { resolveContentSource } from '@/lib/content/repository';
import { parseArgs, readJsonlFile } from './lib/cli';

/**
 * Content-bank health report (spec FR-13, §7.5).
 *
 *   npm run content:coverage -- [--source fixtures|supabase] [--json out.json]
 *
 * Reports, per locale × sign × period × theme scope: complete narrative arcs,
 * pool sizes per slot, the exact number of valid (tag-compatible)
 * combinations — or a conservative lower bound when enumeration is capped —
 * and whether the variety target is met. Never counts raw Cartesian products
 * as valid variety.
 */
async function main(): Promise<void> {
  const { values } = parseArgs(process.argv.slice(2));
  const source =
    (values.get('source') as 'fixtures' | 'supabase' | undefined) ??
    resolveContentSource(process.env);

  let blocks: ContentBlock[];
  if (source === 'supabase') {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      console.error(
        '--source supabase requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.',
      );
      process.exit(1);
    }
    const { createClient } = await import('@supabase/supabase-js');
    const client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await client.from('content_blocks').select('*').limit(50_000);
    if (error) {
      console.error(`Supabase read failed: ${error.message}`);
      process.exit(1);
    }
    blocks = (data ?? []).map((row) => {
      const parsed = contentBlockSchema.safeParse(fromRow(row));
      if (!parsed.success)
        throw new Error(`Invalid row ${String(row.id)}: ${parsed.error.issues[0]?.message}`);
      return parsed.data;
    });
  } else {
    const dir = path.join(process.cwd(), 'fixtures', 'content');
    blocks = fs
      .readdirSync(dir)
      .filter((f) => f.endsWith('.jsonl'))
      .flatMap((f) => readJsonlFile(path.join(dir, f)) as ContentBlock[]);
  }

  const report = buildCoverageReport(blocks);

  console.log(
    `Source: ${source} | blocks: ${blocks.length} | target/scope: ${report.targetPerScope}`,
  );
  console.log(
    `Scopes: ${report.summary.supportedScopes}/${report.summary.totalScopes} supported, ` +
      `${report.summary.missingScopes} missing, ${report.summary.belowTargetScopes} below target\n`,
  );

  const rows = report.scopes.filter((s) => s.missingSlots.length > 0 || !s.meetsTarget);
  if (rows.length === 0) {
    console.log('All scopes meet the variety target.');
  } else {
    console.log('Scopes needing attention:');
    for (const row of rows.slice(0, 60)) {
      const status = row.missingSlots.length
        ? `MISSING [${row.missingSlots.join(',')}]`
        : `low variety`;
      console.log(
        `  ${row.locale}/${row.signId}/${row.period}/${row.theme}: ${status} — ` +
          `arcs=${row.completeArcs}, combos=${row.validCombinations}${row.atLeast ? '+' : ''}`,
      );
    }
    if (rows.length > 60) console.log(`  … and ${rows.length - 60} more`);
  }

  if (report.duplicateHashes.length) {
    console.log(`\nDuplicate hashes (${report.duplicateHashes.length}):`);
    report.duplicateHashes.forEach((dup) =>
      console.log(`  ${dup.hash.slice(0, 12)}…: ${dup.ids.join(', ')}`),
    );
  }

  const jsonOut = values.get('json');
  if (jsonOut) {
    fs.mkdirSync(path.dirname(path.resolve(jsonOut)), { recursive: true });
    fs.writeFileSync(jsonOut, JSON.stringify(report, null, 2), 'utf8');
    console.log(`\nFull report written to ${jsonOut}`);
  }

  const healthy = report.summary.missingScopes === 0 && report.duplicateHashes.length === 0;
  const meetsAllTargets = report.summary.belowTargetScopes === 0;
  if (!healthy) process.exit(1);
  if (!meetsAllTargets)
    console.log(
      `\nNote: ${report.summary.belowTargetScopes} scope(s) below the ${VARIETY_TARGET_PER_SCOPE}-combination target.`,
    );
}

function fromRow(row: Record<string, unknown>): Record<string, unknown> {
  return {
    id: row.id,
    locale: row.locale,
    signId: row.sign_id ?? null,
    period: row.period,
    theme: row.theme,
    slot: row.slot,
    narrativeArcId: row.narrative_arc_id ?? null,
    variantGroup: row.variant_group ?? null,
    body: row.body,
    title: row.title ?? null,
    tags: row.tags ?? [],
    excludedTags: row.excluded_tags ?? [],
    weight: row.weight ?? 50,
    contentHash: row.content_hash,
    contentVersion: row.content_version,
    promptVersion: row.prompt_version ?? null,
    sourceModel: row.source_model ?? null,
    status: row.status,
    createdAt: row.created_at,
    reviewedAt: row.reviewed_at ?? null,
  };
}

main();
