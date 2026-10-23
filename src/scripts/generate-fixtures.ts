import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { ZODIAC_SIGN_IDS, type ZodiacSignId } from '@/lib/astrology/zodiacSigns';
import {
  canonicalBlockContent,
  contentBlockSchema,
  type ContentBlock,
} from '@/lib/content/contentSchema';
import type { Locale } from '@/lib/i18n/locales';

/**
 * Regenerates the sanitized development content fixtures
 * (`fixtures/content/{en,ru}.jsonl`) from the hand-authored bilingual tables
 * below. Output is fully deterministic (fixed IDs, ordering, and timestamps),
 * and every block carries a real SHA-256 content hash.
 *
 * Run: npx tsx src/scripts/generate-fixtures.ts
 *
 * The production content bank is NOT built here — it comes from the batch
 * AI pipeline (`npm run content:generate`) and lives in Supabase. These
 * fixtures are a small, reviewed snapshot for local dev and tests (spec §7.6).
 */

type SignContent = {
  titles: [string, string];
  overview: string;
  focus: string;
  relationships: string;
  work: string;
  growth: string;
  /** Tone tags this sign's arc refuses in companions (demonstrates exclusions). */
  excludedOpeningTags: string[];
};

type FreePool = {
  openings: Array<{ body: string; tag: string }>;
  reflections: string[];
  closings: Array<{ body: string; tag: string }>;
};

const CREATED_AT = '2026-10-23T00:00:00.000Z';
const CONTENT_VERSION = 'fixture-v1';

