-- Grant lockdown (spec §9.3: "Do not assume RLS policies remove existing
-- SQL grants; review both grants and policies").
--
-- RLS is enabled with zero policies on all five tables (0001), which already
-- denies anon/authenticated row access by default. This migration additionally
-- revokes the table-level privileges Supabase grants to those roles on new
-- projects, so no anonymous SQL privilege on the content bank exists at all —
-- not even ones RLS does not cover (e.g. TRUNCATE). The app never talks to
-- Supabase directly from the browser; all access goes through this app's
-- server-side API using the service-role key.

revoke all on table public.supported_locales from anon, authenticated;
revoke all on table public.zodiac_sign_translations from anon, authenticated;
revoke all on table public.content_batches from anon, authenticated;
revoke all on table public.content_blocks from anon, authenticated;
revoke all on table public.composition_metrics_daily from anon, authenticated;

-- Keep future tables in the public schema closed to anon/authenticated too.
alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on functions from anon, authenticated;
