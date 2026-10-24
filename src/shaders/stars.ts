/**
 * Shader B — star field backdrop (spec FR-06, docs/shaders.md).
 *
 * Original GLSL. All stars render in a single draw call from one
 * BufferGeometry (THREE.Points): per-star attributes carry a random seed,
 * a size, and a color temperature. Twinkle phases are derived from the seed
 * in the vertex stage (one sin per star per frame — vertex-stage work is far
 * cheaper than per-fragment), and the fragment stage draws a soft radial
 * falloff with additive blending, so no depth sorting or depth writes are
 * needed.
 *
 * Animation is driven exclusively by uTime (elapsed seconds); no frame
 * counting, and no per-frame attribute updates from the CPU.
 */

export const starVertexSource = /* glsl */ `
attribute float aSeed;   // per-star random 0..1 (phase + twinkle frequency)
attribute float aSize;   // base point size in px before attenuation
attribute float aTemp;   // color temperature 0..1 (cool blue .. warm gold)

uniform float uTime;         // elapsed seconds
uniform float uPixelRatio;   // renderer pixel ratio (sizes are in device px)
uniform float uEffects;      // global effects intensity (brightness)

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
  // Soft radial core: quadratic falloff from the point center.
  float d = length(gl_PointCoord - vec2(0.5));
  float falloff = smoothstep(0.5, 0.05, d);
  float core = smoothstep(0.16, 0.0, d) * 0.85;

  // Temperature ramp: cool blue-white .. neutral .. warm gold.
  vec3 cool = vec3(0.62, 0.72, 1.0);
  vec3 warm = vec3(1.0, 0.85, 0.58);
  vec3 starColor = mix(cool, warm, vTemp);

  float alpha = (falloff + core) * vAlpha;
  if (alpha < 0.01) discard; // skip fully faded fragments early

  gl_FragColor = vec4(starColor * alpha, alpha); // premultiplied-ish for additive
}
`;