const EN_SIGNS: Record<ZodiacSignId, SignContent> = {
  aries: {
    titles: ['A Spark to Chase', 'Momentum Builds'],
    overview:
      'The day favors small starts over grand plans — a first step taken now tends to feel lighter than it looked from a distance.',
    focus:
      'Energy spends easiest on one clear task; choosing it early keeps the day from scattering.',
    relationships:
      'A short, warm, direct message can clear up a small misunderstanding faster than a long explanation.',
    work: 'Quick wins hide where you simplify rather than expand; one trimmed to-do list buys back an hour.',
    growth:
      'Notice the difference between urgency and importance — a five-minute pause usually tells them apart.',
    excludedOpeningTags: ['calm'],
  },
  taurus: {
    titles: ['Roots and Rewards', 'Steady Light'],
    overview:
      'A slower rhythm suits the day: whatever you tend to carefully now is likely to feel satisfying later.',
    focus:
      'Comfort and progress can share the same afternoon — pick the task that also makes tomorrow calmer.',
    relationships:
      'Sharing a simple pleasure — a meal, a walk, a familiar song — says more than elaborate plans.',
    work: 'Consistency outshines brilliance today; the boring checklist is quietly the fastest route.',
    growth: 'Ask which habit has been quietly carrying you, and thank it by keeping it.',
    excludedOpeningTags: ['playful'],
  },
  gemini: {
    titles: ['Curiosity, Combed', 'Two Threads, One Hand'],
    overview:
      "Ideas arrive faster than they can be used; finishing one of them is the day's quiet victory.",
    focus: 'A short list beats a clever system — three lines on paper can hold the whole morning.',
    relationships:
      'Questions open more doors than answers today; ask the one you have been saving.',
    work: 'Communication shines when you summarize first and add detail second.',
    growth: 'Let one unfinished thought stay unfinished; not every thread needs pulling today.',
    excludedOpeningTags: [],
  },
  cancer: {
    titles: ['Tide-Pulled, Home-Sure', 'Soft Armor'],
    overview:
      'Feelings run closer to the surface; treating them as information rather than instructions works best.',
    focus: 'One small act of care for your space can steady everything else on the list.',
    relationships: 'Saying “I noticed” to someone is a complete sentence — and a generous one.',
    work: 'Protect a quiet block of focus the way you would protect a promise.',
    growth: 'Old memories may visit; let them warm you rather than steer you.',
    excludedOpeningTags: ['bold'],
  },
  leo: {
    titles: ['Warm Stage', 'Generous Flame'],
    overview:
      'Attention is easy to win and better spent: shining it on someone else tends to pay back twice.',
    focus: 'Pick the task that lets you be seen doing what you actually do well.',
    relationships:
      "Generosity without a receipt is the day's best trade — give the compliment freely.",
    work: 'A confident first draft beats a perfect blank page; let it be rough and bright.',
    growth: 'Rest is not a dimming; even the sun sets on schedule.',
    excludedOpeningTags: ['calm'],
  },
  virgo: {
    titles: ['Fine Comb, Kind Hand', 'Small Fixes, Clear Mind'],
    overview:
      'Details are friendly today — one tidy corner of your week can reset the whole picture.',
    focus:
      'Choose the smallest task with the loudest mental static; finishing it brings outsized relief.',
    relationships:
      'Practical help is a love language: offer the specific thing, not the general one.',
    work: 'A review beats a restart; the second pass sees what the first was too excited to notice.',
    growth: 'Perfect is a direction, not an address — arrive at “good” and rest there.',
    excludedOpeningTags: ['playful'],
  },
  libra: {
    titles: ['Balanced Scales, Easy Smile', 'Grace in the Middle'],
    overview:
      'A small decision you have been weighing can be made beautifully rather than perfectly.',
    focus: 'Two good options are not a problem; choosing either one well is the skill of the day.',
    relationships:
      'Meet someone halfway and enjoy the walk — the middle ground has the better view.',
    work: 'Diplomacy is productive: soften one message and watch the reply change.',
    growth: 'Weigh your own needs on the same scales you use for everyone else.',
    excludedOpeningTags: [],
  },
  scorpio: {
    titles: ['Still Water, Clear Bottom', 'Quiet Depth'],
    overview:
      'Intensity settles into focus; what looked like a fixation is starting to look like a plan.',
    focus: 'One meaningful conversation or task outweighs ten shallow ones today.',
    relationships: 'Trust grows quietly; a small honesty goes further than a grand reveal.',
    work: 'Research, refine, hold your cards — the patient move is the strong move.',
    growth: 'Letting go of one old grudge frees exactly the energy you need.',
    excludedOpeningTags: ['bold'],
  },
  sagittarius: {
    titles: ['Wide Horizon, Light Pack', 'The Long View'],
    overview: 'The day rewards the bigger picture: zoom out before deciding what is urgent.',
    focus: 'Say yes to what stretches you and no to what merely fills time.',
    relationships: 'Invite someone into your enthusiasm; curiosity makes contagious company.',
    work: 'Learning something adjacent to your work counts as working today.',
    growth: 'Book the trip, take the class, ask the question — motion teaches.',
    excludedOpeningTags: ['calm'],
  },
  capricorn: {
    titles: ['Patient Summit', 'Built to Last'],
    overview:
      'Slow structure wins: one hour of unglamorous progress outperforms a spark of inspiration.',
    focus: "Revisit the long goal and cut it into this week's honest slice.",
    relationships: 'Loyalty shows in follow-through; do the thing you promised, a day early.',
    work: 'Systems, not sprints — adjust one process and let it carry you.',
    growth: 'Rest is part of the architecture; schedule it like a deadline.',
    excludedOpeningTags: ['playful'],
  },
  aquarius: {
    titles: ['Fresh Angle', 'Signal in the Noise'],
    overview: 'An unusual idea deserves a fair trial; the odd option may simply be the early one.',
    focus:
      'Question one default setting of your week — the answer might be “no particular reason”.',
    relationships:
      'Listen for the friend who sounds like you two years ago; you have useful notes for them.',
    work: 'Automate or delegate the repetitive thing; your attention is the scarce resource.',
    growth: 'Community counts as self-care; show up for the group that gets you.',
    excludedOpeningTags: [],
  },
  pisces: {
    titles: ['Soft Current, Strong Swim', 'Dream, Anchored'],
    overview: 'Imagination is unusually useful today; a daydream may contain a workable plan.',
    focus: 'Protect a pocket of unstructured time — it is where your best ideas surface.',
    relationships: 'Empathy is your home turf; remember you are allowed to be supported too.',
    work: 'Pair the dreaming with one concrete step; the muse respects a calendar.',
    growth: 'Write the feeling down — water is easier to carry in a vessel.',
    excludedOpeningTags: ['bold'],
  },
};

