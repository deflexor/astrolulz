import { describe, expect, it } from 'vitest';
import { buildCoverageReport } from '@/lib/content/coverageReport';
import type { ContentBlock } from '@/lib/content/contentSchema';

let counter = 0;
function block(overrides: Partial<ContentBlock> & Pick<ContentBlock, 'slot'>): ContentBlock {
  counter += 1;
  return {
    id: `c${counter}`,
    locale: 'en',
    signId: 'aries',
    period: 'any',
    theme: 'any',
    narrativeArcId: 'en-aries-a',
    variantGroup: null,
    body: `body-${counter}`,
    title: null,
    tags: [],
    excludedTags: [],
    weight: 50,
    contentHash: counter.toString(16).padStart(64, '0'),
    contentVersion: 't1',
    status: 'approved',
    createdAt: '2026-10-23T00:00:00.000Z',
    ...overrides,
  } as ContentBlock;
}

/** Minimal healthy bank for one sign: 1 arc (title/overview/body) + free slots. */
function healthyBank(): ContentBlock[] {
  return [
    block({ slot: 'title' }),
    block({ slot: 'overview', excludedTags: ['bold'] }),
    block({ slot: 'focus', theme: 'general' }),
    block({ slot: 'relationships', theme: 'relationships' }),
    block({ slot: 'work', theme: 'work' }),
    block({ slot: 'growth', theme: 'growth' }),
    block({ slot: 'opening', signId: null, narrativeArcId: null, tags: ['warm'] }),
    block({ slot: 'opening', signId: null, narrativeArcId: null, tags: ['bold'] }),
    block({ slot: 'reflection_prompt', signId: null, narrativeArcId: null }),
    block({ slot: 'closing', signId: null, narrativeArcId: null }),
  ];
}

describe('coverage report', () => {
  it('flags scopes with missing required slots', () => {
    const bank = healthyBank().filter((b) => b.slot !== 'relationships');
    const report = buildCoverageReport(bank);
    const broken = report.scopes.find(
      (s) =>
        s.locale === 'en' &&
        s.signId === 'aries' &&
        s.theme === 'relationships' &&
        s.period === 'daily',
    );
    expect(broken).toBeDefined();
    expect(broken!.missingSlots).toContain('relationships');
    expect(broken!.validCombinations).toBe(0);
    // Other themes for this sign remain supported.
    const general = report.scopes.find(
      (s) =>
        s.signId === 'aries' && s.theme === 'general' && s.period === 'daily' && s.locale === 'en',
    );
    expect(general!.validCombinations).toBeGreaterThan(0);
  });

  it('counts only tag-compatible combinations, not raw Cartesian products', () => {
    // overview excludes 'bold' → only the 'warm' opening is valid: 1 combination, not 2.
    const report = buildCoverageReport(healthyBank());
    const scope = report.scopes.find(
      (s) =>
        s.locale === 'en' && s.signId === 'aries' && s.period === 'daily' && s.theme === 'general',
    );
    expect(scope!.validCombinations).toBe(1);
  });

  it('reports duplicate hashes across the bank', () => {
    const bank = healthyBank();
    bank.push({ ...bank[0], id: 'duplicate-title' });
    const report = buildCoverageReport(bank);
    expect(report.duplicateHashes).toHaveLength(1);
    expect(report.duplicateHashes[0].ids).toContain('duplicate-title');
  });

  it('summarizes supported vs missing scopes across the whole matrix', () => {
    const report = buildCoverageReport(healthyBank());
    expect(report.summary.totalScopes).toBe(2 * 12 * 2 * 4);
    // Only this sign/locale is covered; everything else is missing.
    const supportedForAriesEn = 2 * 4; // periods × themes
    expect(report.summary.supportedScopes).toBe(supportedForAriesEn);
    expect(report.summary.missingScopes).toBe(report.summary.totalScopes - supportedForAriesEn);
  });
});
