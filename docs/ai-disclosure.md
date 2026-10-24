# AI disclosure

The full visible disclosure lives in one place — the About / disclaimer page — plus two always-on metadata surfaces: copied/share text and the API response. This page records the canonical wording and where it appears. Disclosure version: **v1** (`DISCLAIMER_VERSION` in `src/lib/content/types.ts`, returned in every API result).

> **Owner decision (2026-10-24):** the repeated notice panes next to the form/result and the footer short-form line were removed as clutter; the About page (linked from the footer and navigation) carries the full explanation. The disclosure remains part of copied text and API metadata, so horoscope text never circulates without its label.

## Canonical wording

**English (en):**

> **AI-generated content:** All horoscopes on AstralCanvas are AI-generated and assembled from pre-generated AI-written content. They are intended for entertainment and self-reflection only, not as factual predictions or professional advice. Astrology is not scientifically established as a reliable way to predict individual events.

**Russian (ru):**

> **Контент, созданный ИИ:** Все гороскопы на AstralCanvas созданы ИИ заранее и собраны из предварительно написанного ИИ-контента. Они предназначены только для развлечения и саморефлексии, а не для фактических предсказаний или профессиональных консультаций. Астрология не признана наукой как надёжный способ предсказывать события в жизни человека.

## Placement

| Surface                                | Implementation                                                                                                                        |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Dedicated page (single visible notice) | `/[locale]/about` — `AIContentNotice` plus how it's made, entertainment-not-advice, science, limitations, decorative visuals, privacy |
| Copy/share text                        | `buildShareText` always appends the full localized notice (`src/lib/content/shareText.ts`, tested)                                    |
| API metadata                           | `generatedByAI: true`, `generationMode: "pre-generated-composition"`, `disclaimerVersion`                                             |
| Repository README                      | AI disclosure paragraph at the top                                                                                                    |

## Rules

- Each locale ships a reviewed, human-written disclosure; no machine-translated fallback at runtime.
- The wording states clearly that content is _pre-generated and algorithmically assembled_, never implying a live AI call or a human astrologer.
- Changing the wording means updating both dictionaries, bumping `DISCLAIMER_VERSION`, and updating this file.
