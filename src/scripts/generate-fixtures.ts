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

const CREATED_AT = '2026-10-24T00:00:00.000Z';
const CONTENT_VERSION = 'fixture-v2';

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

/**
 * Second narrative arc per sign (2026-10-24 variety pass): a different angle
 * and register from arc A, so a scope offers two coherent stories instead of
 * one. Style rules for new copy: speak about the reader's day directly, no
 * meta references to "this reading" or the stars, concrete imagery over
 * abstract advice.
 */
const EN_SIGNS_B: Record<ZodiacSignId, SignContent> = {
  aries: {
    titles: ['First Move, Best Move', 'Green Lights Today'],
    overview:
      'The early hours are the good ones — what you start before noon gets the clearest run.',
    focus: 'Begin while it still feels exciting; momentum is your fuel, not a luxury.',
    relationships: 'Your directness is a gift today — say the plain kind thing first.',
    work: 'Volunteer for the opener, not the cleanup; your energy peaks early.',
    growth: 'Count wins, not tasks. Three small ones beat a heroic maybe.',
    excludedOpeningTags: ['calm'],
  },
  taurus: {
    titles: ['Slow Ripens Best', 'The Comfortable Climb'],
    overview:
      'Nothing needs forcing today — steady pressure on one good thing beats a burst of three.',
    focus: 'Settle into the task with the best chair and the fewest interruptions.',
    relationships: 'Cook, fix, or simply sit with someone — presence outperforms presents today.',
    work: 'Finish what is already open before opening anything new.',
    growth: 'One small upgrade to your routine will pay rent all month.',
    excludedOpeningTags: ['playful'],
  },
  gemini: {
    titles: ['One Tab Open', 'Talk It Into Shape'],
    overview: 'Your mind is a crowded room today — hand one conversation the floor.',
    focus: 'Write the list by hand; the slower version sticks better.',
    relationships: 'Call instead of texting — your voice carries the joke properly.',
    work: 'Explain the messy idea out loud once, and it clicks for both of you.',
    growth: 'Boredom is information: notice which task drains you and which just delays.',
    excludedOpeningTags: [],
  },
  cancer: {
    titles: ['Home Advantage', 'The Soft Hour'],
    overview: 'The day has a soft center — protect it instead of apologizing for it.',
    focus: 'Make your space a little kinder first, then work from there.',
    relationships: 'Check on the person who always checks on everyone else.',
    work: 'Guard the first hour of focus like family time — because attention is.',
    growth:
      'The feeling you keep postponing will keep its appointment either way. Choose the hour yourself.',
    excludedOpeningTags: ['bold'],
  },
  leo: {
    titles: ['Warm Front Moving In', 'Main Character, Good Plot'],
    overview:
      'You set the tone for the whole day — warm and generous. Point that light at something that matters.',
    focus: 'Take the visible task; hiding your light is just bad lighting for everyone.',
    relationships:
      'Introduce two people who should know each other. Be the bridge, not the billboard.',
    work: 'Present the rough version — your confidence sells it better than polish would.',
    growth: 'Applause is a snack, not a meal. Know which is which tonight.',
    excludedOpeningTags: ['calm'],
  },
  virgo: {
    titles: ['The Honest Checklist', 'Edit, Not Redo'],
    overview: "Your eye for what's off is worth money today — apply it to your own stack first.",
    focus: 'Fifteen minutes of actual tidying beats an hour of planning.',
    relationships: 'Do the helpful thing without the disclaimer. Let it just be kind.',
    work: 'Fix the small broken thing everyone has been stepping over.',
    growth: "'Good enough' ships. Perfection just attends meetings.",
    excludedOpeningTags: ['bold'],
  },
  libra: {
    titles: ['Two Doors, One You', 'Peace, Practically'],
    overview: "The choice you're chewing on has no wrong answer — only two different good days.",
    focus: 'Flip a coin, then notice which result you hoped for. There is your answer.',
    relationships: 'Be the thermostat, not the thermometer — set the temperature you want.',
    work: 'The awkward email writes itself if you start with the kind sentence.',
    growth: 'Your own convenience counts too. Stop weighing yourself last.',
    excludedOpeningTags: ['bold'],
  },
  scorpio: {
    titles: ['Quiet Leverage', 'Depth Charges'],
    overview: 'You see one layer deeper than usual today — spend that sight on one real thing.',
    focus: 'One thread, pulled all the way. Ten half-pulls teach nothing.',
    relationships: 'Ask the second question — the one after the polite answer.',
    work: 'Do the digging nobody else wants to; it is your superpower, with a desk.',
    growth: 'One old grudge weighs more than the whole day. Set it down.',
    excludedOpeningTags: ['bold'],
  },
  sagittarius: {
    titles: ['Zoom Out, Then Leap', 'Room to Roam'],
    overview: 'The map is more useful than the itinerary today — look up before you sprint.',
    focus: 'Say yes to the thing that scares you a little and bores you never.',
    relationships: 'Take the long way back with someone; detours are where the talk happens.',
    work: 'Pitch the big version. Trimming later is easy; expanding later is not.',
    growth: 'Book the thing — plans love people who already hold tickets.',
    excludedOpeningTags: ['calm'],
  },
  capricorn: {
    titles: ['Brick by Brick', 'The Long Game Pays'],
    overview: "Today rewards the unglamorous move — the one you'd never post about.",
    focus: 'Do the hardest small thing before it grows an audience.',
    relationships: 'Show care through logistics: the pickup, the reminder, the backup plan.',
    work: 'Fix the process, not the symptom — ten minutes on the root cause saves the quarter.',
    growth: 'Rest with the same seriousness you bring to deadlines.',
    excludedOpeningTags: ['playful'],
  },
  aquarius: {
    titles: ['The Odd Idea Wins', 'Signal Detected'],
    overview: "Today's strange thought is tomorrow's obvious one — give it a fair hearing.",
    focus: 'Change one variable in the routine and the whole day becomes visible again.',
    relationships: 'Say the appreciative thing publicly and the difficult thing privately.',
    work: 'Build the small tool once; it will work for you all month.',
    growth: 'Your people are a renewable resource — spend time with the ones who get you.',
    excludedOpeningTags: ['calm'],
  },
  pisces: {
    titles: ['Drift With Intent', 'The Dream Has Legs'],
    overview: 'The daydream is not the escape — it is the draft. Give it one concrete step.',
    focus: 'Protect the unstructured hour; it is your production floor.',
    relationships: 'Say the tender thing while it is still small. It grows either way.',
    work: 'Start with the image, end with the to-do — your process runs in both directions.',
    growth: 'Water finds a way through, and so do you. Slow counts as progress.',
    excludedOpeningTags: ['bold'],
  },
};

