/**
 * Shader B — gilded star field (spec FR-06, docs/shaders.md; medieval
 * restyle 2026-10-26: stars read as gilded dots on parchment — gold and
 * tin leaf — not glowing lights).
 *
 * Original GLSL. All stars render in a single draw call from one
 * BufferGeometry (THREE.Points): per-star attributes carry a random seed,
 * a size, and a leaf temperature. Twinkle phases are derived from the seed
 * in the vertex stage (one sin per star per frame — vertex-stage work is far
 * cheaper than per-fragment), and the fragment stage draws a leaf-metal dot
 * with normal transparency, so no depth sorting or depth writes are needed.
 *
 * Animation is driven exclusively by uTime (elapsed seconds); no frame
 * counting, and no per-frame attribute updates from the CPU.
 */

export const starVertexSource = /* glsl */ `
attribute float aSeed;   // per-star random 0..1 (phase + twinkle frequency)
attribute float aSize;   // base point size in px before attenuation
attribute float aTemp;   // leaf temperature 0..1 (gold .. tin)

uniform float uTime;         // elapsed seconds
uniform float uPixelRatio;   // renderer pixel ratio (sizes are in device px)
uniform float uEffects;      // global effects intensity (visibility)

varying float vAlpha;
varying float vTemp;

void main() {
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);

  // Twinkle: two sinusoids with seed-derived frequencies and phases.
  float freq = 0.5 + aSeed * 2.5;
  float phase = aSeed * 6.2831853;
  float twinkle = 0.72 + 0.28 * sin(uTime * freq + phase);
  vAlpha = twinkle * uEffects;
  vTemp = aTemp;

  // Perspective size attenuation, clamped so distant stars stay visible.
  float attenuation = 14.0 / max(1.0, -mvPosition.z);
  gl_PointSize = clamp(aSize * attenuation * uPixelRatio, 1.0, 9.0 * uPixelRatio);

  gl_Position = projectionMatrix * mvPosition;
}
`;

export const starFragmentSource = /* glsl */ `
precision mediump float;

varying float vAlpha;
varying float vTemp;

void main() {
  float d = length(gl_PointCoord - vec2(0.5)) * 2.0;

  // Leaf-metal dot: solid core, feathered edge (a cut foil fleck, not light).
  float core = smoothstep(0.9, 0.45, d);
  vec3 gold = vec3(0.80, 0.62, 0.28);
  vec3 tin = vec3(0.78, 0.76, 0.70);
  vec3 leaf = mix(gold, tin, vTemp);
  // Hotter center, as if the foil catches the candle at an angle.
  leaf *= 0.85 + 0.35 * smoothstep(0.6, 0.0, d);

  float alpha = core * vAlpha;
  if (alpha < 0.02) discard;

  gl_FragColor = vec4(leaf, alpha);
}
`;
