import {
  HOROSCOPE_PERIODS,
  HOROSCOPE_THEMES,
  THEME_BODY_SLOT,
  type HoroscopePeriod,
  type HoroscopeTheme,
} from '@/lib/astrology/scopes';
import { ZODIAC_SIGN_IDS } from '@/lib/astrology/zodiacSigns';
import { locales, type Locale } from '@/lib/i18n/locales';
import type { ContentBlock, ContentSlot } from '@/lib/content/contentSchema';

/**
 * Content-bank health measurement (spec FR-13, §7.5).
 *
 * Counts *valid* combinations per scope by enumerating tag-compatible
 * selections, capped per scope; a capped count is reported as a conservative
 * lower bound (`atLeast: true`) rather than a raw Cartesian product.
 */

export const VARIETY_TARGET_PER_SCOPE = 1000;

/** Enumeration cap per scope; counts that hit it are reported as lower bounds. */
const ENUMERATION_CAP = 20_000;

export type ScopeCoverage = {
  locale: Locale;
  signId: string;
  period: HoroscopePeriod;
  theme: HoroscopeTheme;
  completeArcs: number;
  poolSizes: Record<string, number>;
  /** Valid combinations found (lower bound when `atLeast` is true). */
  validCombinations: number;
  atLeast: boolean;
  meetsTarget: boolean;
  missingSlots: ContentSlot[];
};

export type CoverageReport = {
  targetPerScope: number;
  scopes: ScopeCoverage[];
  duplicateHashes: Array<{ hash: string; ids: string[] }>;
  summary: {
    totalScopes: number;
    supportedScopes: number;
    missingScopes: number;
    belowTargetScopes: number;
  };
};

