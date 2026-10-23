import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  canonicalBlockContent,
  contentBlockSchema,
  type ContentBlock,
} from '@/lib/content/contentSchema';
import { FixtureContentRepository } from '@/lib/content/repository';
import { buildCoverageReport } from '@/lib/content/coverageReport';

const fixturesDir = path.join(process.cwd(), 'fixtures', 'content');

function loadFixtureBlocks(): ContentBlock[] {
  const blocks: ContentBlock[] = [];
  for (const file of fs.readdirSync(fixturesDir).filter((f) => f.endsWith('.jsonl'))) {
    for (const line of fs.readFileSync(path.join(fixturesDir, file), 'utf8').split(/\r?\n/)) {
      if (!line.trim()) continue;
      const parsed = contentBlockSchema.safeParse(JSON.parse(line));
      expect(
        parsed.success,
        `${file}: ${parsed.success ? '' : parsed.error.issues[0]?.message}`,
      ).toBe(true);
      if (parsed.success) blocks.push(parsed.data);
    }
  }
  return blocks;
}

describe('development content fixtures', () => {
  const blocks = loadFixtureBlocks();

  it('contains blocks for every locale, all approved', () => {
    expect(blocks.length).toBeGreaterThan(0);
    for (const block of blocks) {
      expect(block.status).toBe('approved');
      expect(['en', 'ru']).toContain(block.locale);
    }
    expect(new Set(blocks.map((b) => b.locale))).toEqual(new Set(['en', 'ru']));
  });

  it('has unique IDs and unique content hashes', () => {
    expect(new Set(blocks.map((b) => b.id)).size).toBe(blocks.length);
    expect(new Set(blocks.map((b) => b.contentHash)).size).toBe(blocks.length);
  });

  it('carries real SHA-256 hashes of the canonical content', () => {
    for (const block of blocks) {
      const computed = createHash('sha256')
        .update(canonicalBlockContent(block), 'utf8')
        .digest('hex');
      expect(computed, `hash mismatch for ${block.id}`).toBe(block.contentHash);
    }
  });

  it('covers every locale × sign × period × theme scope with a complete arc', () => {
    const report = buildCoverageReport(blocks);
    expect(report.summary.totalScopes).toBe(2 * 12 * 2 * 4);
    expect(report.summary.supportedScopes).toBe(report.summary.totalScopes);
    expect(report.summary.missingScopes).toBe(0);
    expect(report.duplicateHashes).toEqual([]);
    for (const scope of report.scopes) {
      expect(
        scope.validCombinations,
        `${scope.locale}/${scope.signId}/${scope.period}/${scope.theme}`,
      ).toBeGreaterThan(0);
      expect(scope.atLeast).toBe(false);
    }
  });

  it('loads through the fixture repository and returns eligible pools per request', async () => {
    const repository = new FixtureContentRepository(fixturesDir);
    const pool = await repository.getEligibleBlocks({
      locale: 'ru',
      signId: 'scorpio',
      period: 'weekly',
      theme: 'relationships',
      recentCompositionIds: [],
      timeZone: 'UTC',
    });
    expect(pool.length).toBeGreaterThan(0);
    const slots = new Set(pool.map((b) => b.slot));
    expect(slots.has('title')).toBe(true);
    expect(slots.has('overview')).toBe(true);
    expect(slots.has('relationships')).toBe(true);
    expect(slots.has('opening')).toBe(true);
    expect(slots.has('reflection_prompt')).toBe(true);
    expect(slots.has('closing')).toBe(true);
    for (const block of pool) {
      expect(block.locale).toBe('ru');
      expect(block.status).toBe('approved');
    }
  });
});
