# Shaders & 3D scene (Milestone 5)

**Status: implemented.** `/[locale]/explorer` renders a browser-only Three.js scene (r186): a zodiac wheel with 12 selectable, per-sign-colored glyphs each backed by a pulsing additive glow, five shader-driven celestial bodies, a single-draw-call star field, occasional falling stars, and switchable arcane lines linking each sign to a celestial body — animated by four original GLSL programs. Source: `src/lib/explorer/createZodiacScene.ts` (engine), `src/shaders/planet.ts` (A: planet surface), `src/shaders/stars.ts` (B: star field), `src/shaders/glow.ts` (C: glyph glow), `src/shaders/meteor.ts` (D: falling-star streak), `src/lib/explorer/sceneConfig.ts` (pure preset/control tables, unit-tested).

The scene is decorative by design (spec §8.4–8.5): positions, orbits, sign colors, and sign→body links are stylized set dressing, not ephemeris data, and the page says so next to the canvas in both locales.

## Loading and lifecycle

- The explorer page is a static server component; only `ExplorerScene` (`'use client'`) ships interactivity. The engine module is **dynamically imported inside the mount effect**, so nothing WebGL-related runs during SSR and `three` stays out of the page's initial JS chunk.
- WebGL is probed with `isWebglAvailable()` before the renderer is constructed; construction failures fall back to a readable notice while the DOM sign guide keeps working (FR-05).
- Animation is elapsed-time driven (`THREE.Clock` accumulated only while unpaused). Rendering pauses on hidden tabs (`visibilitychange` + browser-level rAF suspension) and while the user presses Pause (a paused scene re-renders only when something visibly changes).
- Every geometry/material/texture is `dispose()`d on teardown; the renderer context is released. The frame loop allocates nothing (preallocated raycaster/vectors, ring-buffer stats, scalar uniforms mutated in place).

## Rendering pipeline (spec §12)

1. **CPU — scene construction (once):** wheel group, ring `LineLoop`, 12 glyph `Sprite`s (canvas textures) each paired with a billboarded glow quad, 5 planet `Mesh`es sharing **one** `SphereGeometry`, orbit `LineLoop`s, one `Points` object whose 9 000-star buffer is filled once (`position`, `aSeed`, `aSize`, `aTemp` typed attributes), a 3-mesh meteor pool, and one `LineSegments` object for the arcane links.
2. **CPU — per frame:** advance simulation time; update planet positions (5 × trig), wheel rotation (drag inertia + auto-rotate), glyph scale easing, meteor lifecycles (≤3), link endpoints (12 × 2 world positions into a preallocated buffer), and ~40 scalar uniforms (`uTime`, controls). No objects or arrays are created.
3. **Uniform upload:** Three.js diff-and-upload of changed uniforms each frame; no shader recompiles at runtime (quality switches ride uniform branches).
4. **Vertex stage:** Shader A transforms each sphere vertex and derives world normal/view direction varyings; Shader B computes per-star twinkle (2 `sin` calls from `aSeed`), perspective point-size attenuation, and writes color temperature + alpha varyings.
5. **Rasterization:** spheres rasterize as opaque front-to-front meshes; stars rasterize as GL points; sprites as screen-aligned quads.
6. **Fragment stage:** Shader A evaluates hash-based value-noise fbm (1/2/4 octaves by `uQuality`), a two-stop palette gradient, a wrapped light term, and a fresnel rim; Shader B computes a soft radial falloff with a hot core.
7. **Output merging:** planets write depth; stars use additive blending with `depthWrite: false`; the canvas is alpha-composited over the page background (no post-processing).

### CPU vs GPU responsibility split

| CPU (per frame)                                | GPU (per frame)                                    |
| ---------------------------------------------- | -------------------------------------------------- |
| 5 planet orbital positions (10 trig calls)     | fbm noise × 5 spheres (octaves by preset)          |
| wheel rotation, drag inertia decay             | palette gradient + wrapped lighting                |
| glyph scale easing (12 lerps)                  | fresnel rim (skipped when `uRim = 0` at Low)       |
| ~20 uniform value writes                       | per-star twinkle, size attenuation, radial falloff |
| raycast on pointer events only (not per frame) | additive blending of ~800–4 000 points             |

## Shader A — planet surface + atmosphere

Files: `src/shaders/planet.ts` (vertex + fragment). One `ShaderMaterial` per body (5 total) sharing one geometry; per-body look comes from uniforms.

**Attributes** (built-in): `position`, `normal`.
**Varyings:** `vObjPos` (object-space, drives the noise field), `vWorldNormal`, `vViewDir`.

| Uniform          | Type  | Meaning                                                   | Driven by                  |
| ---------------- | ----- | --------------------------------------------------------- | -------------------------- |
| `uTime`          | float | elapsed seconds; drifts the noise field                   | engine clock               |
| `uColorA/B`      | vec3  | two-stop surface palette (bands → highlands)              | per-planet spec            |
| `uGlowIntensity` | float | fresnel rim strength                                      | FR-07 "Planet glow" slider |
| `uNoiseScale`    | float | noise spatial frequency                                   | per-planet spec            |
| `uQuality`       | float | fbm octave count 1 / 2 / 4 (uniform branch, no recompile) | quality preset             |
| `uRim`           | float | 1.0 normally, 0.0 at Low (rim term removed)               | quality preset             |
| `uEffects`       | float | global effects intensity multiplier                       | FR-07 "Effects" slider     |

