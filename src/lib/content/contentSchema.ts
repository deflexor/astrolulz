import { z } from 'zod';
import { locales } from '@/lib/i18n/locales';
import { ZODIAC_SIGN_IDS } from '@/lib/astrology/zodiacSigns';

/**
 * Roles a content block can play in an assembled horoscope.
 *
 * Arc-bound slots (title, overview, and the four theme bodies) are grouped by
 * `narrativeArcId` so a composition reads as one coherent story. Free slots
 * (opening, reflection_prompt, closing) come from a sign-agnostic pool and are
 * constrained only by tags.
 */
export const CONTENT_SLOTS = [
  'title',
  'opening',
  'overview',
  'focus',
  'relationships',
  'work',
  'growth',
  'reflection_prompt',
  'closing',
] as const;
export type ContentSlot = (typeof CONTENT_SLOTS)[number];

/** Slots selected from the sign-agnostic free pool. */
export const FREE_SLOTS = [
  'opening',
  'reflection_prompt',
  'closing',
] as const satisfies readonly ContentSlot[];
export type FreeSlot = (typeof FREE_SLOTS)[number];

export const BLOCK_STATUSES = ['draft', 'approved', 'retired'] as const;
export type BlockStatus = (typeof BLOCK_STATUSES)[number];

/** `any` marks a block as reusable across that scope dimension. */
export const BLOCK_PERIODS = ['daily', 'weekly', 'any'] as const;
export const BLOCK_THEMES = ['general', 'relationships', 'work', 'growth', 'any'] as const;

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/);

export const contentBlockSchema = z.object({
  /** Stable, human-readable unique ID (UUIDs also acceptable). */
  id: z.string().min(4).max(128),
  locale: z.enum(locales),
  /** Specific sign, or null for broadly reusable (free-slot) content. */
  signId: z.enum(ZODIAC_SIGN_IDS).nullable(),
  period: z.enum(BLOCK_PERIODS),
  theme: z.enum(BLOCK_THEMES),
  slot: z.enum(CONTENT_SLOTS),
  /** Groups arc-bound blocks into one coherent narrative. Null for free slots. */
  narrativeArcId: z.string().min(2).max(128).nullable(),
  variantGroup: z.string().min(2).max(160).nullable().optional(),
  /** The text itself. For slot "title" this is the title. */
  body: z.string().min(1).max(2000),
  title: z.string().min(1).max(300).nullable().optional(),
  tags: z.array(z.string().min(1).max(64)).max(16).default([]),
  excludedTags: z.array(z.string().min(1).max(64)).max(16).default([]),
  weight: z.number().int().min(0).max(100).default(50),
  /** SHA-256 of the canonical block content; used for exact-duplicate detection. */
  contentHash: z.string().regex(/^[0-9a-f]{64}$/),
  contentVersion: z.string().min(1).max(32),
  promptVersion: z.string().min(1).max(32).nullable().optional(),
  sourceModel: z.string().min(1).max(128).nullable().optional(),
  status: z.enum(BLOCK_STATUSES),
  createdAt: isoDate,
  reviewedAt: isoDate.nullable().optional(),
});

export type ContentBlock = z.infer<typeof contentBlockSchema>;

/** A block that has passed schema validation and is approved for serving. */
export type ApprovedContentBlock = ContentBlock & { status: 'approved' };

export function parseContentBlock(value: unknown): ContentBlock | null {
  const result = contentBlockSchema.safeParse(value);
  return result.success ? result.data : null;
}

/**
 * Canonical string whose SHA-256 becomes `contentHash`. Field order is fixed
 * so hashes are reproducible across the generate/validate/import scripts.
 */
export function canonicalBlockContent(
  block: Pick<
    ContentBlock,
    'locale' | 'signId' | 'slot' | 'body' | 'narrativeArcId' | 'variantGroup'
  >,
): string {
  return [
    block.locale,
    block.signId ?? '-',
    block.slot,
    block.narrativeArcId ?? '-',
    block.variantGroup ?? '-',
    block.body.trim(),
  ].join('\u241f');
}
