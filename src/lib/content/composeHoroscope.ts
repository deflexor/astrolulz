import { THEME_BODY_SLOT, type HoroscopePeriod, type HoroscopeTheme } from '@/lib/astrology/scopes';
import type { Locale } from '@/lib/i18n/locales';
import type { ZodiacSignId } from '@/lib/astrology/zodiacSigns';
import type { ApprovedContentBlock, ContentBlock, ContentSlot } from '@/lib/content/contentSchema';
import { stableId } from '@/lib/content/hash';
import { mulberry32, weightedPick, type Rng } from '@/lib/content/random';

function isApproved(block: ContentBlock): block is ApprovedContentBlock {
  return block.status === 'approved';
}

/**
 * Deterministic horoscope composition engine.
 *
 * Pure function: no React, no Supabase, no AI provider, no filesystem. The
 * repository loads an eligible pool; this module assembles a coherent result
 * from it. The same pool + seed always produce the same composition, which
 * makes variety, repetition avoidance, and failure paths testable.
 *
 * Two-stage algorithm (spec §7.4): choose a narrative arc that has eligible
 * blocks for every arc-bound slot, then choose compatible free-slot blocks
 * (opening, reflection prompt, closing) from the sign-agnostic pool.
 */

export type CompositionRequest = {
  locale: Locale;
  signId: ZodiacSignId;
  period: HoroscopePeriod;
  theme: HoroscopeTheme;
  /** Candidate pool; the engine re-validates status/locale/scope defensively. */
  blocks: readonly ContentBlock[];
  /** Composition fingerprints to avoid when a valid alternative exists. */
  recentCompositionIds?: readonly string[];
  /** Varies per request (server nonce); fixed in tests for determinism. */
  seed?: string;
};

export type SelectedSlots = {
  title: ApprovedContentBlock;
  opening: ApprovedContentBlock;
  overview: ApprovedContentBlock;
  themeBody: ApprovedContentBlock;
  reflectionPrompt: ApprovedContentBlock;
  closing: ApprovedContentBlock;
};

export type CompositionSuccess = {
  ok: true;
  compositionId: string;
  contentVersion: string;
  selected: SelectedSlots;
  /** True when every valid combination was already in `recentCompositionIds`. */
  repeated: boolean;
};

export type CompositionFailure = {
  ok: false;
  reason: 'insufficient-content';
  missingSlots: ContentSlot[];
  completeArcs: number;
  poolSize: number;
};

export type CompositionResult = CompositionSuccess | CompositionFailure;

/** Bounded attempts before giving up on an unseen combination (spec §7.4 step 11). */
const MAX_ATTEMPTS = 32;

function scopeMatches(
  block: ApprovedContentBlock,
  req: { period: HoroscopePeriod; theme: HoroscopeTheme },
): boolean {
  const periodOk = block.period === 'any' || block.period === req.period;
  const themeOk = block.theme === 'any' || block.theme === req.theme;
  return periodOk && themeOk;
}

function tagsCompatible(a: ApprovedContentBlock, b: ApprovedContentBlock): boolean {
  if (a.id === b.id) return false;
  const aExcludesB = a.excludedTags.some((tag) => b.tags.includes(tag));
  const bExcludesA = b.excludedTags.some((tag) => a.tags.includes(tag));
  return !aExcludesB && !bExcludesA;
}

function compatibleWithAll(
  candidate: ApprovedContentBlock,
  picked: readonly ApprovedContentBlock[],
): boolean {
  return picked.every((p) => tagsCompatible(p, candidate));
}

