import type { ContentSlot } from '@/lib/content/contentSchema';
import type { HoroscopeTheme } from '@/lib/astrology/scopes';
import type { Locale } from '@/lib/i18n/locales';

/**
 * Prompt templates for the batch content-generation workflow (spec §7.1, §7.9).
 * Used ONLY by `npm run content:generate` — never by the public API.
 */

export const PROMPT_VERSION = 'gen-v1';

const LANGUAGE_INSTRUCTION: Record<Locale, string> = {
  en: 'Write all content in natural, fluent English (locale "en").',
  ru: 'Пишите весь текст на естественном, живом русском языке (локаль «ru»).',
};

export const SYSTEM_PROMPT = [
  'You write horoscope content blocks for AstralCanvas, an entertainment app.',
  'Style constraints (mandatory):',
  '- Calm, warm, non-alarmist, culturally respectful; suitable for a general audience.',
  '- Non-deterministic framing: possibilities and invitations ("may", "could", "consider"), never promises or warnings.',
  '- NEVER mention or imply: death, disasters, diagnoses, medical treatment, legal outcomes, financial returns or losses, or unavoidable events.',
  '- Every suggestion must be framed as an optional reflection prompt, not an instruction.',
  '- Do not claim predictive power for astrology.',
  'Output format: a JSON array of objects, each {"slot": string, "body": string}. No markdown, no commentary.',
].join('\n');

export function buildSlotPrompt(params: {
  locale: Locale;
  signId: string;
  slots: Array<{ slot: ContentSlot; theme: HoroscopeTheme | 'any'; count: number }>;
}): string {
  const lines = [
    LANGUAGE_INSTRUCTION[params.locale],
    `Zodiac sign: ${params.signId}.`,
    'Write horoscope content blocks for the slots below. Each body is 1–2 sentences (max 300 characters).',
    'Different blocks for the same slot must be meaningfully different in wording and angle, not paraphrases.',
    '',
    'Slots to generate:',
    ...params.slots.map(
      (s) =>
        `- slot "${s.slot}"${s.theme !== 'any' ? ` (theme: ${s.theme})` : ''}: ${s.count} variant(s)`,
    ),
    '',
    `Return a JSON array with exactly ${params.slots.reduce((sum, s) => sum + s.count, 0)} objects.`,
  ];
  return lines.join('\n');
}
