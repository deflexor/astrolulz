# AstralCanvas — Technical Specification

**Document type:** Software Requirements Specification (SRS)  
**Project:** AstralCanvas — AI Horoscope Experience and Interactive Shader-Based Zodiac  
**Version:** 2.0  
**Status:** Updated product and implementation specification  
**Target deployment:** Vercel

---

## 1. Project Overview

AstralCanvas is a multilingual web application for astrology enthusiasts. It combines an interactive, stylized celestial experience built with Three.js, WebGL, and custom GLSL shaders with fast horoscope results assembled from a curated library of pre-generated AI content.

**Core product principle:** user requests must not call an AI model in the normal horoscope-reading path. AI content is generated in a separate batch/pre-generation workflow, validated, localized, and stored in Supabase. At request time, a server-side composition algorithm selects compatible content fragments and assembles a readable horoscope. This approach is intended to deliver low latency, predictable costs, and substantial variety.

The application demonstrates:

- Multilingual UX and localized routing/content.
- TypeScript, Next.js, and maintainable frontend architecture.
- Three.js scene construction and custom GLSL materials.
- Understanding of the WebGL rendering pipeline and 3D mathematics.
- GPU-aware rendering and resource management on desktop and mobile.
- AI content generation as a content-production pipeline rather than a synchronous user-facing dependency.
- Supabase/Postgres data modelling, querying, validation, and secure server-side access.
- Vercel deployment and production-safe secret management.

### 1.1 Product goals

1. Deliver a polished, responsive astrology-themed application.
2. Support multiple UI and horoscope languages with a clear locale selector.
3. Provide daily and weekly horoscope results for all 12 zodiac signs and supported themes.
4. Create broad variation by composing compatible pre-generated content blocks.
5. Avoid calling an AI provider for each horoscope request.
6. Label horoscope content clearly as AI-generated and assembled from pre-generated AI-written material.
7. Store the production content bank in Supabase, with local JSON fixtures for development and seed/import workflows.
8. Render stylized planets, zodiac symbols, and celestial effects using Three.js and custom GLSL shaders.
9. Measure and document rendering performance.
10. Deploy the app to Vercel with secrets stored server-side.

### 1.2 Non-goals for the initial release

- Claiming that astrology has scientific predictive validity.
- Presenting horoscopes as factual predictions or professional advice.
- Generating a new AI response synchronously for every user click.
- Building a social network, subscription system, or user-account system.
- Collecting or storing birth details by default.
- Producing an astronomically accurate planetarium simulation.
- Generating a full natal chart in the MVP.
- Providing live astronomical or ephemeris data unless explicitly added later.
- Building a full editorial CMS; content generation/import can initially use scripts and a small set of database status fields.

**Important distinction:** In the MVP, the celestial scene is stylized and astrology-inspired. Planet positions must not be presented as exact astronomical positions unless validated ephemeris calculations are implemented. Horoscope text is AI-generated interpretive entertainment, not a reliable prediction.

## 2. Target Users and Primary Use Cases

### Target users

- People who enjoy astrology-themed content and daily horoscope formats.
- Users who prefer to read content in their chosen language.
- Users who like interactive, visually rich websites.
- Portfolio reviewers evaluating graphics engineering, internationalization, AI integration, and data architecture.

### Primary use cases

1. Open the app and see it in a supported language selected from the URL, browser preference, or saved preference.
2. Change language without losing the selected zodiac sign or current app context where practical.
3. Select one of the 12 zodiac signs.
4. Choose a horoscope period: daily or weekly.
5. Optionally select a theme: general, relationships, work, or personal growth.
6. Request a horoscope and receive a result quickly, without waiting for live AI generation.
7. Generate another result and receive a different valid combination where available.
8. Explore the zodiac wheel and stylized planets in an interactive 3D scene.
9. Copy or share a horoscope with its AI-generated notice in the selected language.
10. Use the app on desktop and mobile.

## 3. Scope and Deliverables

The initial release must include:

- A responsive web app with multilingual routing and localized UI strings.
- A locale selector and an explicitly configured list of supported languages.
- English and Russian as the proposed first-release locales; additional languages must be addable through configuration and content seeding, not by rewriting application logic.
- A selector for all 12 zodiac signs, daily/weekly period, and supported themes.
- A horoscope result view with locale, sign, period, theme, AI disclosure, and composition timestamp.
- A pre-generated, versioned content bank stored in Supabase/Postgres.
- A local-file import/export workflow for content generation, review, seeding, and backup.
- A deterministic, testable TypeScript composition engine that combines compatible content blocks.
- A separate batch content-generation workflow that calls the AI provider; the normal user request path must not call the AI provider.
- Duplicate/repetition avoidance and metrics for estimating valid composition variety.
- An interactive Three.js zodiac/celestial scene.
- Custom GLSL shaders for planets and at least one additional visual effect.
- Performance/quality controls suitable for a portfolio project.
- A server-side horoscope API route, validation, graceful fallback, and basic abuse protection.
- Vercel deployment configuration and instructions.
- Tests, database migrations/seed scripts, documentation, and screenshots or a short demo recording.

## 4. Technology Stack

Use the following stack unless a documented technical reason justifies a change:

- **Framework:** Next.js App Router.
- **Language:** TypeScript with strict mode enabled.
- **UI:** React and CSS Modules or Tailwind CSS. Choose one approach and use it consistently.
- **Internationalization:** `next-intl` (recommended) or an equivalent established Next.js i18n solution. Keep locale IDs centralized.
- **3D rendering:** Three.js directly, keeping the rendering pipeline explicit.
- **Graphics API:** WebGL 2 where available; provide a clear fallback if required functionality is unavailable.
- **Shaders:** Custom GLSL compatible with the selected Three.js version and WebGL context.
- **Content database:** Supabase Postgres for the production content bank; SQL migrations and scripts for schema/seed management.
- **AI content production:** A server-side provider adapter used by an explicit batch script or protected admin workflow, not by the public composition endpoint.
- **Local content artifacts:** Validated JSON/JSONL fixtures and export snapshots for development, content QA, backup, and deterministic tests.
- **Validation:** Zod or an equivalent schema validator for inputs and content records.
- **Testing:** Vitest for unit tests; Playwright or equivalent for browser smoke tests.
- **Linting/formatting:** ESLint and Prettier.
- **Hosting:** Vercel.
- **Version control:** Git and GitHub.

