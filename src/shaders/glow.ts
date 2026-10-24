/**
 * Shader C — zodiac glyph glow (owner request, 2026-10-24: "shader effects
 * on zodiac signs, different colors").
 *
 * A billboarded additive quad rendered behind each glyph: radial core with a
 * soft quadratic falloff, gently pulsing on a per-glyph phase. The per-sign
 * color arrives as a uniform; the glyph sprite itself is tinted with the
 * same color, so sign identity reads by hue (element families) and not by
 * position alone.
 */

export const glowVertexSource = /* glsl */ `
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const glowFragmentSource = /* glsl */ `
precision mediump float;

varying vec2 vUv;

uniform vec3 uColor;      // per-sign color
uniform float uTime;      // elapsed seconds
uniform float uPhase;     // per-glyph pulse phase
uniform float uIntensity; // base strength (selected glyphs run brighter)
uniform float uEffects;   // global effects intensity (FR-07 slider)

void main() {
  float d = length(vUv - vec2(0.5)) * 2.0;
  // Broad soft halo plus a hot inner zone right behind the glyph: the first
  // version (single pow 2.2 term) read as a thin ring and was nearly
  // invisible against the dark sky (owner feedback, 2026-10-24).
  float halo = pow(max(0.0, 1.0 - d), 1.6);
  float inner = smoothstep(0.42, 0.0, d) * 0.6;
  float pulse = 0.75 + 0.25 * sin(uTime * 1.4 + uPhase);
  float a = (halo + inner) * pulse * uIntensity * uEffects;
  if (a < 0.01) discard;
  gl_FragColor = vec4(uColor * a, a);
}
`;
