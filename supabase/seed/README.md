# Supabase seed

The content bank is **not** seeded from static SQL. Use the pipeline instead:

1. Generate or hand-author a batch (drafts):
   `npm run content:generate -- --locale en --signs all --variants 3`
2. Validate it:
   `npm run content:validate -- --input content-out/<batch>/en-aries.jsonl,...`
3. Import approved content into Supabase:
   `npm run content:import -- --input <files> --into supabase --approve`
4. Verify health:
   `npm run content:coverage -- --source supabase`

The committed dev fixtures (`fixtures/content/*.jsonl`) can be imported the
same way with `--into supabase`, and are used automatically by the app when
`CONTENT_SOURCE=fixtures` (the local default).