Pin compatible versions in the package manifest and lockfile. Verify APIs against the exact versions installed.

### 4.1 Rendering and hydration

The Three.js scene must run only in the browser. Use a client component and, where needed, a client-only dynamic import so server-side rendering does not attempt to access browser-only APIs. Keep the rest of the application server-renderable where appropriate.

### 4.2 Localization architecture

- Use locale-prefixed routes, for example `/en/horoscope` and `/ru/horoscope`.
- Define supported locales and the default locale in one shared configuration.
- Localize UI strings, metadata, date formatting, zodiac names, themes, validation/error messages, AI notices, disclaimers, and copy/share text.
- Browser language detection may propose an initial locale, but the user must be able to override it.
- Persist explicit locale choice using locale-prefixed URLs and, where appropriate, a lightweight preference cookie.
- The locale displayed in the URL must be the source of truth for the current page.
- Horoscope content must be assembled entirely in one locale. Do not mix languages within a result.
- A locale is considered supported for horoscopes only when enough approved content exists for its requested sign/period/theme combinations.

## 5. Information Architecture and Screens

### 5.1 Home / Horoscope

Main elements:

- Product name and short introduction.
- Locale selector with the currently selected language clearly indicated.
- Persistent notice: **“All horoscopes on AstralCanvas are AI-generated and assembled from pre-generated AI-written content.”** Localize this notice.
- Zodiac selector containing all 12 signs, with localized sign names.
- Period selector: Daily / Weekly.
- Optional theme selector: General / Relationships / Work / Personal Growth.
- Primary action: “Get horoscope” or an equivalent localized label. Do not imply a live AI call.
- Horoscope result area with localized headings, AI label, selected sign, period, theme, and composition date/time.
- A “Show another” action that requests a different valid composition, subject to available content.
- Link or button to explore the interactive zodiac scene.
- Footer links to the localized disclaimer, privacy information, and project information.

### 5.2 Zodiac Explorer

Main elements:

- Interactive zodiac wheel or celestial scene.
- Twelve zodiac symbols arranged around a wheel or celestial ring.
- Stylized Sun, Moon, and selected planets displayed as shader-driven spheres.
- Hover, click, and keyboard-accessible selection for zodiac symbols.
- A short localized information panel for the selected sign or celestial object.
- Visual settings: effects on/off, animation pause/resume, and quality preset.
- A clear way to return to horoscope reading.

### 5.3 About / Disclaimer

Explain in the currently selected language that horoscope text is generated by AI in advance and algorithmically assembled from stored AI-generated content. State that it is intended for entertainment and self-reflection, not as factual prediction or professional advice; astrology is not scientifically established as a reliable prediction method; AI content may be inaccurate, generic, repetitive, or culturally awkward; and decorative planet placements are not necessarily astronomically exact.

The disclaimer must be accessible without requiring a horoscope to be generated first. Each supported locale must have a reviewed, human-readable disclosure rather than a runtime machine-translated fallback.

## 6. Functional Requirements

### FR-01: Zodiac Sign Selection

The application shall support all 12 signs: Aries, Taurus, Gemini, Cancer, Leo, Virgo, Libra, Scorpio, Sagittarius, Capricorn, Aquarius, and Pisces.

For each sign, maintain a stable machine ID independent of localized display name, plus localized name, symbol/icon, accessible label, and optional descriptive copy. If date boundaries are shown, note that conventions and time zones may affect them. Switching locale must preserve the selected sign by stable ID.

### FR-02: Horoscope Period and Theme

The app shall support daily and weekly horoscopes, with optional themes: general, relationships, work/career, and personal growth. All labels must be localized. Stable machine IDs must not depend on translated labels.

### FR-03: Fast Horoscope Retrieval and Composition

The public horoscope endpoint shall assemble a result from approved pre-generated content stored in Supabase. It must not invoke the AI provider in the normal request path.

Requirements:

- Validate locale, sign, period, theme, timezone/date context, and optional recent-composition IDs.
- Fetch or read an eligible content pool for the exact requested locale and scope.
- Select compatible content blocks using the composition algorithm in Section 7.
- Return a complete, coherent result in one language.
- Include selected content IDs or a stable composition fingerprint for QA and repetition avoidance; do not expose internal prompt metadata to end users.
- Support a “Show another” action that attempts a different combination.
- If the required content pool is too small, return a graceful localized “not yet available” message or a clearly disclosed fallback; never silently mix languages or fabricate a newly generated AI response.
- Keep the endpoint fast and bounded. Do not call a live AI provider to fill a missing slot.
- Include `contentVersion`, `compositionId`, `assembledAt`, `generatedByAI: true`, and `generationMode: "pre-generated-composition"` metadata in the internal/result schema as appropriate.

Suggested response shape:

```ts
type HoroscopeResult = {
  locale: string;
  signId: string;
  period: 'daily' | 'weekly';
  theme: 'general' | 'relationships' | 'work' | 'growth';
  title: string;
  overview: string;
  sections: Array<{ heading: string; text: string }>;
  reflectionPrompt?: string;
  assembledAt: string;
  contentVersion: string;
  compositionId: string;
  generatedByAI: true;
  generationMode: 'pre-generated-composition';
  disclaimerVersion: string;
};
```

### FR-04: AI Disclosure

All horoscope results must be identified as AI-generated even though no live generation occurs when the user requests one. The UI shall explain that the result is assembled from pre-generated AI-written components using an algorithm.

Suggested disclosure, to be localized and reviewed for every supported locale:

> **AI-generated content:** All horoscopes on AstralCanvas are written with AI in advance and assembled from pre-generated content. They are intended for entertainment and self-reflection only, not as factual predictions or professional advice. Astrology is not scientifically established as a reliable way to predict individual events.

Display the disclosure near the result and preserve it when copying/sharing. Do not imply that a human astrologer reviewed the text unless that actually happened.

### FR-05: Zodiac and Celestial Scene

The app shall provide an interactive Three.js scene with a zodiac wheel/ring, twelve symbols, at least three stylized celestial bodies, shader-driven effects, a star field or subtle particle effect, smooth controlled movement, and a readable fallback if WebGL cannot initialize.

