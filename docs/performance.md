# Performance

## Status

**No measurements have been collected yet.** Per spec §13.4, AstralCanvas does not publish performance numbers it has not measured, and does not treat preset values as hardware guarantees. The rendering scene itself (Milestone 5) is not implemented yet, so there is currently nothing 3D to measure.

## Methodology (to be used once Milestone 5 lands)

- Define the test scene and devices **before** measuring; name them in every result (browser, GPU, resolution, render scale, quality preset).
- Warm-up period before sampling (≥ a few seconds), then a fixed measurement window (≥ 30 s).
- Collect: average frame time, p95 frame time, FPS estimate, `renderer.info` draw calls and triangles, active star count, JS heap where available.
- Report via the optional performance panel (collapsed by default, no blocking GPU readbacks in the main loop).
- Targets (per spec §13.2, conditional): desktop ~60 FPS / p95 ≈ 16.7 ms in Medium on a named reference device; mobile stable ~30 FPS on a named real device for a heavier scene.

## Quality presets

Three presets will be defined with measured values (Low/Medium/High: render scale, star count, shader cost). Controls must modify actual renderer/shader state, and Low must measurably reduce rendering work — verified by draw-call/triangle counts, not by assertion.

## Optimization techniques planned (spec §13.3)

Geometry/material reuse; instancing for stars/symbols; zero per-frame allocations; bounded draw calls and overdraw; render-scale/pixel-ratio reduction; simplified fragment math in Low; animation paused on hidden tabs; full `dispose()` teardown; optional post-processing only after the base scene is stable.

## Evidence template

For each optimization: baseline → applied change → device/browser + scene config → warm-up and measurement duration → average and p95 frame time → before/after result → visual/memory trade-offs. Until a row has real data, it stays out of the README.

## Current, measurable facts (no scene required)

- `/api/horoscope` is a Node route handler doing: Zod validation + fixture/DB pool load + pure composition (bounded 32 attempts over pools ≤ 2,000 blocks). Local smoke tests return in the low tens of milliseconds; no provider calls exist on the path (enforced by architecture and tests).
- Pages are statically prerendered per locale; only the API is dynamic.
