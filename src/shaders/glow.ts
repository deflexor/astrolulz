/**
 * Shader C — zodiac glyph halo (owner request, 2026-10-24: "shader effects
 * on zodiac signs, different colors"; medieval restyle 2026-10-26: the
 * additive glow became a pigment wash — a translucent watercolor disc in the
 * sign's own ink behind the glyph, like a tinted ground on a manuscript
 * leaf).
 *
 * A billboarded quad rendered behind each glyph: soft core with a feathered
 * watercolor edge, gently pulsing on a per-glyph phase. The per-sign color
 * arrives as a uniform; the glyph sprite itself is tinted with the same
 * color, so sign identity reads by pigment (element families) and not by
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

uniform vec3 uColor;      // per-sign pigment
uniform float uTime;      // elapsed seconds
uniform float uPhase;     // per-glyph pulse phase
uniform float uIntensity; // base strength (selected glyphs run stronger)
uniform float uEffects;   // global effects intensity (FR-07 slider)

void main() {
  float d = length(vUv - vec2(0.5)) * 2.0;
  // Broad wash plus a denser zone right behind the glyph: watercolor pools
  // toward the center and feathers out at the rim.
  float wash = pow(max(0.0, 1.0 - d), 1.6);
  float pool = smoothstep(0.42, 0.0, d) * 0.6;
  float pulse = 0.75 + 0.25 * sin(uTime * 1.4 + uPhase);
  float a = (wash + pool) * pulse * uIntensity * uEffects;
  if (a < 0.01) discard;
  // Cap the opacity: a wash stains the paper, it never covers it.
  gl_FragColor = vec4(uColor, min(a, 0.85) * 0.55);
}
`;
