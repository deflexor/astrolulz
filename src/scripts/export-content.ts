import path from 'node:path';
import { locales } from '@/lib/i18n/locales';
import { parseArgs, writeJsonlFile } from './lib/cli';

/**
 * Exports the Supabase content bank to local JSONL snapshots (spec §7.6) so
 * the bank is portable and can be re-imported elsewhere.
 *
 *   npm run content:export -- [--locale en,ru] [--out content-export]
 */
async function main(): Promise<void> {
  const { values } = parseArgs(process.argv.slice(2));
  const requested = (values.get('locale') ?? locales.join(',')).split(',').map((l) => l.trim());
  const outDir = values.get('out') ?? 'content-export';

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error(
      'Export requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (server-side only).',
    );
    process.exit(1);
  }
  const { createClient } = await import('@supabase/supabase-js');
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  for (const locale of requested) {
    const { data, error } = await client
      .from('content_blocks')
      .select('*')
      .eq('locale', locale)
      .order('id')
      .limit(50_000);
    if (error) {
      console.error(`Export failed for ${locale}: ${error.message}`);
      process.exit(1);
    }
    const file = path.join(outDir, `${locale}.jsonl`);
    writeJsonlFile(file, data ?? []);
    console.log(`${locale}: exported ${data?.length ?? 0} rows → ${file}`);
  }
}

main();
