/**
 * Shared procedural-parchment GLSL (owner request, 2026-10-26: medieval
 * redesign — "old paper with drawn planets and zodiac signs").
 *
 * Original GLSL. `paperCommon` is concatenated into every paper-style
 * fragment shader (the explorer background quad here, and the standalone
 * fire-lit card in src/lib/parchment). Everything is procedural — no textures
 * are sampled: vellum color, long paper fibers, water stains/blotches, and an
 * aged darkened vignette.
 */

export const paperCommon = /* glsl */ `
float paperHash(vec2 p) {
  p = fract(p * vec2(234.34, 435.345));
  p += dot(p, p + 34.23);
  return fract(p.x * p.y);
}

float paperNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = paperHash(i);
  float b = paperHash(i + vec2(1.0, 0.0));
  float c = paperHash(i + vec2(0.0, 1.0));
  float d = paperHash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float paperFbm(vec2 p) {
  float sum = 0.0;
  float amp = 0.5;
  for (int i = 0; i < 4; i++) {
    sum += amp * paperNoise(p);
    p = p * 2.03 + vec2(11.7, 5.3);
    amp *= 0.5;
  }
  return sum;
}

// Parchment base color: warm vellum with anisotropic fibers, large soft
// water stains, sparse darker blotches, and a darkened aged vignette.
vec3 parchmentBase(vec2 uv, float aspect) {
  vec2 st = vec2(uv.x * aspect, uv.y);

  float fibers =
    paperNoise(vec2(st.x * 320.0, st.y * 42.0)) * 0.5 +
    paperNoise(vec2(st.x * 42.0, st.y * 320.0)) * 0.5;

  float stains = paperFbm(st * 2.4);
  float blotch = smoothstep(0.58, 0.95, paperFbm(st * 3.1 + 7.0)) * 0.10;

  vec3 paper = vec3(0.918, 0.862, 0.712); // vellum #eaddb6
  paper *= 0.965 + 0.07 * fibers;
  paper *= 1.0 - 0.14 * smoothstep(0.45, 0.85, stains);
  paper -= blotch * vec3(0.10, 0.09, 0.06);

  vec2 q = uv - 0.5;
  float vig = smoothstep(0.42, 0.95, length(q * vec2(aspect, 1.0)));
  paper *= 1.0 - 0.20 * vig;
  return paper;
}
`;

/**
 * Background quad for the explorer scene: a camera-independent fullscreen
 * parchment behind every drawn body. The candle flicker is deliberately
 * gentle — it sets material, it does not compete with the ink work.
 */
export const parchmentVertexSource = /* glsl */ `
varying vec2 vUv;

void main() {
  vUv = uv;
  // Fullscreen background quad: clip-space directly, camera never moves it.
  gl_Position = vec4(position.xy * 2.0, 0.99999, 1.0);
}
`;

export const parchmentFragmentSource = /* glsl */ `
precision mediump float;

varying vec2 vUv;

uniform float uTime;     // elapsed seconds
uniform float uAspect;   // canvas width / height
uniform float uEffects;  // global effects intensity (FR-07 slider)

${paperCommon}

void main() {
  vec3 paper = parchmentBase(vUv, uAspect);

  // Candle flicker: one slow breath plus a small fast flutter.
  float flick =
    0.016 * sin(uTime * 6.3) +
    0.011 * sin(uTime * 11.7 + 1.7) +
    0.008 * paperNoise(vec2(uTime * 0.7, 3.1));
  paper *= 1.0 + flick * (0.4 + 0.6 * uEffects);

  // Warm hearth light from below the wheel, like firelight on the desk.
  vec2 q = vUv - vec2(0.5, -0.18);
  float hearth = exp(-dot(q * vec2(1.35, 2.1), q * vec2(1.35, 2.1)) * 3.2);
  paper += vec3(0.10, 0.052, 0.012) * hearth * (0.45 + 0.55 * uEffects) * (1.0 + flick * 5.0);

  gl_FragColor = vec4(paper, 1.0);
}
`;