Selecting a symbol highlights it and updates a localized information panel. Hover cannot be the only interaction. Provide pause/resume and respect reduced-motion preferences where feasible. The scene must not block access to horoscope controls.

### FR-06: Custom GLSL Shaders

Implement at least two original effects.

**Shader A — Planet Surface / Atmosphere**

- Vertex shader places the sphere and passes required attributes.
- Fragment shader creates a stylized surface using procedural noise, gradients, or another documented technique.
- Optional fresnel-like rim lighting or atmospheric glow.
- Expose parameters such as time, color, glow intensity, and noise scale as uniforms.
- Provide a reduced-cost version or disable the effect in Low quality mode.

**Shader B — Zodiac / Star Field Effect**

Choose twinkling stars, glowing zodiac glyphs/constellation lines, or a procedural nebula/energy ring. Keep the source version-controlled, document attributes/uniforms/math, allow it to be disabled, and drive animation using elapsed time rather than frame count.

A third shader or post-processing effect is optional. Do not add expensive effects before the base scene and performance measurements are stable.

### FR-07: Scene Controls

Provide working controls for animation pause/resume, ambient effect intensity, planet glow intensity, star count/density, Low/Medium/High quality, and restoring defaults. Controls must modify the actual renderer or shader state.

### FR-08: Performance Panel

An optional collapsible panel may show FPS estimate, average frame time, p95 frame time, Three.js draw calls and triangle counts, active star/particle count, render scale, and quality preset. Label estimates accurately. Do not present renderer statistics as total application GPU cost or exact VRAM usage. Avoid blocking GPU readbacks in the main loop.

### FR-09: Responsive and Multilingual Experience

The app shall work on desktop, tablet, and mobile. Localized layouts must support text expansion, accented/special characters, date/number formatting, keyboard navigation, touch controls, and locale-aware metadata. The UI must not hardcode text inside components; use translation dictionaries/messages. Recompute scene dimensions after resize/orientation changes and show a fallback if WebGL is unavailable.

### FR-10: Copy and Share

Users may copy a horoscope to the clipboard. Copied text must include localized sign, period/theme, horoscope text, assembly date where relevant, and the localized AI-generated notice/disclaimer. Use the Clipboard API with error handling and a manual-copy fallback. Social integrations and authentication are out of scope for the MVP.

### FR-11: Loading and Error States

Provide localized states for initial load, content retrieval/composition, success, database/network failure, rate limit reached, unsupported locale/content, invalid request, WebGL unavailable, and reduced-quality mode. The loading label must not suggest that an AI model is generating text live. Permit retry after errors and avoid infinite spinners.

### FR-12: “Show Another” and Repetition Avoidance

The application shall allow a user to request another horoscope for the same sign/period/theme/locale, when sufficient content exists.

- The algorithm should avoid the last N composition fingerprints supplied by the client (suggested N = 10–20), after validation and size limits.
- A new composition should prefer not to reuse the same title/opening/reflection prompt immediately.
- Repetition avoidance must not produce incoherent or invalid combinations.
- Client-side recent IDs may be stored locally; no account or server-side personal history is required for the MVP.
- If no unseen valid combination remains, the app may reuse a result only after showing a clear message, or ask the user to broaden the selected theme/period.

### FR-13: Content Bank Health and Coverage

Add a script/report that measures content coverage by locale, sign, period, theme, required slot, approved status, and content version. It shall identify missing translations, empty pools, low-variation scopes, duplicate hashes, and combinations that fail compatibility rules. The app must not expose draft/unapproved content.

## 7. Pre-generated Horoscope Content and Composition Engine

### 7.1 Core architecture

Horoscope text is created ahead of time, not generated synchronously for each visitor. The architecture has two separate workflows:

1. **Content production workflow:** a protected script calls the AI provider in batches, saves candidate content to local JSON/JSONL artifacts, validates structure and safety, runs duplicate/coverage checks, optionally supports editorial review, and imports approved records into Supabase.
2. **User request workflow:** a server-side endpoint reads eligible approved content, composes a result using deterministic rules plus controlled variation, validates the result, and returns it without calling the AI provider.

This separation improves response speed, protects model credentials, controls AI spending, and makes results reproducible. The content generation script must support dry-run, bounded batches, retry/resume, output validation, and estimated token/cost reporting where the provider exposes usage.

### 7.2 Content block design

Do not concatenate arbitrary paragraphs at random. Create reusable blocks with an explicit role and compatibility metadata. Suggested slots:

- `title`
- `opening`
- `overview` or `core_theme`
- `focus`
- `relationships` (when selected/relevant)
- `work` (when selected/relevant)
- `personal_growth` or `practical_reflection`
- `reflection_prompt`
- `closing`

Each content block should carry at least:

- `id` (UUID or stable ID)
- `locale` (for example `en` or `ru`)
- `sign_id` (specific sign or `null` for broadly reusable content)
- `period` (`daily`, `weekly`, or an explicitly documented reusable scope)
- `theme` (`general`, `relationships`, `work`, `growth`, or a documented reusable scope)
- `slot` (the role in the assembled result)
- `narrative_arc_id` (groups blocks that can tell a coherent story together)
- `variant_group` or `variant_key`
- `body` and optional `title`
- `tags` and `excluded_tags`/compatibility constraints
- `weight` or selection priority
- `content_hash` for exact duplicate detection
- `content_version`, `prompt_version`, and source model/provider metadata
- `status` (`draft`, `approved`, `retired`)
- `created_at` and optional `reviewed_at`

All returned text must be pre-generated and approved. A block with no locale-specific approval must not be silently used in a different language.

### 7.3 Supabase data model

Supabase Postgres is the production source of truth for the published content bank. Use SQL migrations for schema changes and a seed/import script for content. Suggested tables:

- `supported_locales`: locale code, localized display name, enabled state, default state.
- `zodiac_sign_translations`: stable sign ID, locale, display name, accessible description.
- `content_blocks`: fields described above, with indexes for locale, sign, period, theme, slot, narrative arc, status, and version.
- `content_versions` or `content_batches`: generation batch ID, prompt version, model, language, status, created/imported timestamp, and notes for QA/reproducibility.
- Optional `composition_metrics_daily`: aggregate counts for successful compositions, low-content warnings, and errors. Do not store personal reading history by default.

