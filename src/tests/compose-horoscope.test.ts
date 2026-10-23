import { describe, expect, it } from 'vitest';
import { composeHoroscope, type CompositionRequest } from '@/lib/content/composeHoroscope';
import type { ApprovedContentBlock, ContentBlock } from '@/lib/content/contentSchema';

/** Deterministic test-pool builder. */
let counter = 0;
function block(
  overrides: Partial<ContentBlock> & Pick<ContentBlock, 'slot'>,
): ApprovedContentBlock {
  counter += 1;
  return {
    id: `b${counter}`,
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
  } as ApprovedContentBlock;
}

function basePool(): ApprovedContentBlock[] {
  return [
    // Arc "en-aries-a": coherent story, overview refuses bold companions.
    block({ slot: 'title', body: 'First Title', id: 'title-1' }),
    block({ slot: 'title', body: 'Second Title', id: 'title-2' }),
    block({ slot: 'overview', excludedTags: ['bold'], id: 'overview-1' }),
    block({ slot: 'focus', theme: 'general', id: 'focus-1' }),
    block({ slot: 'work', theme: 'work', id: 'work-1' }), // wrong theme for 'general' scope
    // Free pool.
    block({
      slot: 'opening',
      signId: null,
      narrativeArcId: null,
      tags: ['warm'],
      id: 'opening-warm',
    }),
    block({
      slot: 'opening',
      signId: null,
      narrativeArcId: null,
      tags: ['bold'],
      id: 'opening-bold',
    }),
    block({
      slot: 'opening',
      signId: null,
      narrativeArcId: null,
      tags: ['calm'],
      id: 'opening-calm',
    }),
    block({ slot: 'reflection_prompt', signId: null, narrativeArcId: null, id: 'reflection-1' }),
    block({ slot: 'reflection_prompt', signId: null, narrativeArcId: null, id: 'reflection-2' }),
    block({ slot: 'closing', signId: null, narrativeArcId: null, id: 'closing-1' }),
    block({ slot: 'closing', signId: null, narrativeArcId: null, id: 'closing-2' }),
    // Contaminants the engine must never select.
    block({ slot: 'title', status: 'draft', id: 'draft-title' }),
    block({ slot: 'title', locale: 'ru', id: 'ru-title' }),
    block({ slot: 'title', signId: 'taurus', id: 'taurus-title' }),
    block({ slot: 'overview', period: 'weekly', id: 'weekly-overview' }), // wrong period for 'daily'
  ];
}

const request = (overrides: Partial<CompositionRequest> = {}): CompositionRequest => ({
  locale: 'en',
  signId: 'aries',
  period: 'daily',
  theme: 'general',
  blocks: basePool(),
  ...overrides,
});

describe('composeHoroscope', () => {
  it('assembles a result with every slot from one coherent arc', () => {
    const result = composeHoroscope(request({ seed: 's1' }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const arcIds = new Set(
      [result.selected.title, result.selected.overview, result.selected.themeBody].map(
        (b) => b.narrativeArcId,
      ),
    );
    expect(arcIds.size).toBe(1);
    expect(result.selected.themeBody.slot).toBe('focus');
    expect(result.selected.opening.slot).toBe('opening');
    expect(result.selected.reflectionPrompt.slot).toBe('reflection_prompt');
    expect(result.selected.closing.slot).toBe('closing');
    expect(result.contentVersion).toBe('t1');
  });

  it('never selects draft, wrong-locale, wrong-sign, or wrong-scope blocks', () => {
    for (let i = 0; i < 50; i++) {
      const result = composeHoroscope(request({ seed: `scope-${i}` }));
      expect(result.ok).toBe(true);
      if (!result.ok) continue;
      const ids = Object.values(result.selected).map((b) => b.id);
      for (const id of ids) {
        expect([
          'draft-title',
          'ru-title',
          'taurus-title',
          'weekly-overview',
          'work-1',
        ]).not.toContain(id);
        expect(ids.filter((x) => x === id).length).toBe(1);
      }
    }
  });

  it('respects excludedTags across many seeds', () => {
    // overview-1 excludes 'bold'; opening-bold must therefore never be picked.
    for (let i = 0; i < 200; i++) {
      const result = composeHoroscope(request({ seed: `tags-${i}` }));
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.selected.opening.id).not.toBe('opening-bold');
    }
  });

  it('is deterministic for an identical pool and seed', () => {
    const first = composeHoroscope(request({ seed: 'determinism' }));
    if (!first.ok) throw new Error('expected success');
    for (let i = 0; i < 5; i++) {
      const repeat = composeHoroscope(request({ seed: 'determinism' }));
      if (!repeat.ok) throw new Error('expected success');
      expect(repeat.compositionId).toBe(first.compositionId);
      expect(repeat.selected.title.id).toBe(first.selected.title.id);
    }
  });

  it('produces meaningful variety across seeds', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 60; i++) {
      const result = composeHoroscope(request({ seed: `variety-${i}` }));
      if (result.ok) ids.add(result.compositionId);
    }
    // Pool admits 2 titles × 2 viable openings × 2 reflections × 2 closings = 16.
    expect(ids.size).toBeGreaterThanOrEqual(8);
  });

  it('prefers an unseen composition when one exists (repetition avoidance)', () => {
    const first = composeHoroscope(request({ seed: 'repeat-1' }));
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const second = composeHoroscope(
      request({ seed: 'repeat-1', recentCompositionIds: [first.compositionId] }),
    );
    expect(second.ok).toBe(true);
    if (second.ok) {
      expect(second.compositionId).not.toBe(first.compositionId);
      expect(second.repeated).toBe(false);
    }
  });

  it('reports repeated=true when every valid combination was seen recently', () => {
    const allIds = new Set<string>();
    for (let i = 0; i < 400; i++) {
      const result = composeHoroscope(request({ seed: `exhaust-${i}` }));
      if (result.ok) allIds.add(result.compositionId);
    }
    expect(allIds.size).toBeGreaterThan(1);
    const exhausted = composeHoroscope(
      request({ seed: 'exhaust-final', recentCompositionIds: [...allIds] }),
    );
    expect(exhausted.ok).toBe(true);
    if (exhausted.ok) {
      expect(exhausted.repeated).toBe(true);
      expect(allIds.has(exhausted.compositionId)).toBe(true);
    }
  });

  it('fails with a typed insufficient-content error when a required slot is missing', () => {
    const pool = basePool().filter((b) => b.slot !== 'closing');
    const result = composeHoroscope(request({ blocks: pool, seed: 'missing' }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('insufficient-content');
    expect(result.missingSlots).toContain('closing');
  });

  it('terminates with a typed failure on tag-deadlocked pools', () => {
    const pool = basePool().map((b) =>
      b.slot === 'overview' ? { ...b, excludedTags: ['warm', 'bold', 'calm'] } : b,
    );
    const result = composeHoroscope(request({ blocks: pool, seed: 'deadlock' }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('insufficient-content');
  });

  it('computes stable composition IDs from selected blocks and versions', () => {
    const first = composeHoroscope(request({ seed: 'id-check' }));
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const recombined = composeHoroscope(
      request({
        seed: 'id-check-2',
        blocks: basePool().map((b) => (b.id === 'title-1' ? { ...b, contentVersion: 't2' } : b)),
      }),
    );
    // Same block selection under a different content version yields a different fingerprint.
    if (recombined.ok && recombined.selected.title.id === first.selected.title.id) {
      expect(recombined.compositionId === first.compositionId).toBe(
        recombined.contentVersion === first.contentVersion,
      );
    }
  });
});
