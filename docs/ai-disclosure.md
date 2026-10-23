# AI disclosure

Every user-facing surface that shows horoscope text also discloses what it is. This page records the canonical wording and where it appears. Disclosure version: **v1** (`DISCLAIMER_VERSION` in `src/lib/content/types.ts`, returned in every API result).

## Canonical wording

**English (en):**

> **AI-generated content:** All horoscopes on AstralCanvas are AI-generated and assembled from pre-generated AI-written content. They are intended for entertainment and self-reflection only, not as factual predictions or professional advice. Astrology is not scientifically established as a reliable way to predict individual events.

**Russian (ru):**

> **Контент, созданный ИИ:** Все гороскопы на AstralCanvas созданы ИИ заранее и собраны из предварительно написанного ИИ-контента. Они предназначены только для развлечения и саморефлексии, а не для фактических предсказаний или профессиональных консультаций. Астрология не признана наукой как надёжный способ предсказывать события в жизни человека.

Short form (footer, result badge): "AI-generated · assembled from pre-written AI content · for entertainment" / «Создано ИИ · собрано из заранее написанного ИИ-контента · для развлечения».

## Placement

| Surface                                    | Implementation                                                                                                 |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| Home page, above the controls (persistent) | `AIContentNotice` in `src/app/[locale]/page.tsx`                                                               |
| Every horoscope result (below the text)    | `AIContentNotice` inside `HoroscopeResultView`                                                                 |
| Copy/share text                            | `buildShareText` always appends the full localized notice (`src/lib/content/shareText.ts`, tested)             |
| API metadata                               | `generatedByAI: true`, `generationMode: "pre-generated-composition"`, `disclaimerVersion`                      |
| Footer                                     | short form via `SiteFooter`                                                                                    |
| Dedicated page (no horoscope required)     | `/[locale]/about` — how it's made, entertainment-not-advice, science, limitations, decorative visuals, privacy |

## Rules

- Each locale ships a reviewed, human-written disclosure; no machine-translated fallback at runtime.
- The wording states clearly that content is _pre-generated and algorithmically assembled_, never implying a live AI call or a human astrologer.
- Changing the wording means updating both dictionaries, bumping `DISCLAIMER_VERSION`, and updating this file.