Use UUIDs or stable keys. Store only the required content and metadata. Add database constraints for allowed locale/sign/period/theme/slot/status values where practical. Consider partial indexes for published/approved content. Keep queries narrowly filtered and capped.

### 7.4 Composition algorithm

The composition engine must be implemented as a pure, testable TypeScript module with no UI or database calls inside its core selection function. Database access loads an eligible pool; the composition engine assembles the final result from that pool.

Recommended algorithm:

1. Validate the requested locale, sign, period, theme, and date/time-zone context.
2. Load only `approved` content for that locale and scope. Prefer sign-specific material for slots that should identify the sign; permit sign-agnostic blocks only where metadata explicitly allows reuse.
3. Identify narrative arcs with sufficient eligible blocks for every required slot.
4. Rank eligible arcs using coverage, fit to theme/period, recent repetition, and optional weights.
5. Select an arc, then select one block for each required slot within that arc.
6. Reject combinations that violate `excluded_tags`, duplicate-slot rules, or other compatibility constraints.
7. Prefer varied openings, titles, and reflection prompts. Avoid recent composition IDs and repeated key fragments when a valid alternative exists.
8. Assemble a result in a fixed, localized structure with safe formatting and localized labels.
9. Validate the completed result against a schema and length limits.
10. Compute a stable `compositionId` from the selected block IDs and content version, and return the result with assembly metadata.
11. If the combination fails validation, try another bounded candidate combination. After a small configured retry limit, return a localized unavailable/error response rather than looping indefinitely or invoking a live model.

Use weighted selection or seeded pseudo-randomness to balance variety and reproducibility. The seed may combine a server-generated nonce, current content version, time period, and a client-provided recent-composition list. Do not use arbitrary string concatenation without validation. Daily results may use the user's validated IANA time zone to compute a display date, but timezone must not be used to claim astrological calculations that are not implemented.

The exact implementation can use a two-stage process (choose an arc, then choose compatible blocks) or a constraint-scored candidate search. It must be bounded, testable, and explainable. Do not generate every possible combination in advance.

### 7.5 Variety targets and measurement

The content bank must be large enough to create many coherent variants, not merely many raw combinations that read badly.

- Initial release should target at least **1,000 valid theoretical compositions per supported locale/sign/period/theme scope**, after applying compatibility constraints, wherever the combination is declared fully supported.
- A coverage report must calculate the actual number of valid combinations or a conservative estimate; do not claim this target is met based on raw Cartesian-product counts alone.
- Start with a practical pool of around 6 or more approved variants per required slot within each supported narrative arc where content scope allows, then expand based on coverage reports and observed repetition.
- Include automated checks for exact duplicates and near-duplicate wording. Near-duplicate checks may use normalized text similarity or embeddings offline, but a similarity score must not replace human judgment.
- Track the percentage of combinations rejected by compatibility checks and how often “Show another” cannot find an unseen composition.
- Avoid presenting theoretical combinatorial counts as guaranteed unique or equally high-quality published horoscopes.

### 7.6 Local JSON files and Supabase

Support the following workflow:

- Generated candidates are first written to local JSON/JSONL files so they can be inspected, validated, diffed, and backed up.
- Approved batches are imported into Supabase using a server-side script with administrative credentials.
- Tests use fixture files and a mocked repository, not a live Supabase database or paid AI provider by default.
- A sanitized content snapshot may be kept in the repository for local development; the full content bank should normally live in Supabase to avoid large, frequently changing source files.
- Provide export and re-import scripts so the content bank is not locked into one service.

### 7.7 Performance and caching

- Query only the candidate pool needed for the requested locale/scope and use indexes.
- Consider a short-lived server-side/data cache for approved candidate pools, keyed by locale, sign, period, theme, and content version.
- Do not rely on a Vercel function's in-memory cache for correctness or persistence.
- Cache candidate pools, not an accidentally shared user-specific result. If caching final results is introduced, the cache key and variation policy must be explicit.
- Do not require a database write for every horoscope request; avoid storing full reading history by default.
- Set a request timeout and a bounded selection/retry count. Do not call the AI provider as a fallback.

### 7.8 Supabase Free-tier considerations

