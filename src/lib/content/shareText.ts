import type { HoroscopeResult } from '@/lib/content/types';

/**
 * Builds the clipboard/share text for a horoscope (spec FR-10).
 * The AI-generated notice is always included — copying must not strip the
 * disclosure. All strings arrive pre-localized from the message dictionary.
 */
export function buildShareText(params: {
  result: Pick<
    HoroscopeResult,
    'title' | 'overview' | 'sections' | 'reflectionPrompt' | 'assembledAt'
  >;
  labels: {
    signName: string;
    periodLabel: string;
    themeLabel: string;
    assembledAtLabel: string;
    reflectionLabel: string;
    aiNotice: string;
    sourceLabel: string;
  };
}): string {
  const { result, labels } = params;
  const lines: string[] = [
    `${labels.signName} — ${result.title}`,
    `${labels.periodLabel} · ${labels.themeLabel} · ${labels.assembledAtLabel}`,
    '',
    result.overview,
  ];
  for (const section of result.sections) {
    lines.push('', section.heading, section.text);
  }
  if (result.reflectionPrompt) {
    lines.push('', `${labels.reflectionLabel}: ${result.reflectionPrompt}`);
  }
  lines.push('', '—', labels.aiNotice, labels.sourceLabel);
  return lines.join('\n');
}
