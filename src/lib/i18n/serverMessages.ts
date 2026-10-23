import type { Locale } from '@/lib/i18n/locales';

/**
 * Loads a message dictionary outside of the React tree (API route handlers,
 * scripts). Uses the same JSON files next-intl serves to the client.
 */
export async function loadMessages(locale: Locale): Promise<Record<string, unknown>> {
  return (await import(`@/messages/${locale}.json`)).default as Record<string, unknown>;
}

/** Dot-path lookup with `undefined` for missing keys (no throw). */
export function getMessage(messages: Record<string, unknown>, key: string): string | undefined {
  let node: unknown = messages;
  for (const part of key.split('.')) {
    if (node === null || typeof node !== 'object') return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === 'string' ? node : undefined;
}
