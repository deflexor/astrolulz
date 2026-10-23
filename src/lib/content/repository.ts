import fs from 'node:fs';
import path from 'node:path';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { HoroscopePeriod, HoroscopeTheme } from '@/lib/astrology/scopes';
import { THEME_BODY_SLOT } from '@/lib/astrology/scopes';
import type { Locale } from '@/lib/i18n/locales';
import type { ApprovedContentBlock, ContentBlock, ContentSlot } from '@/lib/content/contentSchema';
import { parseContentBlock } from '@/lib/content/contentSchema';
import type { ValidatedHoroscopeRequest } from '@/lib/validation/horoscopeRequest';

function isApprovedBlock(block: ContentBlock): block is ApprovedContentBlock {
  return block.status === 'approved';
}

/**
 * Repository boundary between storage and the pure composition engine
 * (spec §11.1). Implementations load an eligible, approved pool for one
 * validated request scope; the engine never talks to Supabase or fixtures.
 */
export interface HoroscopeContentRepository {
  getEligibleBlocks(request: ValidatedHoroscopeRequest): Promise<ApprovedContentBlock[]>;
}

/** Slots the engine can select for a given theme (arc-bound + free). */
export function slotsForTheme(theme: HoroscopeTheme): ContentSlot[] {
  return ['title', 'overview', THEME_BODY_SLOT[theme], 'opening', 'reflection_prompt', 'closing'];
}

export function blockMatchesScope(
  block: ContentBlock,
  scope: { locale: Locale; signId: string; period: HoroscopePeriod; theme: HoroscopeTheme },
): boolean {
  const periodOk = block.period === 'any' || block.period === scope.period;
  const themeOk = block.theme === 'any' || block.theme === scope.theme;
  return (
    block.status === 'approved' &&
    block.locale === scope.locale &&
    (block.signId === scope.signId || block.signId === null) &&
    periodOk &&
    themeOk
  );
}

// ---------------------------------------------------------------------------
// Fixture-backed repository (local development, tests, offline demo)
// ---------------------------------------------------------------------------

export class FixtureContentRepository implements HoroscopeContentRepository {
  private readonly fixturesDir: string;
  private cache: Map<Locale, ContentBlock[]> | null = null;

  constructor(fixturesDir = path.join(process.cwd(), 'fixtures', 'content')) {
    this.fixturesDir = fixturesDir;
  }

  /** Loads and validates every fixture file; throws on unreadable/corrupt input. */
  loadAll(): Map<Locale, ContentBlock[]> {
    if (this.cache) return this.cache;
    const byLocale = new Map<Locale, ContentBlock[]>();
    const files = fs.readdirSync(this.fixturesDir).filter((f) => f.endsWith('.jsonl'));
    for (const file of files) {
      const locale = path.basename(file, '.jsonl') as Locale;
      const lines = fs.readFileSync(path.join(this.fixturesDir, file), 'utf8').split(/\r?\n/);
      const blocks: ContentBlock[] = [];
      lines.forEach((line, index) => {
        if (!line.trim()) return;
        const parsed = parseContentBlock(JSON.parse(line));
        if (!parsed) throw new Error(`Invalid fixture block at ${file}:${index + 1}`);
        blocks.push(parsed);
      });
      if (byLocale.has(locale)) throw new Error(`Duplicate fixture locale file for ${locale}`);
      byLocale.set(locale, blocks);
    }
    this.cache = byLocale;
    return byLocale;
  }

  async getEligibleBlocks(request: ValidatedHoroscopeRequest): Promise<ApprovedContentBlock[]> {
    const pool = this.loadAll().get(request.locale) ?? [];
    const slots = new Set(slotsForTheme(request.theme));
    return pool
      .filter((block) => slots.has(block.slot) && blockMatchesScope(block, request))
      .filter(isApprovedBlock);
  }
}

// ---------------------------------------------------------------------------
// Supabase repository (production content bank, server-side only)
// ---------------------------------------------------------------------------

/** snake_case database row → camelCase ContentBlock. */
export function contentBlockFromRow(row: Record<string, unknown>): ContentBlock {
  const parsed = parseContentBlock({
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
  });
  if (!parsed) throw new Error(`Invalid content_blocks row: ${String(row.id)}`);
  return parsed;
}

export class SupabaseContentRepository implements HoroscopeContentRepository {
  private client: ReturnType<typeof createLazyClient>;

  constructor(
    private readonly url: string,
    private readonly serviceRoleKey: string,
  ) {
    this.client = createLazyClient(
      () => url,
      () => serviceRoleKey,
    );
  }

  async getEligibleBlocks(request: ValidatedHoroscopeRequest): Promise<ApprovedContentBlock[]> {
    const client = await this.client.get();
    const { data, error } = await client
      .from('content_blocks')
      .select('*')
      .eq('status', 'approved')
      .eq('locale', request.locale)
      .in('slot', slotsForTheme(request.theme))
      .in('period', [request.period, 'any'])
      .in('theme', [request.theme, 'any'])
      .or(`sign_id.eq.${request.signId},sign_id.is.null`)
      .order('id')
      .limit(2000);
    if (error) throw new Error(`Supabase query failed: ${error.message}`);
    return (data ?? [])
      .map((row) => contentBlockFromRow(row as Record<string, unknown>))
      .filter(isApprovedBlock);
  }
}

// Supabase is a server-only dependency; import it lazily so the fixture path
// (and any accidental client bundling) never needs the SDK.
function createLazyClient(resolveUrl: () => string, resolveKey: () => string) {
  let instance: SupabaseClient | null = null;
  return {
    async get(): Promise<SupabaseClient> {
      if (!instance) {
        const { createClient } = await import('@supabase/supabase-js');
        instance = createClient(resolveUrl(), resolveKey(), {
          auth: { persistSession: false, autoRefreshToken: false },
        });
      }
      return instance;
    },
  };
}

// ---------------------------------------------------------------------------
// Selection
// ---------------------------------------------------------------------------

export type ContentSource = 'fixtures' | 'supabase';

export function resolveContentSource(env: NodeJS.ProcessEnv = process.env): ContentSource {
  const explicit = env.CONTENT_SOURCE;
  if (explicit === 'fixtures' || explicit === 'supabase') return explicit;
  if (env.NEXT_PUBLIC_SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) return 'supabase';
  return 'fixtures';
}

/**
 * Builds the repository for the current environment. The Supabase service
 * role key bypasses RLS, so this factory — and anything using it — must only
 * ever run on the server (spec §9.2–9.3).
 */
export function createContentRepository(
  env: NodeJS.ProcessEnv = process.env,
): HoroscopeContentRepository {
  if (resolveContentSource(env) === 'supabase') {
    const url = env.NEXT_PUBLIC_SUPABASE_URL;
    const key = env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key)
      throw new Error(
        'Supabase content source requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY',
      );
    return new SupabaseContentRepository(url, key);
  }
  return new FixtureContentRepository();
}