const EN_FREE: FreePool = {
  openings: [
    {
      body: 'The stars lean close today, and the reading below was set aside just for you.',
      tag: 'warm',
    },
    {
      body: 'Here is your sky, cut bright and clear — read it like a friend who never hedges.',
      tag: 'bold',
    },
    {
      body: 'Cosmic memo incoming: no doom, a little gloom-dispelling, one gentle dare.',
      tag: 'playful',
    },
    {
      body: 'Settle in; this reading unfolds slowly, like evening light across water.',
      tag: 'calm',
    },
  ],
  reflections: [
    'What would “enough” look like today?',
    'Which small kindness could you send without signing it?',
    'If today had a subtitle, what would it read?',
    'What are you carrying that was never yours to carry?',
  ],
  closings: [
    { body: 'However the day unfolds, you are allowed to meet it gently.', tag: 'warm' },
    { body: 'Take the day personally — in the good way — and use it.', tag: 'bold' },
    { body: 'The stars accept no responsibility for any spontaneous good mood.', tag: 'playful' },
    { body: 'Nothing needs solving this evening; let the sky do the turning.', tag: 'calm' },
  ],
};

const RU_SIGNS: Record<ZodiacSignId, SignContent> = {
  aries: {
    titles: ['Искра, за которой стоит бежать', 'Инерция в вашу пользу'],
    overview:
      'День благоволит малым началам перед грандиозными планами: первый шаг, сделанный сейчас, обычно оказывается легче, чем выглядел издалека.',
    focus:
      'Энергию проще всего потратить на одну ясную задачу: выбранная заранее, она не даст дню рассыпаться.',
    relationships:
      'Короткое, тёплое и прямое сообщение развеет мелкое недопонимание быстрее длинных объяснений.',
    work: 'Быстрые победы прячутся там, где вы упрощаете, а не расширяете: один сокращённый список дел вернёт вам час.',
    growth:
      'Заметьте разницу между срочным и важным — пятиминутная пауза обычно безошибочно их различает.',
    excludedOpeningTags: ['calm'],
  },
  taurus: {
    titles: ['Корни и награды', 'Ровный свет'],
    overview:
      'Дню подходит замедленный ритм: то, за чем вы ухаживаете сейчас, позже принесёт удовлетворение.',
    focus:
      'Комфорт и прогресс могут ужиться в одном вечере — выберите дело, которое сделает завтра спокойнее.',
    relationships:
      'Разделённая простая радость — ужин, прогулка, знакомая песня — говорит больше любых затейливых планов.',
    work: 'Последовательность сегодня ярче блеска: скучный чек-лист — тихо, но самый быстрый маршрут.',
    growth: 'Спросите, какая привычка давно несёт вас, и отблагодарите её тем, что сохраните её.',
    excludedOpeningTags: ['playful'],
  },
  gemini: {
    titles: ['Любопытство в порядке', 'Две нити, одна рука'],
    overview:
      'Идеи приходят быстрее, чем находятся применения; довести до конца одну из них — тихая победа дня.',
    focus: 'Короткий список лучше хитрой системы: три строчки на бумаге удержат всё утро.',
    relationships: 'Вопросы сегодня открывают больше дверей, чем ответы; задайте тот, что берегли.',
    work: 'Общение сияет, когда сначала идёт суть, а потом подробности.',
    growth:
      'Позвольте одной недодуманной мысли остаться недодуманной: не каждую нить нужно тянуть сегодня.',
    excludedOpeningTags: [],
  },
  cancer: {
    titles: ['Прилив тянет, дом держит', 'Мягкая броня'],
    overview:
      'Чувства сегодня ближе к поверхности; лучше всего относиться к ним как к информации, а не к приказам.',
    focus: 'Одно маленькое проявление заботы о вашем пространстве успокоит весь остальной список.',
    relationships: 'Сказать кому-то «я заметил(а)» — уже законченное предложение, и щедрое.',
    work: 'Защищайте тихий час сосредоточенности как обещание.',
    growth: 'Старые воспоминания могут заглянуть в гости — пусть греют, а не рулят.',
    excludedOpeningTags: ['bold'],
  },
  leo: {
    titles: ['Тёплая сцена', 'Щедрое пламя'],
    overview:
      'Внимание легко привлечь и лучше потратить: направить его на кого-то другого — окупается вдвойне.',
    focus: 'Выберите дело, в котором видно, что вы действительно умеете.',
    relationships: 'Щедрость без чека — лучшая сделка дня: отдайте комплимент свободно.',
    work: 'Уверенный черновик лучше идеальной пустой страницы; пусть будет грубо и ярко.',
    growth: 'Отдых — не приглушение: даже солнце заходит по расписанию.',
    excludedOpeningTags: ['calm'],
  },
  virgo: {
    titles: ['Тонкий гребень, добрая рука', 'Мелкие правки — ясная голова'],
    overview:
      'Детали сегодня дружелюбны: один прибранный угол недели может перезапустить всю картину.',
    focus:
      'Возьмите самую маленькую задачу с самым громким внутренним шумом — её завершение даст непропорционально приятное облегчение.',
    relationships: 'Практическая помощь — тоже язык любви: предложите конкретное, а не общее.',
    work: 'Пересмотр лучше перезапуска: второй проход видит то, что первый пропустил от энтузиазма.',
    growth: 'Совершенство — направление, а не адрес: доберитесь до «хорошо» и отдохните там.',
    excludedOpeningTags: ['playful'],
  },
  libra: {
    titles: ['Весы и лёгкая улыбка', 'Грация посередине'],
    overview:
      'Небольшое решение, которое вы давно взвешиваете, можно принять красиво, а не идеально.',
    focus:
      'Два хороших варианта — не проблема; выбрать любой и выбрать хорошо — вот сегодняшний навык.',
    relationships:
      'Встретьтесь с кем-то посередине и получите удовольствие от дороги: у середины вид лучше.',
    work: 'Дипломатия продуктивна: смягчите одно сообщение — и ответ изменится.',
    growth: 'Ставьте собственные потребности на те же весы, что и чужие.',
    excludedOpeningTags: [],
  },
  scorpio: {
    titles: ['Тихая вода, ясное дно', 'Тихая глубина'],
    overview: 'Напор оседает в фокус: то, что казалось навязчивостью, начинает походить на план.',
    focus: 'Один глубокий разговор или задача сегодня стоит десяти поверхностных.',
    relationships: 'Доверие растёт тихо: маленькая честность идёт дальше эффектного признания.',
    work: 'Изучайте, уточняйте, держите карты при себе — терпеливый ход и есть сильный.',
    growth: 'Отпустить один старый камень — значит освободить именно ту энергию, которая нужна.',
    excludedOpeningTags: ['bold'],
  },
  sagittarius: {
    titles: ['Широкий горизонт', 'Дальний обзор'],
    overview: 'День награждает за общий план: отдалите взгляд, прежде чем решать, что срочно.',
    focus: 'Скажите «да» тому, что растягивает вас, и «нет» тому, что лишь заполняет время.',
    relationships: 'Пригласите кого-то в свой энтузиазм: любопытство как компания заразительно.',
    work: 'Учиться чему-то соседнему с работой сегодня тоже считается работой.',
    growth: 'Бронируйте поездку, идите на курс, задайте вопрос: движение учит.',
    excludedOpeningTags: ['calm'],
  },
  capricorn: {
    titles: ['Терпеливая вершина', 'Построено надолго'],
    overview:
      'Побеждает медленная конструкция: час неблестящего прогресса сильнее вспышки вдохновения.',
    focus: 'Вернитесь к долгой цели и отрежьте от неё честный кусок на эту неделю.',
    relationships: 'Верность видна в доведённом до конца: сделайте обещанное, на день раньше.',
    work: 'Системы, а не рывки: подкрутите один процесс и позвольте ему нести вас.',
    growth: 'Отдых — часть архитектуры: запланируйте его как дедлайн.',
    excludedOpeningTags: ['playful'],
  },
  aquarius: {
    titles: ['Свежий угол', 'Сигнал сквозь шум'],
    overview:
      'Необычной идее заслужен честный суд: странный вариант может оказаться просто ранним.',
    focus:
      'Подвергните сомнению одну настройку вашей недели по умолчанию — ответ, возможно, «а почему, собственно, так».',
    relationships:
      'Прислушайтесь к другу, который звучит как вы два года назад: у вас есть для него полезные заметки.',
    work: 'Автоматизируйте или поручите повторяющееся: ваше внимание — дефицитный ресурс.',
    growth: 'Сообщество — тоже забота о себе: приходите к тем, кто вас понимает.',
    excludedOpeningTags: [],
  },
  pisces: {
    titles: ['Мягкое течение, сильный гребок', 'Мечта на якоре'],
    overview: 'Воображение сегодня на удивление полезно: в грёзах может прятаться рабочий план.',
    focus: 'Защитите карман неструктурированного времени — именно в нём всплывают лучшие идеи.',
    relationships: 'Эмпатия — ваша родная стихия; но и вам позволено получать поддержку.',
    work: 'Сочетайте мечтание с одним конкретным шагом: муза уважает календарь.',
    growth: 'Запишите чувство: воду легче нести в сосуде.',
    excludedOpeningTags: ['bold'],
  },
};