function scopeEligible(
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

function tagsCompatible(a: ContentBlock, b: ContentBlock): boolean {
  if (a.id === b.id) return false;
  const aExcludesB = a.excludedTags.some((tag) => b.tags.includes(tag));
  const bExcludesA = b.excludedTags.some((tag) => a.tags.includes(tag));
  return !aExcludesB && !bExcludesA;
}

export function buildCoverageReport(
  blocks: readonly ContentBlock[],
  targetPerScope = VARIETY_TARGET_PER_SCOPE,
): CoverageReport {
  const scopes: ScopeCoverage[] = [];
  let supported = 0;
  let missing = 0;
  let belowTarget = 0;

  for (const locale of locales) {
    for (const signId of ZODIAC_SIGN_IDS) {
      for (const period of HOROSCOPE_PERIODS) {
        for (const theme of HOROSCOPE_THEMES) {
          const coverage = measureScope(blocks, { locale, signId, period, theme }, targetPerScope);
          scopes.push(coverage);
          if (coverage.missingSlots.length === 0 && coverage.completeArcs > 0) supported += 1;
          else missing += 1;
          if (
            coverage.completeArcs > 0 &&
            coverage.missingSlots.length === 0 &&
            !coverage.meetsTarget
          )
            belowTarget += 1;
        }
      }
    }
  }

  const byHash = new Map<string, string[]>();
  for (const block of blocks) {
    if (block.status === 'approved') {
      byHash.set(block.contentHash, [...(byHash.get(block.contentHash) ?? []), block.id]);
    }
  }

  return {
    targetPerScope,
    scopes,
    duplicateHashes: [...byHash.entries()]
      .filter(([, ids]) => ids.length > 1)
      .map(([hash, ids]) => ({ hash, ids })),
    summary: {
      totalScopes: scopes.length,
      supportedScopes: supported,
      missingScopes: missing,
      belowTargetScopes: belowTarget,
    },
  };
}

function measureScope(
  blocks: readonly ContentBlock[],
  scope: { locale: Locale; signId: string; period: HoroscopePeriod; theme: HoroscopeTheme },
  target: number,
): ScopeCoverage {
  const themeBodySlot = THEME_BODY_SLOT[scope.theme];
  const arcSlots: ContentSlot[] = ['title', 'overview', themeBodySlot];
  const pool = blocks.filter((b) => scopeEligible(b, scope));

  const arcMap = new Map<string, Map<ContentSlot, ContentBlock[]>>();
  for (const block of pool) {
    if (block.signId !== scope.signId || block.narrativeArcId === null) continue;
    if (!arcSlots.includes(block.slot)) continue;
    const bySlot = arcMap.get(block.narrativeArcId) ?? new Map<ContentSlot, ContentBlock[]>();
    bySlot.set(block.slot, [...(bySlot.get(block.slot) ?? []), block]);
    arcMap.set(block.narrativeArcId, bySlot);
  }

  const freePool = (slot: ContentSlot) =>
    pool.filter((b) => b.slot === slot && b.narrativeArcId === null);
  const openings = freePool('opening');
  const reflections = freePool('reflection_prompt');
  const closings = freePool('closing');

  const missingSlots: ContentSlot[] = [];
  if (!pool.some((b) => b.signId === scope.signId && b.slot === 'title'))
    missingSlots.push('title');
  if (!pool.some((b) => b.signId === scope.signId && b.slot === 'overview'))
    missingSlots.push('overview');
  if (!pool.some((b) => b.signId === scope.signId && b.slot === themeBodySlot))
    missingSlots.push(themeBodySlot);
  for (const [slot, list] of [
    ['opening', openings],
    ['reflection_prompt', reflections],
    ['closing', closings],
  ] as const) {
    if (list.length === 0) missingSlots.push(slot);
  }

  const completeArcs = [...arcMap.values()].filter((bySlot) =>
    arcSlots.every((s) => (bySlot.get(s)?.length ?? 0) > 0),
  );

  let count = 0;
  let capped = false;
  // Mirrors the engine's pairwise tag checks across all six picked blocks.
  const allPairsCompatible = (blocks: readonly ContentBlock[]): boolean => {
    for (let i = 0; i < blocks.length; i++) {
      for (let j = i + 1; j < blocks.length; j++) {
        if (!tagsCompatible(blocks[i], blocks[j])) return false;
      }
    }
    return true;
  };

  outer: for (const bySlot of completeArcs) {
    for (const title of bySlot.get('title') ?? []) {
      for (const overview of bySlot.get('overview') ?? []) {
        for (const body of bySlot.get(themeBodySlot) ?? []) {
          const arcBlocks = [title, overview, body];
          if (!allPairsCompatible(arcBlocks)) continue;
          for (const opening of openings) {
            for (const reflection of reflections) {
              for (const closing of closings) {
                if (!allPairsCompatible([...arcBlocks, opening, reflection, closing])) continue;
                count += 1;
                if (count >= ENUMERATION_CAP) {
                  capped = true;
                  break outer;
                }
              }
            }
          }
        }
      }
    }
  }

  const supported = completeArcs.length > 0 && missingSlots.length === 0 && count > 0;
  return {
    locale: scope.locale,
    signId: scope.signId,
    period: scope.period,
    theme: scope.theme,
    completeArcs: completeArcs.length,
    poolSizes: {
      title: byArcSlot(arcMap, 'title'),
      overview: byArcSlot(arcMap, 'overview'),
      [themeBodySlot]: byArcSlot(arcMap, themeBodySlot),
      opening: openings.length,
      reflection_prompt: reflections.length,
      closing: closings.length,
    },
    validCombinations: count,
    atLeast: capped,
    // A capped enumeration is a lower bound above the cap itself, so it
    // necessarily meets any target below that cap (20 000 > target 1 000).
    meetsTarget: supported && (capped || count >= target),
    missingSlots,
  };
}

function byArcSlot(
  arcMap: Map<string, Map<ContentSlot, ContentBlock[]>>,
  slot: ContentSlot,
): number {
  return [...arcMap.values()].reduce((sum, bySlot) => sum + (bySlot.get(slot)?.length ?? 0), 0);
}
