import type { ContentSlot } from '@/lib/content/contentSchema';
import type { HoroscopeTheme } from '@/lib/astrology/scopes';
import type { Locale } from '@/lib/i18n/locales';
import { PROMPT_VERSION, SYSTEM_PROMPT, buildSlotPrompt } from '@/lib/content/prompts';

/**
 * AI provider adapter for the batch content-production workflow (spec §7.1).
 * Server-side only; the public horoscope endpoint never imports this module.
 */

export type AiCandidate = { slot: string; body: string; tags?: string[] };

export type AiUsage = { inputTokens: number; outputTokens: number } | null;

export type AiBatchResult = { candidates: AiCandidate[]; usage: AiUsage; model: string };

export type AiBatchRequest = {
  locale: Locale;
  signId: string;
  slots: Array<{ slot: ContentSlot; theme: HoroscopeTheme | 'any'; count: number }>;
};

export interface AiProvider {
  readonly name: string;
  generateBatch(request: AiBatchRequest): Promise<AiBatchResult>;
}

/** Parses the model's JSON-array answer defensively; throws on garbage. */
function parseCandidates(raw: string): AiCandidate[] {
  const start = raw.indexOf('[');
  const end = raw.lastIndexOf(']');
  if (start === -1 || end === -1 || end <= start)
    throw new Error('Model response is not a JSON array');
  const parsed: unknown = JSON.parse(raw.slice(start, end + 1));
  if (!Array.isArray(parsed)) throw new Error('Model response is not a JSON array');
  return parsed.flatMap((item) => {
    if (typeof item !== 'object' || item === null) return [];
    const { slot, body } = item as Record<string, unknown>;
    if (typeof slot !== 'string' || typeof body !== 'string' || body.trim().length === 0) return [];
    return [{ slot, body: body.trim() }];
  });
}

/** Anthropic Messages API adapter (no SDK — one fetch call per batch). */
export class AnthropicProvider implements AiProvider {
  readonly name = 'anthropic';

  constructor(
    private readonly apiKey: string,
    private readonly model: string,
    private readonly baseUrl = 'https://api.anthropic.com',
  ) {}

  async generateBatch(request: AiBatchRequest): Promise<AiBatchResult> {
    const response = await fetch(`${this.baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: buildSlotPrompt(request) }],
      }),
    });
    if (!response.ok) {
      throw new Error(
        `Anthropic API error ${response.status}: ${(await response.text()).slice(0, 300)}`,
      );
    }
    const data = (await response.json()) as {
      content?: Array<{ type: string; text?: string }>;
      usage?: { input_tokens?: number; output_tokens?: number };
    };
    const text = (data.content ?? [])
      .filter((part) => part.type === 'text')
      .map((part) => part.text ?? '')
      .join('');
    return {
      candidates: parseCandidates(text),
      usage: data.usage
        ? { inputTokens: data.usage.input_tokens ?? 0, outputTokens: data.usage.output_tokens ?? 0 }
        : null,
      model: this.model,
    };
  }
}

/** Deterministic offline provider for tests and dry-runs; never touches the network. */
export class MockProvider implements AiProvider {
  readonly name = 'mock';

  async generateBatch(request: AiBatchRequest): Promise<AiBatchResult> {
    const candidates = request.slots.flatMap((slotSpec) =>
      Array.from({ length: slotSpec.count }, (_, index) => ({
        slot: slotSpec.slot,
        body: `[mock:${request.locale}:${request.signId}:${slotSpec.slot} variant ${index + 1}] A calm, deliberately generic placeholder sentence for offline pipeline testing.`,
      })),
    );
    return {
      candidates,
      usage: { inputTokens: 100, outputTokens: candidates.length * 40 },
      model: 'mock',
    };
  }
}

export function createProviderFromEnv(env: NodeJS.ProcessEnv, mock: boolean): AiProvider {
  if (mock) return new MockProvider();
  const apiKey = env.AI_PROVIDER_API_KEY;
  const model = env.AI_PROVIDER_MODEL ?? 'claude-sonnet-4-5';
  if (!apiKey)
    throw new Error('AI_PROVIDER_API_KEY is not set (use --mock or --dry-run for offline runs)');
  return new AnthropicProvider(
    apiKey,
    model,
    env.AI_PROVIDER_BASE_URL || 'https://api.anthropic.com',
  );
}

export { PROMPT_VERSION };