Design for a small content bank and low operational overhead. The Supabase pricing page currently lists 500 MB database size and states that Free projects pause after one week of inactivity; it also lists limits for egress and active projects. These quotas can change, so verify them before launch: [Supabase pricing](https://supabase.com/pricing).

The expected initial text corpus should be small compared with the database limit, but keep content concise, index only useful query paths, monitor database size/egress, and document what happens if the project is paused. For a public production service that cannot tolerate automatic pausing, review whether a paid plan is required. Do not describe a free plan as an uptime guarantee.

### 7.9 Content safety and QA

The pre-generation pipeline shall instruct the AI model to produce calm, non-deterministic, non-alarmist, culturally respectful content; avoid claims about unavoidable events, death, disasters, health diagnoses, medical treatment changes, legal outcomes, or financial returns; and keep all suggestions framed as optional reflection prompts.

Before importing a batch:

- Validate schema, locale, slot, lengths, and allowed values.
- Confirm every content record has the correct locale and content version.
- Reject empty, malformed, dangerous, or out-of-scope records.
- Detect exact duplicates and flag near duplicates.
- Ensure all required slots and arcs have sufficient approved coverage.
- Check locale-specific disclaimer and style guidance.
- Support draft/approved/retired statuses. Only approved content may be served publicly.
- Store prompt/model metadata for reproducibility but do not expose internal prompts or provider credentials.

A human editorial review step is recommended before a new locale or major content batch is marked production-ready. If no human review is performed, documentation must not imply that a human astrologer or editor approved the content.

## 8. Internationalization, Astrology Data, and Scientific Transparency

### 8.1 Supported locales

The architecture must support adding locales without rewriting components, the composition algorithm, or the schema. Proposed initial languages are English (`en`) and Russian (`ru`). Keep the enabled-locale list configurable and add a locale only when both UI translations and an adequate approved horoscope content bank are available.

Requirements:

- Localize navigation, controls, labels, errors, loading states, forms, accessibility labels, metadata, disclaimer, and copy/share strings.
- Localize zodiac names and informational text.
- Format dates and times using the selected locale and the chosen time-zone behavior.
- Use locale-prefixed URLs and ensure navigation preserves the active sign/theme where practical.
- Provide a visible manual locale switcher.
- Use browser language preference only for initial negotiation; do not override a manually chosen locale on every visit.
- Keep translation keys and content IDs stable and independent of display strings.
- Provide locale-specific tests for missing keys, invalid date formats, and untranslated UI text.

### 8.2 Horoscope content localization

Horoscope fragments must be separately pre-generated or translated as part of the controlled content-production pipeline, validated, and stored per locale. Runtime composition must not translate fragments using an AI provider. If the chosen locale has no complete eligible content pool, show a localized availability message or require the user to select a supported content language. Never silently mix languages or present an English fallback as if it were in the selected language.

Localization QA must account for idioms, tone, grammatical gender where relevant, text expansion, and cultural context. The disclaimer must be reviewed for every supported language.

### 8.3 MVP astrology data

Zodiac sign and horoscope requests do not require a birth date, exact birth time, or birth location. Store stable sign IDs in application data/database metadata and keep localized display names separate.

### 8.4 Planetary positions

The initial scene is decorative. If a future release adds “current sky” or natal chart functionality, use a documented ephemeris/astronomy library or trusted data source; define timezone and coordinate conventions; separate astronomy calculations from astrological interpretations; pass computed positions as structured data; and test known reference cases. Do not ask an LLM to invent astronomical positions and present them as calculated facts.

### 8.5 No false scientific claims

Do not imply that shader animation represents a measured force affecting the user, that planetary visualization proves an event will occur, that AI interpretation has validated predictive power, or that an interpretation is personalized from birth data that was never provided.

## 9. Privacy and Security

### 9.1 Data minimization

- Do not require user accounts for the MVP.
- Do not collect birth details unless a later feature genuinely needs them.
- Do not store personal reading history by default.
- If recent-composition IDs are used, prefer client-side local storage and cap the number/length sent to the server.
- Aggregate operational metrics where possible; do not log full horoscope reading history or unnecessary identifiers.
- Document that AI-generated source content is created through a third-party AI provider during batch production.

### 9.2 Secret management

- Store AI provider credentials, Supabase administrative keys, and other secrets only in server-side environment variables.
- Never prefix secret keys with `NEXT_PUBLIC_`.
- Do not commit `.env.local` or secret values.
- Configure environment variables separately for local, preview, and production deployments.
- Do not return database errors, SQL details, provider errors, prompts, stack traces, or secrets to the client.

Suggested variables (use the exact names supported by the selected SDK):

```text
AI_PROVIDER_API_KEY=...
AI_PROVIDER_MODEL=...
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

The service-role/admin key is server-only and must never be included in client code. The public/anon key may be exposed only if access is properly restricted by grants and Row Level Security; prefer serving the content through the application API so drafts and the full content-production bank are not directly exposed.

### 9.3 Supabase access controls

- Enable Row Level Security on tables exposed through Supabase APIs.
- Do not assume RLS policies remove existing SQL grants; review both grants and policies.
- Use least-privilege policies for any browser-accessible data.
- Keep content-generation/import operations server-side.
- Keep the `service_role` or secret key exclusively on the server because it bypasses RLS.
- Do not allow anonymous visitors to insert, update, or delete content bank records.
- Prefer public application endpoints for approved content retrieval, or provide a deliberate read-only policy if direct client access is specifically required.

See [Supabase Row Level Security documentation](https://supabase.com/docs/guides/database/postgres/row-level-security).

### 9.4 Input and output safety

Validate every request server-side; render content as plain text or safely escaped text; do not execute model output; limit payload and response sizes; sanitize optional recent composition identifiers; handle malformed content records; and avoid logging raw generation prompts/results by default. If user accounts or persistent preferences are added later, define retention and deletion behavior.

## 10. Vercel Deployment Requirements

The application must be deployable to Vercel from a Git repository, with Supabase as the managed content database.

### 10.1 Deployment approach

- Use the supported Next.js integration for Vercel.
- Use locale-aware route structure (for example `app/[locale]/...`) and keep API routes outside localized page routing where appropriate.
- Keep the horoscope endpoint server-side and run the composition algorithm without calling the AI provider.
- Keep the batch content-generation and import workflow separate from the public Vercel request path. Run it manually or through a protected administrative process; do not expose a public unauthenticated “generate content” endpoint.
- Keep Three.js rendering in browser-only components.
- Configure secrets in Vercel project settings.
- Use Preview Deployments to validate code and environment settings before Production.

### 10.2 Environment configuration

Provide `.env.example` with placeholder values only, ignore local environment files in Git, document local setup, and explain how to configure variables in Vercel. Only variables deliberately exposed to the browser may use `NEXT_PUBLIC_`. AI credentials and Supabase administrative credentials must remain server-side.

### 10.3 Serverless and database considerations

- Set a request timeout and bounded composition retries.
- Keep database queries narrowly scoped and use appropriate indexes.
- Avoid relying on persistent local filesystem state.
- Do not assume in-memory caches or counters are shared across Vercel function instances.
- Use a durable external service for shared rate limiting or persistent state if later required.
- Avoid a database write for every reading unless a real product requirement justifies it.
- Verify current Vercel and Supabase plan/runtime limits before launch.
- Include a documented response if Supabase is unavailable or the free project has been paused. Show a localized error and retry action; do not silently switch to made-up content.

### 10.4 Production checklist

- [ ] Production build succeeds.
- [ ] Supported locales and default locale are configured.
- [ ] Required Vercel and Supabase environment variables are configured.
- [ ] AI and Supabase admin keys are absent from browser bundles and repository history.
- [ ] `/api/horoscope` validates input and returns only complete approved compositions.
- [ ] User horoscope requests do not call the AI provider.
- [ ] Preview and Production deployments work.
- [ ] Supabase RLS/grants have been reviewed and tested.
- [ ] Missing localized content is handled without silent language mixing.
- [ ] Mobile layout and WebGL rendering are tested on a real device.
- [ ] AI disclosure/disclaimer appears in every supported locale.
- [ ] Third-party service costs, quotas, and free-tier pause behavior are documented.

## 11. Suggested Code Architecture

```text
src/
├── app/
│   ├── [locale]/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── about/page.tsx
│   │   └── horoscope/page.tsx
│   └── api/
│       └── horoscope/route.ts
├── i18n/
│   ├── routing.ts
│   └── request.ts
├── messages/
│   ├── en.json
│   └── ru.json
├── components/
│   ├── horoscope/
│   │   ├── HoroscopeForm.tsx
│   │   ├── HoroscopeResult.tsx
│   │   ├── AIContentNotice.tsx
│   │   ├── LocaleSwitcher.tsx
│   │   └── Disclaimer.tsx
│   ├── zodiac/
│   │   ├── ZodiacSelector.tsx
│   │   └── ZodiacExplorer.tsx
│   ├── scene/
│   │   ├── AstralScene.ts
│   │   ├── Planet.ts
│   │   ├── ZodiacWheel.ts
│   │   └── SceneControls.tsx
│   └── performance/PerformancePanel.tsx
├── lib/
│   ├── content/
│   │   ├── repository.ts
│   │   ├── composeHoroscope.ts
│   │   ├── contentSchema.ts
│   │   └── coverageReport.ts
│   ├── supabase/
│   │   ├── server.ts
│   │   └── types.ts
│   ├── validation/horoscopeRequest.ts
│   └── astrology/zodiacSigns.ts
├── shaders/
│   ├── planet.vert
│   ├── planet.frag
│   ├── stars.vert
│   └── stars.frag
├── scripts/
│   ├── generate-content.ts
│   ├── validate-content.ts
│   ├── import-content.ts
│   ├── export-content.ts
│   └── report-content-coverage.ts
├── supabase/
│   ├── migrations/
│   └── seed/
└── tests/
    ├── compose-horoscope.test.ts
    ├── content-schema.test.ts
    ├── locale-coverage.test.ts
    ├── zodiac-data.test.ts
    └── benchmark-metrics.test.ts
```

This structure is illustrative. Avoid creating modules that add no value to the MVP. Keep the core composition algorithm independent of Supabase and React so it can be tested with local fixtures.

### Module responsibilities

- `LocaleSwitcher`: changes the locale route and preserves compatible page state.
- `messages/*.json`: stores localized UI strings, not the bulk horoscope corpus.
- `repository.ts`: loads only approved content for a validated request scope.
- `composeHoroscope.ts`: pure TypeScript compatibility/selection/assembly logic.
- `contentSchema.ts`: validates generated/imported blocks and completed results.
- `coverageReport.ts`: reports missing slots, locales, and valid-combination estimates.
- `generate-content.ts`: creates candidate content in bounded batches via the AI provider.
- `validate-content.ts`: performs schema, content-safety, duplicate, and locale checks.
- `import-content.ts` / `export-content.ts`: move approved batches between files and Supabase.
- `/api/horoscope`: validates the request, loads content, composes a result, and returns it without invoking AI.
- `AstralScene`: creates and disposes the browser-only Three.js scene.
- `Planet` and `ZodiacWheel`: encapsulate visual objects and interaction.

### 11.1 Suggested database query contract

The repository should expose a small interface such as:

```ts
type HoroscopeRequest = {
  locale: string;
  signId: string;
  period: 'daily' | 'weekly';
  theme: 'general' | 'relationships' | 'work' | 'growth';
  recentCompositionIds?: string[];
  timeZone?: string;
};

interface HoroscopeContentRepository {
  getEligibleBlocks(request: HoroscopeRequest): Promise<ApprovedContentBlock[]>;
}
```

The composition engine should accept already-loaded blocks and a validated request, then return either a valid result or a typed “insufficient content” failure. It must not import the Supabase SDK or call an AI SDK directly.

## 12. Rendering Pipeline and Graphics Requirements

Documentation must explain the core rendering pipeline:

1. CPU-side scene construction and buffer setup.
2. Upload of vertex attributes and uniforms.
3. Vertex shader execution.
4. Primitive assembly, clipping, and rasterization.
5. Fragment shader execution.
6. Depth testing, blending, and framebuffer output.
7. Optional post-processing, if implemented.

The implementation should demonstrate `BufferGeometry`, typed attributes, `ShaderMaterial` or `RawShaderMaterial`, GLSL vertex and fragment stages, uniform updates without unnecessary resource recreation, matrix usage, viewport updates, alpha blending/depth behavior, texture sampling where relevant, resource cleanup with `dispose()`, and animation driven by elapsed time rather than frame count.

Document which calculations run on the CPU and which are performed by the GPU.

## 13. Performance Requirements

### 13.1 Quality presets

Provide three presets with documented configuration values:

- **Low:** reduced render scale, fewer stars/particles, simplified shader, no expensive post-processing.
- **Medium:** balanced visual quality and performance.
- **High:** more stars/particles and full shader effects within safe limits.

Adjust preset values based on test results rather than treating them as universal hardware guarantees.

### 13.2 Performance targets

Define a test scene and target devices before making claims. Suggested desktop objective: aim for 60 FPS in Medium quality on a named reference device and p95 frame time at or below/near 16.7 ms where feasible. For mobile, use a named real device; stable 30 FPS may be an acceptable initial target for a heavier scene. Report actual results alongside browser, device, resolution, render scale, and quality settings.

### 13.3 Optimization techniques

- Reuse geometry and materials.
- Use instanced rendering for repeated stars or symbols.
- Avoid allocating new objects or arrays every frame.
- Limit draw calls and overdraw.
- Reduce pixel ratio/render scale when needed.
- Simplify fragment-shader calculations in Low quality mode.
- Pause non-essential animation when the tab is hidden.
- Dispose of geometries, materials, and textures on teardown.
- Keep post-processing optional.

### 13.4 Performance evidence

For at least two optimizations, document the baseline, applied change, device/browser and scene configuration, warm-up and measurement duration, average and p95 frame time where available, before/after result, and visual/memory trade-offs. Do not fabricate benchmark data. Mark results as pending until actually measured.

## 14. Accessibility and UX

- All controls must have accessible labels.
- Zodiac selection must work with keyboard input, not just pointer hover.
- Provide visible focus styles and readable text contrast.
- Do not encode meaning through color alone.
- Support reduced-motion preferences where practical.
- Provide a pause button for animation.
- Keep visual effects from reducing text readability.
- Keep the AI disclosure near horoscope content.
- On mobile, prioritize reading and avoid making the 3D scene take the entire screen by default.

## 15. Testing and Validation

### Unit tests

Test at least:

- Zodiac metadata contains all 12 unique stable sign IDs and localized display names.
- Locale configuration has a valid default and no duplicate locale IDs.
- Missing translations are detected for required UI keys.
- Request validation rejects unknown locales, signs, periods, themes, invalid time zones, and oversized recent-ID lists.
- Content block schema validation rejects missing slots, invalid status, and malformed locale metadata.
- Composition uses only approved blocks in the requested locale.
- Composition does not violate arc/tag compatibility constraints.
- The output has all required slots and the requested sign/period/theme/locale.
- Repetition avoidance prefers an unseen valid composition when possible.
- The algorithm terminates within its retry limit when pools are small or incompatible.
- Composition IDs are stable for identical selected block IDs and content versions.
- Copy/share formatting includes the localized AI notice and disclaimer.
- Coverage reports catch missing slots and estimate valid combination counts conservatively.
- Performance metric aggregation is correct if a profiler panel is included.

### Content pipeline tests

Verify:

- The generation script supports dry-run and bounded batches.
- AI candidates are written to local artifacts before import.
- Malformed or unapproved records cannot be published.
- Exact duplicate records are detected.
- Import is idempotent or safely detects duplicate content IDs/hashes.
- Only approved content is returned by the production repository.
- Language coverage and minimum composition target are measured separately for each supported scope.
- No user request path invokes the AI provider.

Use mocked AI and repository adapters by default so tests do not incur AI costs or require a live database.

### API tests

Verify valid requests return a complete composition; invalid input is rejected; a missing/paused/unreachable database results in a localized error; insufficient content does not trigger live generation; request limits are enforced; internal database details and secrets are not leaked; and Supabase admin keys are absent from browser bundles.

### Graphics tests

Verify the scene initializes in a supported browser, symbols can be selected, shader controls affect output, pause/resume works, resize/orientation is handled, Low quality reduces actual rendering work, resources are released on teardown, and the UI remains useful if WebGL is unavailable.

### Localization tests

For every supported locale, verify navigation, all form controls, loading/error states, horoscopes, disclaimer, copy/share text, zodiac names, and accessible labels. Check that long translated labels do not overflow common screen sizes. Fail CI if required translation keys are missing.

### Manual device testing

Test at least one desktop browser and one real mobile device/browser. Validate mouse/touch interaction, tab backgrounding and returning, portrait/landscape, locale switching, horoscope generation from the content bank, “Show another,” empty-pool/database failure, and reduced-motion settings where supported.

## 16. Acceptance Criteria

- [ ] The app can be run locally with documented commands and deploys to Vercel.
- [ ] At least English (`en`) and Russian (`ru`) are fully implemented as initial locales, with the locale list configurable.
- [ ] UI strings, zodiac names, errors, disclaimer, dates, and copy/share content are localized.
- [ ] Switching language preserves the selected sign where practical and never mixes languages within a horoscope.
- [ ] All 12 zodiac signs, daily/weekly period, and supported themes are selectable.
- [ ] A pre-generated content bank is stored in Supabase and local file fixtures/import-export scripts are available.
- [ ] The public horoscope endpoint validates the request and returns a complete approved composition.
- [ ] Normal horoscope requests do not call the AI provider.
- [ ] A separate batch workflow can generate, validate, approve, import, export, and version AI content.
- [ ] The composition algorithm respects slots, narrative arcs, locale, theme, period, compatibility, and exclusion rules.
- [ ] “Show another” prefers a different valid composition and handles pool exhaustion honestly.
- [ ] A report identifies missing locales/scopes and calculates actual or conservative valid combination counts.
- [ ] Every result is labeled as AI-generated/pre-generated and includes the localized entertainment/self-reflection disclaimer.
- [ ] Supabase access controls are tested; secret/admin keys remain server-side.
- [ ] The stylized zodiac scene renders using Three.js and at least two custom GLSL effects.
- [ ] Scene controls modify actual rendering behavior.
- [ ] A fallback is available if WebGL cannot initialize.
- [ ] At least one performance/quality control has a measurable rendering effect.
- [ ] Unit, content pipeline, API, and locale tests cover the main failure paths.
- [ ] The app has been tested in a desktop browser and on a real mobile device.
- [ ] README and technical documentation cover i18n, content generation/import, composition, Supabase, Vercel, shaders, and limitations.
- [ ] No astronomical-accuracy, uniqueness, scientific-prediction, or performance claims are made without supporting implementation/evidence.

## 17. Repository Deliverables

The repository should contain:

- Application source code and GLSL shader source.
- Package manifest and lockfile.
- `.env.example` with placeholders only.
- Locale configuration and one message dictionary per supported locale.
- Supabase SQL migrations and least-privilege access policies.
- Content generation, validation, import, export, and coverage-report scripts.
- A small sanitized JSON/JSONL fixture for local development and tests.
- Automated unit/API/content pipeline tests.
- `README.md` with local setup, Vercel deployment, Supabase setup, language support, and content workflow.
- `docs/architecture.md` describing Next.js, i18n, Supabase, composition engine, and scene boundaries.
- `docs/content-pipeline.md` describing prompts, schema, batch generation, review, deduplication, import/export, and versioning.
- `docs/localization.md` describing adding a locale and approving its content bank.
- `docs/shaders.md` describing shader math and GPU costs.
- `docs/ai-disclosure.md` with localized disclaimer wording and placement.
- `docs/performance.md` describing testing methodology and actual measurements if collected.
- Screenshots or a short demo recording.
- A list of known limitations, provider costs, current free-tier assumptions, and future work.

## 18. Implementation Plan

### Milestone 1 — Foundation and i18n

- Set up Next.js, TypeScript, linting, formatting, and tests.
- Add locale-prefixed routing and dictionaries for English and Russian.
- Create the responsive layout, locale selector, sign metadata, and localized AI notice/disclaimer.

**Exit condition:** the UI changes language correctly and discloses AI generation in each initial locale.

### Milestone 2 — Supabase content model

- Create migrations for locales, localized sign metadata, content blocks, and content batches/versions.
- Define grants and RLS policies; keep administrative operations server-side.
- Add repository interfaces and JSON fixture support.
- Add content schema validation and coverage reporting.

**Exit condition:** approved sample content can be stored/retrieved securely and coverage gaps are reported.

### Milestone 3 — Pre-generation pipeline

- Implement the batch AI provider adapter and prompt templates.
- Generate candidate blocks per locale/scope in bounded batches.
- Write files before import; add schema, safety, duplicate, and locale checks.
- Add draft/approved workflow and idempotent import/export.

**Exit condition:** a reproducible content batch can be generated, validated, imported, and exported without exposing provider keys.

### Milestone 4 — Composition engine and API

- Implement the pure TypeScript algorithm.
- Add narrative arcs, slot selection, compatibility/exclusion rules, and repetition avoidance.
- Add `/api/horoscope` with no AI-provider call in the request path.
- Add localized loading/error/empty states and “Show another”.
- Measure valid combinations for each fully supported scope.

**Exit condition:** requests return coherent, localized results quickly from the content bank and fail safely when content is missing.

### Milestone 5 — Three.js scene

- Implement the browser-only scene, zodiac wheel, and selectable symbols.
- Add stylized planet geometry and at least two custom GLSL effects.
- Add pause/resume, quality controls, and the performance panel.

**Exit condition:** the scene is interactive, responsive, and uses original GLSL shaders.

### Milestone 6 — Performance and deployment

- Optimize repeated objects and resource lifecycle.
- Test a representative desktop and mobile device.
- Configure Vercel and Supabase environment variables.
- Deploy Preview, verify database and locale behavior, then deploy Production.
- Document quotas, database inactivity/pause behavior, and fallback experience.

**Exit condition:** the public deployment works without exposing secrets and supports every locale advertised in the UI.

### Milestone 7 — Portfolio polish

- Polish design and responsive states.
- Add screenshots/demo video and complete technical documentation.
- Publish actual performance results and content coverage reports when measured.

**Exit condition:** a reviewer can run the app, inspect content generation/composition, reproduce tests, and understand limitations.

## 19. Definition of Done

A feature is complete only when it works in the target environment; controls reflect real behavior; loading, error, and empty states are covered; secrets and user data are handled appropriately; resources are cleaned up where applicable; relevant tests or manual validation are complete; limitations are documented; and any performance or accuracy claim is supported by evidence.

## 20. Risks and Mitigations

| Risk                                                           | Mitigation                                                                                                                     |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| The result is a random collage instead of a coherent horoscope | Assemble within narrative arcs; use typed slots, compatibility/exclusion tags, validation, and bounded retry.                  |
| Many theoretical combinations are repetitive or low quality    | Measure valid combinations, deduplicate exact/near duplicates, vary opening/title/reflection, and support review.              |
| A requested language has too little content                    | Gate locale availability on coverage thresholds; never mix languages silently; run a coverage report before enabling a locale. |
| AI content has deterministic or alarming claims                | Use a constrained pre-generation prompt, content QA, safety checks, and a visible localized disclaimer.                        |
| AI generation costs grow unexpectedly                          | Batch generation, dry-run and usage reporting, manual imports, bounded jobs, and provider spending alerts.                     |
| Public users access draft content or database admin operations | Server-side repository, RLS/grants review, least privilege, and no public content-generation endpoint.                         |
| Supabase Free limits or project pause affect availability      | Monitor quotas, document pause behavior, handle outages gracefully, and evaluate paid hosting if uptime is required.           |
| Vercel serverless caches are mistaken for persistent storage   | Use Supabase as source of truth; make correctness independent of in-memory cache.                                              |
| Secret keys leak to the browser                                | Keep AI and Supabase administrative credentials server-only and inspect built bundles.                                         |
| WebGL performance varies by device                             | Provide quality presets, reduced effects, and real-device tests.                                                               |
| Decorative planets are mistaken for real astronomy             | Label the scene as stylized unless ephemeris calculations are implemented.                                                     |
| Translation changes break layout or tone                       | Test text expansion and localized copy; review disclaimers and content per locale.                                             |
| Scope expands excessively                                      | Ship two locales, reliable composition, and one excellent interactive scene before adding natal charts/live sky data.          |

## 21. Recommended Priorities

For the strongest initial release, prioritize in this order:

1. Correct locale routing, complete English/Russian UI, and consistent localized disclaimer.
2. Supabase content schema and secure retrieval path.
3. Reliable batch pre-generation, validation, import/export, and content coverage reports.
4. A coherent composition engine with measured diversity and repetition avoidance.
5. Fast public horoscope requests that never call the AI provider live.
6. A high-quality zodiac wheel and shader-driven planets.
7. Responsive/mobile rendering and measured optimization.
8. Additional locales only after their content libraries meet the coverage and QA bar.

A smaller, coherent, fast multilingual experience is more valuable than a large set of nominally supported languages with thin content or a large raw combination count that hides poor text quality.

## 22. Official References

Verify the current documentation during implementation:

- Next.js internationalization: https://nextjs.org/docs/app/guides/internationalization
- `next-intl` documentation: https://next-intl.dev/docs/getting-started
- Supabase pricing and Free plan quotas: https://supabase.com/pricing
- Supabase Row Level Security: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase database indexes: https://supabase.com/docs/guides/database/postgres/indexes
- Next.js Route Handlers: https://nextjs.org/docs/app/getting-started/route-handlers
- Vercel environment variables: https://vercel.com/docs/environment-variables
- Vercel deployment environments: https://vercel.com/docs/deployments/environments
- Vercel Function limits: https://vercel.com/docs/functions/limitations
- Three.js ShaderMaterial: https://threejs.org/docs/pages/ShaderMaterial.html
- Three.js WebGLRenderer: https://threejs.org/docs/pages/WebGLRenderer.html
- Three.js renderer info: https://threejs.org/docs/pages/Info.html
- MDN WebGL best practices: https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices

The Supabase pricing page currently lists 500 MB of database size on the Free plan and says Free projects pause after one week of inactivity. These quotas and policies can change; confirm them before launch. This document does not treat the Free plan as an uptime guarantee.

These links are implementation references, not substitutes for testing the exact dependency versions, project configuration, database policies, and hosting plans selected for AstralCanvas.
