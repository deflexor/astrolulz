# Localization

Initial locales: English (`en`) and Russian (`ru`). The architecture adds locales by configuration and content — no component or algorithm changes.

## Adding a UI locale (e.g. `de`)

1. Add the code to `src/lib/i18n/locales.ts` (`locales` array, `localeLabels`, extend the `Locale` type via the const array).
2. Copy `src/messages/en.json` → `src/messages/de.json` and translate. Keys must match exactly — `src/tests/locale-coverage.test.ts` fails CI on any missing key in any locale.
3. Translate the **disclaimer yourself** (see `docs/ai-disclosure.md`); a runtime machine-translated disclosure is not acceptable.
4. Localize zodiac names: `zodiac.<sign>.name` and `.description` for all 12 signs.
5. Regenerate the fixture bank with German content (`src/scripts/generate-fixtures.ts` content tables) or generate a production bank: `npm run content:generate -- --locale de --signs all`.

## Enabling a locale for horoscopes

A locale is "supported" for horoscopes only when its content bank has approved, complete pools for the requested sign/period/theme combinations:

```bash
npm run content:coverage -- --source supabase   # per-locale, per-scope health
```

If coverage is incomplete, the app does **not** fall back to another language — the API returns `content_unavailable` and the UI shows a localized "not yet available" message. Silent language mixing is a spec violation.

## Rules the codebase enforces

- The locale in the URL is the source of truth (`/en/...`, `/ru/...`; `localePrefix: 'always'`).
- Locale switching preserves the path and query string (which carries the selected sign/period/theme).
- A horoscope result is assembled entirely in one locale; every selected block's locale is re-verified inside the composition engine.
- Browser language preference only negotiates the first visit (via the proxy); a manually chosen locale is never overridden.
- Dates are formatted with `Intl.DateTimeFormat` in the active locale; UI strings never hardcode text in components.
- The tests enforce dictionary parity, required keys, and zodiac coverage for every locale.
