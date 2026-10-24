/**
 * Explorer scene configuration (spec §13.1 quality presets, FR-07 controls).
 *
 * Pure data — no Three.js imports — so presets and control ranges can be
 * unit-tested and reviewed without a browser. Preset values are initial
 * engineering estimates, not measured guarantees; they are revisited against
 * recorded frame-time evidence (docs/performance.md) as it lands.
 */

export type SceneQualityId = 'low' | 'medium' | 'high';

export interface QualityPreset {
  /** Device-pixel-ratio cap for the WebGL drawing buffer. */
  maxPixelRatio: number;
  /** Upper bound of visible stars (the density control scales below it). */
  starCap: number;
  /** Planet-noise octaves in the fragment shader (uniform branch, not a recompile). */
  noiseOctaves: 1 | 2 | 4;
  /** Fresnel rim term is dropped entirely at Low quality. */
  rimEnabled: boolean;
}

export const QUALITY_PRESETS: Record<SceneQualityId, QualityPreset> = {
  low: { maxPixelRatio: 0.75, starCap: 1500, noiseOctaves: 1, rimEnabled: false },
  medium: { maxPixelRatio: 1.25, starCap: 4500, noiseOctaves: 2, rimEnabled: true },
  high: { maxPixelRatio: 2, starCap: 9000, noiseOctaves: 4, rimEnabled: true },
};

export const DEFAULT_QUALITY: SceneQualityId = 'medium';

/** Slider ranges for the FR-07 controls (0..1 normalized on the UI side). */
export const CONTROL_RANGES = {
  effectsIntensity: { min: 0, max: 1, step: 0.05 },
  glowIntensity: { min: 0, max: 1, step: 0.05 },
  starDensity: { min: 0.1, max: 1, step: 0.05 },
} as const;

export const CONTROL_DEFAULTS = {
  effectsIntensity: 0.8,
  glowIntensity: 0.7,
  starDensity: 0.7,
} as const;

/** Largest star buffer ever allocated; presets/density only change drawRange. */
export const STAR_BUFFER_CAPACITY = 9000;

export function clampControl(name: keyof typeof CONTROL_RANGES, value: number): number {
  const { min, max } = CONTROL_RANGES[name];
  if (Number.isNaN(value)) return CONTROL_DEFAULTS[name];
  return Math.min(max, Math.max(min, value));
}

/** Visible star count for a preset × density (never above the buffer cap). */
export function visibleStarCount(quality: SceneQualityId, density: number): number {
  const cap = QUALITY_PRESETS[quality].starCap;
  return Math.min(STAR_BUFFER_CAPACITY, Math.floor(cap * clampControl('starDensity', density)));
}

/**
 * Maps the quality id onto the planet shader's uQuality uniform. The fragment
 * shader branches on this float (1 / 2 / 4 noise octaves); branches on a
 * uniform are warp-coherent, so no recompilation or shader permutation is
 * needed when the preset changes.
 */
export function noiseOctavesUniform(quality: SceneQualityId): number {
  return QUALITY_PRESETS[quality].noiseOctaves;
}
