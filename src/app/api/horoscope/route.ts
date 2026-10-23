import { NextResponse } from 'next/server';
import { THEME_BODY_SLOT } from '@/lib/astrology/scopes';
import { composeHoroscope } from '@/lib/content/composeHoroscope';
import { createContentRepository } from '@/lib/content/repository';
import {
  DISCLAIMER_VERSION,
  type HoroscopeApiError,
  type HoroscopeResult,
  type SectionSlot,
} from '@/lib/content/types';
import { loadMessages, getMessage } from '@/lib/i18n/serverMessages';
import { checkRateLimit } from '@/lib/rateLimit';
import { parseHoroscopeRequest } from '@/lib/validation/horoscopeRequest';

/**
 * Public horoscope endpoint (spec FR-03).
 *
 * Reads approved pre-generated content, composes a result deterministically,
 * and NEVER calls the AI provider — there is no AI SDK import on this path.
 * Localized section headings are resolved server-side from the same message
 * dictionaries the UI uses, so results stay in exactly one locale.
 */

const MAX_BODY_BYTES = 8 * 1024;

function errorResponse(
  status: number,
  code: HoroscopeApiError['error']['code'],
  field?: string,
  extraHeaders?: HeadersInit,
) {
  return NextResponse.json(
    { error: { code, ...(field ? { field } : {}) } },
    { status, headers: extraHeaders },
  );
}

export async function POST(request: Request): Promise<NextResponse> {
  // Basic abuse protection (per-instance soft limit; see src/lib/rateLimit.ts).
  const clientKey = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
  const rate = checkRateLimit(`horoscope:${clientKey}`);
  if (!rate.allowed) {
    return errorResponse(429, 'rate_limited', undefined, {
      'retry-after': String(Math.max(rate.retryAfterSeconds, 1)),
    });
  }

  const contentLength = Number(request.headers.get('content-length') ?? '0');
  if (contentLength > MAX_BODY_BYTES) {
    return errorResponse(400, 'invalid_request', 'body');
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return errorResponse(400, 'invalid_request', 'body');
  }

  const parsed = parseHoroscopeRequest(payload);
  if (!parsed.success) {
    return errorResponse(400, parsed.error.code, parsed.error.field);
  }
  const { locale, signId, period, theme, recentCompositionIds } = parsed.data;

  let blocks;
  try {
    const repository = createContentRepository();
    blocks = await repository.getEligibleBlocks(parsed.data);
  } catch (error) {
    // Log server-side only; never leak database details to the client (spec §9.4).
    console.error(
      '[api/horoscope] repository error:',
      error instanceof Error ? error.message : error,
    );
    return errorResponse(503, 'database_unavailable');
  }

  if (blocks.length === 0) {
    return errorResponse(404, 'content_unavailable');
  }

  // Seed mixes a per-request nonce with the scope and recent IDs so results
  // vary between requests while remaining reproducible for a fixed seed.
  const seed = [crypto.randomUUID(), locale, signId, period, theme, ...recentCompositionIds].join(
    '|',
  );
  const composition = composeHoroscope({
    locale,
    signId,
    period,
    theme,
    blocks,
    recentCompositionIds,
    seed,
  });

  if (!composition.ok) {
    console.warn(
      `[api/horoscope] insufficient content: ${locale}/${signId}/${period}/${theme} ` +
        `missing=[${composition.missingSlots.join(',')}] arcs=${composition.completeArcs} pool=${composition.poolSize}`,
    );
    return errorResponse(404, 'content_unavailable');
  }

  const messages = await loadMessages(locale);
  const heading = (slot: SectionSlot): string =>
    getMessage(messages, `sections.${slot}`) ?? `sections.${slot}`;

  const themeSlot = THEME_BODY_SLOT[theme] as SectionSlot;
  const { selected } = composition;

  const result: HoroscopeResult = {
    locale,
    signId,
    period,
    theme,
    title: selected.title.body,
    overview: selected.opening.body,
    sections: [
      { heading: heading('overview'), text: selected.overview.body },
      { heading: heading(themeSlot), text: selected.themeBody.body },
      { heading: heading('closing'), text: selected.closing.body },
    ],
    reflectionPrompt: selected.reflectionPrompt.body,
    assembledAt: new Date().toISOString(),
    contentVersion: composition.contentVersion,
    compositionId: composition.compositionId,
    generatedByAI: true,
    generationMode: 'pre-generated-composition',
    disclaimerVersion: DISCLAIMER_VERSION,
  };

  return NextResponse.json({ result, repeated: composition.repeated });
}
