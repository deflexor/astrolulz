# Performance

## Status

Milestone 5 (the Three.js scene) is implemented and **first measurements were collected on 2026-10-24** (sections below). Everything not yet measured is explicitly marked **pending** — per spec §13.4, AstralCanvas does not publish numbers it has not measured, and preset values are not treated as hardware guarantees.

## Methodology

- Define the test scene and devices before measuring; name them in every result (browser, GPU, resolution, render scale, quality preset).
- Warm-up period before sampling, then a fixed measurement window (target ≥ 30 s; see caveats on the 2026-10-24 run).
- Collect: average frame time, p95 frame time, FPS estimate, `renderer.info` draw calls and triangles, active star count.
- Instrument: the in-app performance panel — a ring buffer of the last 180 **rendered** frames (paused/tab-hidden frames are excluded by construction), pushed to the UI at most 2×/s. No GPU readbacks in the frame loop.
- Targets (spec §13.2, conditional): desktop ~60 FPS / p95 ≈ 16.7 ms in Medium on a named reference device; mobile stable ~30 FPS on a named real device for a heavier scene.

## Measurements — 2026-10-24

**Environment:** Windows desktop · NVIDIA GeForce RTX 5060 Laptop GPU (ANGLE/D3D11) · Chromium-based in-app browser (WebGL 2.0) · 1280×720 logical viewport · devicePixelRatio 1 (so the Medium/High pixel-ratio caps do not bind; render scale ×1.00, Low ×0.75) · scene defaults, unpaused.

### Scene (renderer estimates via performance panel)

| Preset                        | Visible stars | Render scale | FPS   | Avg frame | p95 frame | Draw calls | Triangles |
| ----------------------------- | ------------- | ------------ | ----- | --------- | --------- | ---------- | --------- |
| Medium (default), 30 s window | 1 400         | ×1.00        | 239.9 | 4.2 ms    | 16.7 ms   | 23         | 14 904    |
| High, 30 s window             | 2 800         | ×1.00        | 469.6 | 2.1 ms    | 16.2 ms   | 23         | 14 904    |
| Low, single ring-buffer read  | 560           | ×0.75        | 180.0 | 5.6 ms    | 16.6 ms   | 23         | 14 904    |

- Medium and High rows: two ring-buffer samples taken 30 s apart during uninterrupted runs — identical after rounding within each run, i.e. stable across each window.
- Low row: one ring-buffer read taken immediately after preset-switch interaction; includes interaction-frame noise.
- **Cross-run FPS/frame-time numbers are not comparable on this rig**: the observed compositor cadence changed between runs (≈240 vs ≈470 FPS caps, see the Medium-vs-High rows — High does strictly more scene work yet reads "faster", which is a compositor artifact, not a scene result). What **is** valid across all rows: draw calls (23) and triangles (14 904) are identical — preset/density changes verified cost-neutral in draw calls — and every p95 sits at ≈16.2–16.7 ms (one 60 Hz frame), indicating compositor pacing rather than scene cost. This GPU is nowhere near the constraint for this scene.
- Draw calls and triangles are identical across presets **by design**: the star field is one draw call whose visible count changes via `setDrawRange`, and GL points are counted by the renderer as points, not triangles.
- **Pending:** the 30 s Low window, the star-density sweep (the Medium ×0.35 run was set up but the measurement pane became occluded before a confirmed stats window — not published as data), and a real mobile device run. The 2026-10-24 session's measurement browser pane could not be kept visible (an occluded Chromium renderer stops delivering animation frames), so the remaining rows were left unmeasured rather than extrapolated.

### Optimizations with evidence (spec §13.4)

1. **Single-draw-call star field with `drawRange` density scaling.**
   - Baseline design alternative: one object (or draw) per star or per star batch — draw calls would scale with star count.
   - Change: all stars live in one `BufferGeometry`/`Points`; preset caps and the density slider only rewrite `geometry.setDrawRange`.
   - Result (device above): 23 draw calls total at 560, 1 400, and 2 800 visible stars — renderer-verified across all three preset windows that star-count changes cost zero additional draw calls and zero triangle inflation.
   - Trade-off: per-star variety must fit in attributes (seed/size/temperature) — it does for twinkle/color; no per-star textures.

2. **Low-preset fragment-cost reduction (fbm octaves 4/2 → 1, fresnel rim removed, ×0.75 render scale).**
   - Baseline: Medium preset (×1.00, 2 octaves, rim on) — 4.2 ms avg / 16.7 ms p95 (30 s window).
   - Change: Low preset (×0.75, 1 octave, rim off) — 5.6 ms avg / 16.6 ms p95 (single noisy read).
   - Result: on this reference GPU the scene is compositor-bound and cross-run cadence varies (see caveat above), so the reduced shader work does **not** show as a frame-time win here — the readings demonstrate the mechanism (independent uniform switches, no recompiles, no reallocation, ×0.75 drawing buffer renderer-reported) rather than a GPU saving. Demonstrating the actual saving requires a constrained GPU or a higher pixel ratio; **marked pending** rather than claimed.
   - Trade-off (visual): fewer noise octaves (flatter surfaces), no atmospheric rim, softer edges at ×0.75.

### API (non-graphics), same machine, local production build

- `POST /api/horoscope` (fixtures path), 12 sequential localhost requests: **avg 16.8 ms, p95 55.8 ms, min 6.8 ms, max 55.8 ms** round-trip including JSON parse. No AI/provider calls exist on this path (architecturally enforced and unit-tested).
- Pages are statically prerendered per locale; only the API is dynamic.
- Database-backed serving timings (Supabase REST): **pending** — requires the production service-role key; the local machine's network also sits behind a TLS-intercepting proxy that distorts direct-connection timings, so these should be measured from the deployed environment.

## Quality presets

Documented in `src/lib/explorer/sceneConfig.ts` (unit-tested) and `docs/shaders.md`. **Raised on 2026-10-24 (second session) after the measurements below were taken**, per owner request for a fuller sky plus the new glyph glows, meteor pool, and arcane links: Low ×0.75 / **1 500** stars / 1 octave / no rim · Medium ×1.25 / **4 500** / 2 / rim · High ×2.0 / **9 000** / 4 / rim (buffer allocated once at 9 000). The 2026-10-24 measurement rows below reflect the **original** caps (800 / 2 000 / 4 000) and a ~23-draw-call scene; the preset table needs re-measurement at the new values — pending, not extrapolated.

Controls modify actual renderer/shader state; Low measurably reduces rendered pixels (×0.75 drawing buffer, renderer-reported). Preset values remain engineering estimates pending wider-device measurement.

## Optimization techniques in force (spec §13.3)

Shared geometry (one sphere for all five bodies; one glow quad and one meteor quad geometry); single-draw-call stars with `drawRange`; zero per-frame allocations (preallocated vectors/buffers, ring-buffer stats, mutated uniforms — meteors spawn by mutating preallocated meshes); bounded draw calls (was ~23 before the 2026-10-24 visual pass; now ~23 + 12 glow quads + up to 3 meteors + 1 links call) and additive no-depth-write effects to limit overdraw cost; render-scale/pixel-ratio reduction in Low; uniform-branch (not recompile) quality switching; animation paused on hidden tabs and by the pause control; full `dispose()` teardown; no post-processing.

## Evidence template (for future rows)

For each optimization: baseline → applied change → device/browser + scene config → warm-up and measurement duration → average and p95 frame time → before/after result → visual/memory trade-offs. Until a row has real data, it stays out of the README.