const EN_FREE: FreePool = {
  openings: [
    {
      body: 'A good day starts small: one honest message, one finished task, one real break.',
      tag: 'warm',
    },
    { body: 'Skip the warm-up — today responds to people who move first.', tag: 'bold' },
    { body: "Low drama, decent energy: handle what's actually on your plate.", tag: 'playful' },
    { body: 'Nothing this morning is as loud as it sounds. Give it an hour.', tag: 'calm' },
    {
      body: 'Feet on the floor, phone face down — the first ten minutes set the tone.',
      tag: 'grounded',
    },
    { body: "Spoiler: most of today's problems are yesterday's, wearing a new hat.", tag: 'wry' },
    {
      body: 'Somebody will be glad you showed up today. Probably several somebodies.',
      tag: 'warm',
    },
    { body: "Pick the thing you keep postponing. Today it's smaller than it looks.", tag: 'bold' },
    { body: 'One deep breath before the calendar starts making demands.', tag: 'calm' },
    { body: 'Forecast for today: scattered wins with a chance of showing off.', tag: 'playful' },
  ],
  reflections: [
    'What would make tonight feel like a win, exactly?',
    'Which promise to yourself is due for a small payment?',
    'Who could use the easy version of you today?',
    'If nobody kept score, what would you do differently this afternoon?',
    "What's one thing you could put down before dinner?",
    'Where did you feel genuinely useful this week?',
    'What are you rehearsing that deserves a live performance?',
    'Which conversation gets shorter every time you postpone it?',
    "What would 'a little better' look like — not a lot, just a little?",
    'What did you do recently that your future self will quietly thank you for?',
  ],
  closings: [
    { body: 'However the day goes, end it on your own terms.', tag: 'warm' },
    { body: "You've read enough. Go take the first swing.", tag: 'bold' },
    { body: 'Let the evening be an evening, not a second shift.', tag: 'calm' },
    { body: 'The universe is off duty tonight — no pressure from that direction.', tag: 'playful' },
    { body: 'Small steady things win again today. Trust them.', tag: 'grounded' },
    {
      body: "If all else fails, you're still the most interesting person in the room.",
      tag: 'wry',
    },
    { body: "You're doing better than your inner critic reports.", tag: 'warm' },
    { body: 'Put the day down gently — it carried you this far.', tag: 'calm' },
    { body: "One more honest effort, then rest. That's the whole recipe.", tag: 'bold' },
    { body: 'Go be a delightfully complicated human out there.', tag: 'playful' },
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
    relationships: 'Эмпатия — ваша родная стихия, но и вам позволено получать поддержку.',
    work: 'Сочетайте мечтание с одним конкретным шагом: муза уважает календарь.',
    growth: 'Запишите чувство — воду легче нести в сосуде.',
    excludedOpeningTags: ['bold'],
  },
};

