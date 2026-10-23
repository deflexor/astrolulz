# Shaders & 3D scene (Milestone 5 — design, not yet implemented)

**Status: design document.** The Three.js scene is Milestone 5 of the spec and has **not been implemented yet**. The `/[locale]/explorer` page is an honest placeholder. Dependencies (`three@0.186.1`, `@types/three`) are pinned and installed. Nothing in this document should be read as a claim about shipped behavior.

## Planned scene

- Browser-only client component (dynamic import, `ssr: false`) — the server must never touch WebGL APIs (spec §4.1).
- Zodiac wheel/ring with the 12 glyphs (`ZODIAC_SIGNS` symbols), selectable by pointer **and** keyboard (hover is never the only interaction).
- Stylized Sun, Moon, and planets as shader-driven spheres — **decorative**, not astronomically positioned (spec §8.4).
- Star field / particle backdrop; readable fallback UI when WebGL cannot initialize.

## Shader A — planet surface + atmosphere

- **Vertex stage:** standard sphere transform; pass world-space normal and position as varyings.
- **Fragment stage:** procedural surface via layered value/simplex noise (documented hash function), a two-stop gradient per planet palette, and a fresnel rim (`pow(1.0 - dot(N, V), p)`) for atmospheric glow.
- **Uniforms:** `uTime`, `uColorA`, `uColorB`, `uGlowIntensity`, `uNoiseScale`, `uQuality` (Low preset drops noise octaves and the rim term via a preprocessor-style branch).
- **Cost notes:** noise octaves dominate; Low quality reduces from ~4 octaves to 1 and halves the render scale.

## Shader B — star field / zodiac ring

- Instanced points (`THREE.Points` with a single `BufferGeometry`; per-star attributes: seed, size, color temperature).
- **Vertex stage:** size attenuation by distance; per-star twinkle phase from the seed attribute.
- **Fragment stage:** soft radial falloff (`smoothstep` on `gl_PointCoord` distance), alpha modulated by `sin(uTime * freq + phase)` for twinkling; additive blending, depth write off.
- **Cost notes:** instanced single draw call; star count per quality preset (e.g. High 4000 / Medium 2000 / Low 800 — final numbers from measurement, not assumption).

## Engineering rules (from spec §12–13)

- Elapsed-time-driven animation (`clock.getElapsedTime()`), never frame count.
- `dispose()` every geometry/material/texture on teardown; no per-frame allocations.
- Instanced rendering for repeated stars/glyphs; reuse geometries and materials.
- Pause rendering when the tab is hidden (`visibilitychange`); respect `prefers-reduced-motion` (pause auto-rotation, keep interaction).
- Rebuild aspect/viewport on resize/orientation change.
- A performance panel (collapsed by default) may expose FPS estimate, average/p95 frame time, draw calls, triangles — all labeled as renderer-level estimates, never total GPU cost or VRAM.

When the scene lands, this document gains the real attribute/uniform tables and the CPU-vs-GPU responsibility breakdown the spec requires.