**Math:** 3-D value noise from a documented integer hash (`hash3`), smoothstep-interpolated, fbm-summed; banding via `sin(y·6 + n·5)` for a gas-giant look; light term `dot(N,L)·0.6 + 0.45` (soft wrap); rim `pow(1 − N·V, 2.6)`.

## Shader B — star field

Files: `src/shaders/stars.ts`. All stars draw in **one call** (`THREE.Points` + one `BufferGeometry`); the visible count changes via `setDrawRange` — no reallocation, so the density slider is effectively free on the CPU.

**Attributes:** `position` (spherical shell, r ∈ [18, 46]), `aSeed` (random phase/frequency), `aSize` (1.1–3.4 px), `aTemp` (0 cool → 1 warm, skewed cool).
**Varyings:** `vAlpha` (twinkle result), `vTemp`.

| Uniform       | Type  | Meaning                                   | Driven by      |
| ------------- | ----- | ----------------------------------------- | -------------- |
| `uTime`       | float | elapsed seconds; twinkle phase            | engine clock   |
| `uPixelRatio` | float | renderer pixel ratio (device-pixel sizes) | quality preset |
| `uEffects`    | float | brightness multiplier                     | effects slider |

**Math:** twinkle `0.72 + 0.28·sin(uTime·freq(aSeed) + phase(aSeed))` in the **vertex** stage (one sin per star, not per fragment); size `aSize · 14 / max(1, −mvPos.z)`, clamped; fragment falloff `smoothstep(0.5, 0.05, d)` plus a hot core `smoothstep(0.16, 0, d)`, discarded below alpha 0.01; additive blending, no depth writes.

## Shader C — zodiac glyph glow

Files: `src/shaders/glow.ts`. One billboarded additive quad behind each glyph (12 + 12 draw objects total). Sign identity reads by hue: element-family colors with per-sign variation (`SIGN_COLORS` in the engine — fire warm, earth moss, air sky, water teal); the glyph sprite itself is tinted with the same color.

**Attributes** (built-in): `position`, `uv`.
**Uniforms:** `uColor` (per-sign), `uTime`, `uPhase` (per-glyph pulse offset), `uIntensity` (base by state: selected 1.6 / hover 1.1 / rest 0.8, × glow slider), `uEffects`.
**Math:** radial core `pow(1 − d, 2.2)` with `d = |uv − 0.5|·2`, pulsing `0.75 + 0.25·sin(uTime·1.4 + uPhase)`; additive, `depthWrite: false`.

## Shader D — falling star (meteor streak)

Files: `src/shaders/meteor.ts`. A fixed pool of three billboarded quads, reused forever: the engine spawns one every 2.5–7.5 s of simulated time, flies it diagonally across the upper sky for ~0.9–1.4 s with a sin-envelope fade (`uFade`), then hides it. No allocation happens at spawn time — only scalar/vec3 mutations on preallocated meshes.

**Uniforms:** `uColor` (pale gold), `uFade` (life-cycle envelope 0→1→0).
**Math:** head fade `pow(uv.x, 2.5)` toward the head at +x, thickness softening `pow(1 − |uv.y − 0.5|·2, 1.6)`; additive.

## Arcane links (switchable)

Not a shader — one additive `LineSegments` draw call (12 segments) whose endpoints are recomputed in world space every frame (glyph world position → its linked celestial body, mapping inspired by traditional rulerships where the five bodies allow it; decorative per §8.4). The visible toggle (`controls.links` checkbox) flips `lines.visible`; opacity pulses gently and scales with the effects slider.

## Quality presets and controls (FR-07, §13.1)

Presets (`sceneConfig.ts`, unit-tested): **Low** ×0.75 pixel ratio / 1 500-star cap / 1 octave / no rim · **Medium** ×1.25 / 4 500 / 2 / rim · **High** ×2.0 / 9 000 / 4 / rim; the buffer is allocated once at 9 000. The caps multiply with the density slider via `visibleStarCount()`. Preset values are engineering estimates revisited against measurements (`docs/performance.md`) — not hardware guarantees.

Controls modify real renderer/shader state: pause/resume stops time accumulation and (re)starts the frame loop; effects and glow sliders write shader uniforms (glow drives both the planets' fresnel rim and the glyph halos); star density rewrites the draw range; quality presets change pixel ratio, uniforms, and draw range together; the arcane-links checkbox toggles the link draw call; Restore Defaults reapplies all of it. `prefers-reduced-motion` starts the scene paused (still fully explorable) and disables auto-rotation.

## Selection and accessibility (§14)

Glyphs are raycast-pickable by pointer (click, after drag discrimination); the same selection is available as a DOM button group (12 native buttons with `aria-pressed`), so keyboard users get identical behavior and hover is never the only path. The canvas itself carries an `aria-label` description. The selected sign updates a localized panel (name, element, approximate dates via `Intl.DateTimeFormat`, description, deep link to `/?sign=<id>`). On mobile the canvas is capped at ≤ 48 vh (measured 38 vh at 390 × 740) and all controls/content stay scrollable beneath it.

## Performance panel (FR-08)

Collapsed by default; shows FPS estimate, average/p95 frame time (ring buffer of the last 180 **rendered** frames — pause/tab-hidden frames are excluded by construction), draw calls and triangles from `renderer.info`, visible stars, render scale, and preset. Values are labeled renderer-level estimates; there are no GPU readbacks in the loop. Real numbers live in `docs/performance.md`.