const RU_FREE: FreePool = {
  openings: [
    {
      body: 'Звёзды сегодня наклоняются ближе, а чтение ниже было отложено специально для вас.',
      tag: 'warm',
    },
    {
      body: 'Вот ваше небо, ярко и ясно, — читайте его как друг, который не ходит вокруг да около.',
      tag: 'bold',
    },
    {
      body: 'Космическая записка: без обречённости, немного света против мглы и одно аккуратное дерзание.',
      tag: 'playful',
    },
    {
      body: 'Устраивайтесь поудобнее; это чтение разворачивается медленно, как вечерний свет по воде.',
      tag: 'calm',
    },
  ],
  reflections: [
    'Как бы выглядело «достаточно» сегодня?',
    'Какую маленькую доброту можно отправить без подписи?',
    'Если бы у сегодняшнего дня был подзаголовок, каким бы он был?',
    'Что вы несёте, что вам не принадлежит нести?',
  ],
  closings: [
    { body: 'Как бы ни развернулся день, вы имеете право встречать его мягко.', tag: 'warm' },
    { body: 'Примите этот день на свой счёт — в хорошем смысле — и используйте его.', tag: 'bold' },
    { body: 'Звёзды не несут ответственности за внезапно хорошее настроение.', tag: 'playful' },
    {
      body: 'Ничего не нужно решать этим вечером; пусть небо занимается оборотом само.',
      tag: 'calm',
    },
  ],
};