export function composeHoroscope(request: CompositionRequest): CompositionResult {
  const { locale, signId, period, theme } = request;
  const themeBodySlot = THEME_BODY_SLOT[theme];
  const arcSlots: readonly ContentSlot[] = ['title', 'overview', themeBodySlot];
  const recent = new Set(request.recentCompositionIds ?? []);

  // Defensive pool filter: only approved blocks in the exact requested locale
  // and scope ever reach selection (spec §7.2: never silently swap locale).
  const eligible = request.blocks
    .filter((block) => isApproved(block))
    .filter(
      (block) =>
        block.locale === locale &&
        (block.signId === signId || block.signId === null) &&
        scopeMatches(block, { period, theme }),
    );

  // Group sign-specific, arc-bound blocks by narrative arc.
  const arcs = new Map<string, Map<ContentSlot, ApprovedContentBlock[]>>();
  for (const block of eligible) {
    if (block.signId !== signId || block.narrativeArcId === null) continue;
    if (!arcSlots.includes(block.slot)) continue;
    let bySlot = arcs.get(block.narrativeArcId);
    if (!bySlot) {
      bySlot = new Map();
      arcs.set(block.narrativeArcId, bySlot);
    }
    const list = bySlot.get(block.slot) ?? [];
    list.push(block);
    bySlot.set(block.slot, list);
  }

  const completeArcs = [...arcs.entries()].filter(([, bySlot]) =>
    arcSlots.every((slot) => (bySlot.get(slot)?.length ?? 0) > 0),
  );

  if (completeArcs.length === 0) {
    const missingSlots = arcSlots.filter(
      (slot) => !eligible.some((b) => b.signId === signId && b.slot === slot),
    );
    return {
      ok: false,
      reason: 'insufficient-content',
      missingSlots,
      completeArcs: 0,
      poolSize: eligible.length,
    };
  }

  const freePool = (slot: ContentSlot) =>
    eligible.filter((b) => b.slot === slot && b.narrativeArcId === null);
  const pickWeighted = (rng: Rng, candidates: ApprovedContentBlock[]): ApprovedContentBlock =>
    weightedPick(rng, candidates, (b) => b.weight + (b.signId === signId ? 10 : 0));

  let fallback: { selected: SelectedSlots; compositionId: string } | null = null;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const attemptSeed = stableId(
      `${request.seed ?? ''}|${locale}|${signId}|${period}|${theme}|${attempt}`,
    );
    const rng = mulberry32(parseInt(attemptSeed.slice(0, 8), 16));

    const [arcId] = weightedPick(rng, completeArcs, ([, bySlot]) =>
      arcSlots.reduce((sum, slot) => sum + (bySlot.get(slot)?.[0]?.weight ?? 50), 0),
    );
    const arcBlocks = arcs.get(arcId)!;

    const picked: ApprovedContentBlock[] = [];
    const tryPick = (candidates: readonly ApprovedContentBlock[]): ApprovedContentBlock | null => {
      const viable = candidates.filter((c) => compatibleWithAll(c, picked));
      if (viable.length === 0) return null;
      const chosen = pickWeighted(rng, viable);
      picked.push(chosen);
      return chosen;
    };

    const title = tryPick(arcBlocks.get('title')!);
    const overview = title ? tryPick(arcBlocks.get('overview')!) : null;
    const themeBody = overview ? tryPick(arcBlocks.get(themeBodySlot)!) : null;
    const opening = themeBody ? tryPick(freePool('opening')) : null;
    const reflectionPrompt = opening ? tryPick(freePool('reflection_prompt')) : null;
    const closing = reflectionPrompt ? tryPick(freePool('closing')) : null;

    if (!title || !overview || !themeBody || !opening || !reflectionPrompt || !closing) continue;

    const selected: SelectedSlots = {
      title,
      overview,
      themeBody,
      opening,
      reflectionPrompt,
      closing,
    };
    const compositionId = computeCompositionId(selected);

    if (!recent.has(compositionId)) {
      return {
        ok: true,
        compositionId,
        contentVersion: contentVersionOf(selected),
        selected,
        repeated: false,
      };
    }
    // Valid but already shown recently — remember it as a last-resort answer.
    fallback = { selected, compositionId };
  }

  if (fallback) {
    return {
      ok: true,
      compositionId: fallback.compositionId,
      contentVersion: contentVersionOf(fallback.selected),
      selected: fallback.selected,
      repeated: true,
    };
  }

  // Every attempt failed tag compatibility (e.g., mutually exclusive pools).
  const missingFree = (['opening', 'reflection_prompt', 'closing'] as const).filter(
    (slot) => freePool(slot).length === 0,
  );
  return {
    ok: false,
    reason: 'insufficient-content',
    missingSlots: [...missingFree],
    completeArcs: completeArcs.length,
    poolSize: eligible.length,
  };
}

/** Stable fingerprint of the selected block IDs and content versions (spec FR-03). */
export function computeCompositionId(selected: SelectedSlots): string {
  const parts = (
    ['title', 'opening', 'overview', 'themeBody', 'reflectionPrompt', 'closing'] as const
  ).map((slot) => `${slot}:${selected[slot].id}`);
  return stableId(`${contentVersionOf(selected)}|${parts.join('|')}`);
}

function contentVersionOf(selected: SelectedSlots): string {
  const versions = new Set(
    (Object.values(selected) as ApprovedContentBlock[]).map((b) => b.contentVersion),
  );
  return [...versions].sort().join('+');
}