/** Второй сюжетный арк на знак (вариант B, 2026-10-24). */
const RU_SIGNS_B: Record<ZodiacSignId, SignContent> = {
  aries: {
    titles: ['Первый ход — лучший ход', 'Зелёный свет'],
    overview: 'Утренние часы сегодня самые удачные: то, что начато до полудня, идёт легче всего.',
    focus: 'Начните, пока интересно: инерция — ваше топливо, а не роскошь.',
    relationships: 'Ваша прямота сегодня — подарок: скажите кому-то простую тёплую вещь.',
    work: 'Беритесь за старт, а не за уборку: ваша энергия сильнее всего в начале.',
    growth: 'Считайте победы, а не задачи: три маленькие лучше одного героического «может быть».',
    excludedOpeningTags: ['calm'],
  },
  taurus: {
    titles: ['Медленное зреет лучше', 'Удобный подъём'],
    overview:
      'Ничего не нужно продавливать: ровное давление на одно хорошее дело сделает больше, чем рывок.',
    focus: 'Устройтесь в задаче с самым удобным стулом и минимумом помех.',
    relationships:
      'Приготовьте, почините или просто посидите рядом: присутствие сегодня дороже подарков.',
    work: 'Доведите до конца начатое, прежде чем начинать новое.',
    growth: 'Одно маленькое улучшение распорядка окупится весь месяц.',
    excludedOpeningTags: ['playful'],
  },
  gemini: {
    titles: ['Одна вкладка открыта', 'Проговорите до ясности'],
    overview: 'В голове сегодня людно — выберите один разговор и дайте ему слово.',
    focus: 'Список лучше писать от руки: медленная версия держится крепче.',
    relationships: 'Позвоните вместо сообщения: голос донесёт шутку как надо.',
    work: 'Объясните сырую идею вслух один раз — и она сложится для вас обоих.',
    growth:
      'Скука — это информация: заметьте, какая задача истощает, а какая просто откладывается.',
    excludedOpeningTags: [],
  },
  cancer: {
    titles: ['Домашнее преимущество', 'Мягкий час'],
    overview: 'У сегодняшнего дня мягкая середина — берегите её, а не извиняйтесь за неё.',
    focus:
      'Сначала сделайте одну вещь, которая сделает ваше пространство добрее, — и работайте оттуда.',
    relationships: 'Напишите тому, кто обычно сам пишет всем первым.',
    work: 'Охраняйте первый час работы как семейное время: никого не впускать, ничего не переносить.',
    growth: 'Чувство, которое вы откладываете, всё равно придёт — лучше выбрать час самому.',
    excludedOpeningTags: ['bold'],
  },
  leo: {
    titles: ['Тёплый фронт приближается', 'Главная роль, хороший сюжет'],
    overview:
      'Сегодня вы задаёте тон всему дню — тёплый и щедрый. Направьте этот свет на что-то действительно важное.',
    focus: 'Берите видимое дело: скрывать ваш свет — всё равно что портить освещение для всех.',
    relationships:
      'Познакомьте двух людей, которые должны знать друг друга: будьте мостом, а не рекламным щитом.',
    work: 'Покажите черновик — уверенность продаёт его лучше полировки.',
    growth: 'Аплодисменты — перекус, а не обед: научитесь различать.',
    excludedOpeningTags: ['calm'],
  },
  virgo: {
    titles: ['Честный чек-лист', 'Править, а не переписывать'],
    overview: 'Ваш взгляд на несовершенства сегодня на вес золота — начните с собственной стопки.',
    focus: 'Пятнадцать минут настоящего порядка стоят часа планирования.',
    relationships: 'Сделайте полезное без дисклеймеров: пусть это будет просто приятно.',
    work: 'Почините мелочь, через которую все перешагивают.',
    growth: '«Достаточно хорошо» уже в деле. Совершенство всё ещё на согласовании.',
    excludedOpeningTags: ['bold'],
  },
  libra: {
    titles: ['Две двери, один вы', 'Практический покой'],
    overview:
      'У выбора, который вы обдумываете, нет неправильного ответа — только два разных хороших дня.',
    focus: 'Подбросьте монетку и заметьте, какого результата вы ждали. Это и есть ответ.',
    relationships: 'Будьте термостатом, а не термометром: выставляйте температуру, которую хотите.',
    work: 'Неловкое письмо напишется само, если начать с доброго предложения.',
    growth: 'Ваше удобство тоже считается: перестаньте взвешивать себя последним.',
    excludedOpeningTags: ['bold'],
  },
  scorpio: {
    titles: ['Тихий рычаг', 'Глубинный заряд'],
    overview:
      'Вы сегодня видите на слой глубже обычного — потратьте этот взгляд на одно настоящее дело.',
    focus: 'Одна нить, вытянутая до конца. Десять наполовину вытянутых ничему не учат.',
    relationships: 'Задайте второй вопрос — тот, что идёт после вежливого ответа.',
    work: 'Сделайте исследование, за которое никто не хочет браться: в этом ваша сила.',
    growth: 'Одна старая обида весит больше целого рабочего дня. Поставьте её на место.',
    excludedOpeningTags: ['bold'],
  },
  sagittarius: {
    titles: ['Сначала отдалите взгляд', 'Простор для манёвра'],
    overview: 'Карта сегодня полезнее маршрута — поднимите глаза, прежде чем бежать.',
    focus: 'Скажите «да» тому, что немного пугает и никогда не наскучит.',
    relationships: 'Возвращайтесь с кем-то длинной дорогой: разговоры случаются на объездах.',
    work: 'Предложите большую версию: урезать легко потом, расширять — трудно.',
    growth: 'Бронируйте: план любит людей, у которых уже есть билеты.',
    excludedOpeningTags: ['calm'],
  },
  capricorn: {
    titles: ['Кирпич за кирпичом', 'Длинная игра платит'],
    overview: 'День награждает незаметный шаг — тот, о котором не напишешь в ленте.',
    focus: 'Сделайте самую трудную мелочь, пока у неё не появилась аудитория.',
    relationships: 'Забота сегодня — это логистика: встретить, напомнить, подстраховать.',
    work: 'Чините процесс, а не симптом: десять минут о первопричине экономят квартал.',
    growth: 'Отдыхайте со всей серьёзностью, с которой встречаете дедлайны.',
    excludedOpeningTags: ['playful'],
  },
  aquarius: {
    titles: ['Странная идея побеждает', 'Сигнал пойман'],
    overview: 'Сегодняшняя странная мысль — завтрашняя очевидная. Дайте ей честное слушание.',
    focus: 'Поменяйте одну переменную в рутине — и день снова станет видимым.',
    relationships: 'Признание говорите публично, претензию — наедине.',
    work: 'Соберите маленький инструмент один раз — он будет работать на вас весь месяц.',
    growth: 'Ваши люди — возобновляемый ресурс: проводите время с теми, кто вас понимает.',
    excludedOpeningTags: ['calm'],
  },
  pisces: {
    titles: ['Дрейфовать с намерением', 'У мечты есть ноги'],
    overview: 'Грёза — не побег, а черновик. Дайте ей один конкретный шаг.',
    focus: 'Берегите неструктурированный час: это ваш производственный цех.',
    relationships: 'Скажите нежное, пока оно маленькое. Оно всё равно растёт.',
    work: 'Начните с образа, закончите списком дел: ваш процесс работает в обе стороны.',
    growth: 'Вода просачивается сквозь камни — и вы пробьётесь. Медленно — тоже прогресс.',
    excludedOpeningTags: ['bold'],
  },
};