function block(
  partial: Omit<
    ContentBlock,
    | 'contentHash'
    | 'createdAt'
    | 'contentVersion'
    | 'promptVersion'
    | 'sourceModel'
    | 'status'
    | 'reviewedAt'
    | 'weight'
    | 'tags'
    | 'excludedTags'
  > &
    Partial<Pick<ContentBlock, 'tags' | 'excludedTags' | 'weight'>>,
): ContentBlock {
  const draft: ContentBlock = {
    ...partial,
    tags: partial.tags ?? [],
    excludedTags: partial.excludedTags ?? [],
    weight: partial.weight ?? 50,
    contentVersion: CONTENT_VERSION,
    promptVersion: 'hand-authored',
    sourceModel: 'human-author',
    status: 'approved',
    createdAt: CREATED_AT,
    reviewedAt: CREATED_AT,
    contentHash: '',
  };
  draft.contentHash = createHash('sha256')
    .update(canonicalBlockContent(draft), 'utf8')
    .digest('hex');
  return draft;
}

function buildLocaleBlocks(
  locale: Locale,
  signs: Record<ZodiacSignId, SignContent>,
  free: FreePool,
): ContentBlock[] {
  const blocks: ContentBlock[] = [];
  const prefix = locale === 'en' ? 'en' : 'ru';

  for (const signId of ZODIAC_SIGN_IDS) {
    const content = signs[signId];
    const arcId = `${prefix}-${signId}-a`;

    content.titles.forEach((title, index) => {
      blocks.push(
        block({
          id: `${prefix}-${signId}-title-${index + 1}`,
          locale,
          signId,
          period: 'any',
          theme: 'any',
          slot: 'title',
          narrativeArcId: arcId,
          variantGroup: `${arcId}:title`,
          body: title,
          weight: index === 0 ? 55 : 45,
        }),
      );
    });

    blocks.push(
      block({
        id: `${prefix}-${signId}-overview-1`,
        locale,
        signId,
        period: 'any',
        theme: 'any',
        slot: 'overview',
        narrativeArcId: arcId,
        variantGroup: `${arcId}:overview`,
        body: content.overview,
        excludedTags: content.excludedOpeningTags,
      }),
    );

    const themeBodies: Array<['focus' | 'relationships' | 'work' | 'growth', string]> = [
      ['focus', content.focus],
      ['relationships', content.relationships],
      ['work', content.work],
      ['growth', content.growth],
    ];
    for (const [slot, body] of themeBodies) {
      blocks.push(
        block({
          id: `${prefix}-${signId}-${slot}-1`,
          locale,
          signId,
          period: 'any',
          theme: slot === 'focus' ? 'general' : slot,
          slot,
          narrativeArcId: arcId,
          variantGroup: `${arcId}:${slot}`,
          body,
        }),
      );
    }
  }

  free.openings.forEach((opening, index) => {
    blocks.push(
      block({
        id: `${prefix}-opening-${index + 1}`,
        locale,
        signId: null,
        period: 'any',
        theme: 'any',
        slot: 'opening',
        narrativeArcId: null,
        body: opening.body,
        tags: [opening.tag],
      }),
    );
  });

  free.reflections.forEach((body, index) => {
    blocks.push(
      block({
        id: `${prefix}-reflection-${index + 1}`,
        locale,
        signId: null,
        period: 'any',
        theme: 'any',
        slot: 'reflection_prompt',
        narrativeArcId: null,
        body,
      }),
    );
  });

  free.closings.forEach((closing, index) => {
    blocks.push(
      block({
        id: `${prefix}-closing-${index + 1}`,
        locale,
        signId: null,
        period: 'any',
        theme: 'any',
        slot: 'closing',
        narrativeArcId: null,
        body: closing.body,
        tags: [closing.tag],
      }),
    );
  });

  return blocks;
}

function main(): void {
  const outDir = path.join(process.cwd(), 'fixtures', 'content');
  fs.mkdirSync(outDir, { recursive: true });

  const locales: Array<[Locale, Record<ZodiacSignId, SignContent>, FreePool]> = [
    ['en', EN_SIGNS, EN_FREE],
    ['ru', RU_SIGNS, RU_FREE],
  ];

  for (const [locale, signs, free] of locales) {
    const blocks = buildLocaleBlocks(locale, signs, free);
    for (const b of blocks) {
      const check = contentBlockSchema.safeParse(b);
      if (!check.success) {
        throw new Error(
          `Generated block failed schema: ${b.id} → ${check.error.issues[0]?.message}`,
        );
      }
    }
    const lines = blocks.map((b) => JSON.stringify(b)).join('\n') + '\n';
    fs.writeFileSync(path.join(outDir, `${locale}.jsonl`), lines, 'utf8');
    console.log(`${locale}: wrote ${blocks.length} blocks → fixtures/content/${locale}.jsonl`);
  }
}

main();
