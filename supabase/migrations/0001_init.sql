-- AstralCanvas content bank schema (spec §7.3).
-- Apply with: supabase db push  (or paste into the SQL editor)

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Supported locales
-- ---------------------------------------------------------------------------
create table if not exists public.supported_locales (
  locale text primary key check (locale ~ '^[a-z]{2}(-[A-Z]{2})?$'),
  display_name text not null,
  enabled boolean not null default true,
  is_default boolean not null default false
);

-- At most one default locale.
create unique index if not exists supported_locales_single_default
  on public.supported_locales (is_default) where is_default;

-- ---------------------------------------------------------------------------
-- Localized zodiac sign metadata (stable IDs + per-locale display names)
-- ---------------------------------------------------------------------------
create table if not exists public.zodiac_sign_translations (
  sign_id text not null check (sign_id in (
    'aries','taurus','gemini','cancer','leo','virgo','libra',
    'scorpio','sagittarius','capricorn','aquarius','pisces'
  )),
  locale text not null references public.supported_locales (locale) on delete cascade,
  display_name text not null,
  accessible_description text,
  primary key (sign_id, locale)
);

-- ---------------------------------------------------------------------------
-- Generation batches (provenance / reproducibility)
-- ---------------------------------------------------------------------------
create table if not exists public.content_batches (
  id uuid primary key default gen_random_uuid(),
  prompt_version text,
  model text,
  locale text references public.supported_locales (locale) on delete cascade,
  status text not null default 'draft' check (status in ('draft', 'approved', 'retired')),
  notes text,
  created_at timestamptz not null default now(),
  imported_at timestamptz
);

-- ---------------------------------------------------------------------------
-- Content blocks — the production content bank
-- ---------------------------------------------------------------------------
create table if not exists public.content_blocks (
  id text primary key,
  locale text not null references public.supported_locales (locale) on delete cascade,
  sign_id text null check (sign_id in (
    'aries','taurus','gemini','cancer','leo','virgo','libra',
    'scorpio','sagittarius','capricorn','aquarius','pisces'
  )),
  period text not null check (period in ('daily', 'weekly', 'any')),
  theme text not null check (theme in ('general', 'relationships', 'work', 'growth', 'any')),
  slot text not null check (slot in (
    'title', 'opening', 'overview', 'focus', 'relationships', 'work',
    'growth', 'reflection_prompt', 'closing'
  )),
  narrative_arc_id text null,
  variant_group text null,
  title text null,
  body text not null check (char_length(body) between 1 and 2000),
  tags text[] not null default '{}',
  excluded_tags text[] not null default '{}',
  weight integer not null default 50 check (weight between 0 and 100),
  content_hash text not null check (content_hash ~ '^[0-9a-f]{64}$'),
  content_version text not null,
  prompt_version text null,
  source_model text null,
  status text not null default 'draft' check (status in ('draft', 'approved', 'retired')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz null
);

-- Exact-duplicate protection.
create unique index if not exists content_blocks_hash_unique
  on public.content_blocks (content_hash);

-- Serving query path: approved blocks for a locale/scope.
create index if not exists content_blocks_serving_idx
  on public.content_blocks (status, locale, sign_id, period, theme, slot);

-- Partial index covering the hot "approved only" path (spec §7.3).
create index if not exists content_blocks_approved_idx
  on public.content_blocks (locale, sign_id, slot, narrative_arc_id)
  where status = 'approved';

create index if not exists content_blocks_arc_idx
  on public.content_blocks (narrative_arc_id);

-- ---------------------------------------------------------------------------
-- Aggregate daily composition metrics (no personal reading history)
-- ---------------------------------------------------------------------------
create table if not exists public.composition_metrics_daily (
  day date not null,
  locale text not null,
  sign_id text not null,
  period text not null,
  theme text not null,
  successes integer not null default 0,
  low_content_warnings integer not null default 0,
  errors integer not null default 0,
  primary key (day, locale, sign_id, period, theme)
);

-- ---------------------------------------------------------------------------
-- Row Level Security: no anonymous/authenticated access at all.
-- The app serves approved content exclusively through its server-side API,
-- which uses the service role key (bypasses RLS). Do NOT add anon policies
-- unless direct browser access becomes a deliberate requirement (spec §9.3).
-- ---------------------------------------------------------------------------
alter table public.supported_locales enable row level security;
alter table public.zodiac_sign_translations enable row level security;
alter table public.content_batches enable row level security;
alter table public.content_blocks enable row level security;
alter table public.composition_metrics_daily enable row level security;

-- Seed initial locales (idempotent).
insert into public.supported_locales (locale, display_name, enabled, is_default)
values
  ('en', 'English', true, true),
  ('ru', 'Русский', true, false)
on conflict (locale) do nothing;