const RU_FREE: FreePool = {
  openings: [
    {
      body: 'Хороший день начинается с мелочей: одно честное сообщение, одна завершённая задача, один настоящий перерыв.',
      tag: 'warm',
    },
    { body: 'Без разминки: сегодня день отвечает тем, кто делает первый шаг.', tag: 'bold' },
    { body: 'Драмы не намечается — намечаются дела. Начните с ближайшего.', tag: 'playful' },
    { body: 'Ничто этим утром не настолько громкое, как звучит. Дайте ему час.', tag: 'calm' },
    {
      body: 'Ноги на пол, телефон экраном вниз: первые десять минут задают тон дню.',
      tag: 'grounded',
    },
    {
      body: 'Спойлер: большинство сегодняшних проблем — вчерашние, просто в новой шляпе.',
      tag: 'wry',
    },
    {
      body: 'Кто-то сегодня порадуется, что вы появились. Скорее всего, сразу несколько человек.',
      tag: 'warm',
    },
    {
      body: 'Возьмите то, что всё время откладываете. Сегодня оно меньше, чем кажется.',
      tag: 'bold',
    },
    {
      body: 'Один глубокий выдох — до того, как календарь начнёт предъявлять требования.',
      tag: 'calm',
    },
    { body: 'Прогноз на день: кое-где победы и лёгкий шанс покрасоваться.', tag: 'playful' },
  ],
  reflections: [
    'Что сделает сегодняшний вечер удачным — если честно?',
    'Какое обещание себе давно ждёт хотя бы маленькой оплаты?',
    'Кому сегодня пригодилась бы ваша лёгкая версия?',
    'Если бы никто не вёл счёт, что бы вы делали иначе после обеда?',
    'Что можно спокойно поставить на пол до ужина?',
    'Где на этой неделе вы были по-настоящему полезны?',
    'Что вы репетируете, чему давно пора выйти на сцену?',
    'Какой разговор становится короче с каждым переносом на завтра?',
    'Как выглядит «чуть лучше» — не сильно, а именно чуть?',
    'За что завтра вы тихо скажете себе спасибо?',
  ],
  closings: [
    { body: 'Как бы ни прошёл день, завершите его на своих условиях.', tag: 'warm' },
    { body: 'Хватит читать. Сделайте первый шаг.', tag: 'bold' },
    { body: 'Пусть вечер останется вечером, а не второй сменой.', tag: 'calm' },
    { body: 'Вселенная сегодня не при делах — давления с её стороны не будет.', tag: 'playful' },
    { body: 'Снова побеждают маленькие постоянные вещи. Доверьтесь им.', tag: 'grounded' },
    {
      body: 'Если всё остальное не сработает, вы всё равно самый интересный человек в этой комнате.',
      tag: 'wry',
    },
    { body: 'У вас идёт лучше, чем докладывает внутренний критик.', tag: 'warm' },
    { body: 'Аккуратно поставьте день на место — он донёс вас досюда.', tag: 'calm' },
    { body: 'Ещё одно честное усилие — и отдых. Вот и весь рецепт.', tag: 'bold' },
    { body: 'Идите и будьте очаровательно сложным человеком.', tag: 'playful' },
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
  signsA: Record<ZodiacSignId, SignContent>,
  signsB: Record<ZodiacSignId, SignContent>,
  free: FreePool,
): ContentBlock[] {
  const blocks: ContentBlock[] = [];
  const prefix = locale === 'en' ? 'en' : 'ru';
  const arcs: Array<[Record<ZodiacSignId, SignContent>, 'a' | 'b']> = [
    [signsA, 'a'],
    [signsB, 'b'],
  ];

  for (const [signs, arcLetter] of arcs) {
    for (const signId of ZODIAC_SIGN_IDS) {
      const content = signs[signId];
      const arcId = `${prefix}-${signId}-${arcLetter}`;
      const arcNo = arcLetter === 'a' ? 1 : 2;

      content.titles.forEach((title, index) => {
        blocks.push(
          block({
            id: `${prefix}-${signId}-title-${(arcNo - 1) * 2 + index + 1}`,
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
          id: `${prefix}-${signId}-overview-${arcNo}`,
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
            id: `${prefix}-${signId}-${slot}-${arcNo}`,
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

  const locales: Array<
    [Locale, Record<ZodiacSignId, SignContent>, Record<ZodiacSignId, SignContent>, FreePool]
  > = [
    ['en', EN_SIGNS, EN_SIGNS_B, EN_FREE],
    ['ru', RU_SIGNS, RU_SIGNS_B, RU_FREE],
  ];

  for (const [locale, signsA, signsB, free] of locales) {
    const blocks = buildLocaleBlocks(locale, signsA, signsB, free);
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
