import { describe, expect, it } from 'vitest';
import { contentBlockSchema, parseContentBlock } from '@/lib/content/contentSchema';

const validBlock = {
  id: 'en-aries-title-1',
  locale: 'en',
  signId: 'aries',
  period: 'any',
  theme: 'any',
  slot: 'title',
  narrativeArcId: 'en-aries-a',
  variantGroup: 'en-aries-a:title',
  body: 'A Spark to Chase',
  tags: [],
  excludedTags: [],
  weight: 50,
  contentHash: 'a'.repeat(64),
  contentVersion: 'fixture-v1',
  status: 'approved',
  createdAt: '2026-10-23T00:00:00.000Z',
};

describe('content block schema', () => {
  it('accepts a fully valid block', () => {
    const result = contentBlockSchema.safeParse(validBlock);
    expect(result.success).toBe(true);
    expect(parseContentBlock(validBlock)?.body).toBe('A Spark to Chase');
  });

  it('accepts sign-agnostic free-slot blocks (signId null)', () => {
    const result = contentBlockSchema.safeParse({
      ...validBlock,
      id: 'en-opening-1',
      signId: null,
      narrativeArcId: null,
      slot: 'opening',
    });
    expect(result.success).toBe(true);
  });

  it.each([
    ['unknown status', { status: 'published' }],
    ['unknown locale', { locale: 'fr' }],
    ['unknown sign', { signId: 'ophiuchus' }],
    ['unknown slot', { slot: 'subtitle' }],
    ['unknown period', { period: 'monthly' }],
    ['unknown theme', { theme: 'love' }],
    ['empty body', { body: '' }],
    ['oversized body', { body: 'x'.repeat(2001) }],
    ['malformed hash', { contentHash: 'zzz' }],
    ['malformed createdAt', { createdAt: 'yesterday' }],
    ['weight out of range', { weight: 101 }],
    ['too many recent tags', { tags: Array.from({ length: 17 }, (_, i) => `t${i}`) }],
  ])('rejects %s', (_name, override) => {
    const result = contentBlockSchema.safeParse({ ...validBlock, ...override });
    expect(result.success).toBe(false);
  });
});
