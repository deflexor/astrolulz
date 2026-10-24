import { describe, expect, it } from 'vitest';
import {
  CONTROL_DEFAULTS,
  CONTROL_RANGES,
  QUALITY_PRESETS,
  STAR_BUFFER_CAPACITY,
  clampControl,
  visibleStarCount,
  noiseOctavesUniform,
} from '@/lib/explorer/sceneConfig';

describe('explorer scene config (spec §13.1 presets, FR-07 controls)', () => {
  it('presets scale monotonically: low < medium < high', () => {
    expect(QUALITY_PRESETS.low.starCap).toBeLessThan(QUALITY_PRESETS.medium.starCap);
    expect(QUALITY_PRESETS.medium.starCap).toBeLessThan(QUALITY_PRESETS.high.starCap);
    expect(QUALITY_PRESETS.low.maxPixelRatio).toBeLessThan(QUALITY_PRESETS.medium.maxPixelRatio);
    expect(QUALITY_PRESETS.medium.maxPixelRatio).toBeLessThan(QUALITY_PRESETS.high.maxPixelRatio);
  });

  it('low preset is strictly cheaper: single noise octave and no rim', () => {
    expect(QUALITY_PRESETS.low.noiseOctaves).toBe(1);
    expect(QUALITY_PRESETS.low.rimEnabled).toBe(false);
    expect(QUALITY_PRESETS.high.rimEnabled).toBe(true);
  });

  it('no preset allocates more stars than the shared buffer capacity', () => {
    for (const preset of Object.values(QUALITY_PRESETS)) {
      expect(preset.starCap).toBeLessThanOrEqual(STAR_BUFFER_CAPACITY);
    }
  });

  it('visibleStarCount scales with density and never exceeds the preset cap', () => {
    expect(visibleStarCount('high', 1)).toBe(QUALITY_PRESETS.high.starCap);
    expect(visibleStarCount('high', 0.5)).toBe(4500);
    expect(visibleStarCount('low', 1)).toBe(QUALITY_PRESETS.low.starCap);
    expect(visibleStarCount('low', 10)).toBeLessThanOrEqual(QUALITY_PRESETS.low.starCap);
  });

  it('clampControl rejects NaN and clamps out-of-range values', () => {
    expect(clampControl('effectsIntensity', Number.NaN)).toBe(CONTROL_DEFAULTS.effectsIntensity);
    expect(clampControl('starDensity', 5)).toBe(CONTROL_RANGES.starDensity.max);
    expect(clampControl('starDensity', -1)).toBe(CONTROL_RANGES.starDensity.min);
  });

  it('noiseOctavesUniform maps presets onto shader octave counts', () => {
    expect(noiseOctavesUniform('low')).toBe(1);
    expect(noiseOctavesUniform('medium')).toBe(2);
    expect(noiseOctavesUniform('high')).toBe(4);
  });

  it('control defaults are inside their own ranges', () => {
    expect(CONTROL_DEFAULTS.effectsIntensity).toBeGreaterThanOrEqual(
      CONTROL_RANGES.effectsIntensity.min,
    );
    expect(CONTROL_DEFAULTS.effectsIntensity).toBeLessThanOrEqual(
      CONTROL_RANGES.effectsIntensity.max,
    );
    expect(CONTROL_DEFAULTS.glowIntensity).toBeLessThanOrEqual(CONTROL_RANGES.glowIntensity.max);
    expect(CONTROL_DEFAULTS.starDensity).toBeGreaterThanOrEqual(CONTROL_RANGES.starDensity.min);
  });
});
