import { describe, expect, it } from 'vitest';
import { buildShareText } from '@/lib/content/shareText';
import en from '@/messages/en.json';

describe('share text (copy/share formatting)', () => {
  const result = {
    title: 'A Spark to Chase',
    overview: 'The day favors small starts over grand plans.',
    sections: [
      { heading: 'Overview', text: 'A slower rhythm suits the day.' },
      { heading: "Today's focus", text: 'Energy spends easiest on one clear task.' },
      { heading: 'Closing note', text: 'You are allowed to meet the day gently.' },
    ],
    reflectionPrompt: 'What would “enough” look like today?',
    assembledAt: '2026-10-23T12:00:00.000Z',
  };

  const labels = {
    signName: 'Aries',
    periodLabel: 'Daily',
    themeLabel: 'General',
    assembledAtLabel: 'Oct 23, 2026',
    reflectionLabel: 'Reflection prompt',
    aiNotice: (en.notice as { text: string }).text,
    sourceLabel: 'AstralCanvas',
  };

  it('includes sign, title, scope meta, and every section', () => {
    const text = buildShareText({ result, labels });
    expect(text).toContain('Aries — A Spark to Chase');
    expect(text).toContain('Daily · General · Oct 23, 2026');
    expect(text).toContain('A slower rhythm suits the day.');
    expect(text).toContain('Energy spends easiest on one clear task.');
    expect(text).toContain('You are allowed to meet the day gently.');
    expect(text).toContain('What would “enough” look like today?');
  });

  it('always carries the localized AI disclosure (spec FR-04/FR-10)', () => {
    const text = buildShareText({ result, labels });
    expect(text).toContain(labels.aiNotice);
    expect(text).toContain('AI-generated');
  });
});
