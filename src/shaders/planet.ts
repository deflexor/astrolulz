/**
 * Shader A — drawn planet: ink engraving on parchment (spec FR-06,
 * docs/shaders.md; medieval restyle 2026-10-26).
 *
 * Original GLSL. The vertex stage transforms the sphere and passes
 * object-space position and world-space normal as varyings. The fragment
 * stage styles the sphere like an etched plate in an old astronomical
 * manuscript: a paper-colored ground, two crossed hatch fields in stable
 * object space whose ink density follows the light, a hand-drawn silhouette
 * outline, and a small gilded glint (gold leaf catching candlelight).
 *
 * Everything is procedural — no textures are sampled.
 */

export const planetVertexSource = /* glsl */ `
varying vec3 vObjPos;
varying vec3 vWorldNormal;
varying vec3 vViewDir;

void main() {
  vObjPos = position;
  vWorldNormal = normalize(mat3(modelMatrix) * normal);
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  vViewDir = normalize(cameraPosition - worldPos.xyz);
  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`;

export const planetFragmentSource = /* glsl */ `
precision mediump float;

varying vec3 vObjPos;
varying vec3 vWorldNormal;
varying vec3 vViewDir;

uniform float uTime;            // elapsed seconds (drives slow plate drift)
uniform vec3 uPaper;            // ground color of this body's plate
uniform vec3 uInk;              // ink color of this body's drawing
uniform float uGlowIntensity;   // gilded glint strength (FR-07 glow slider)
uniform float uNoiseScale;      // spatial frequency of the surface mottling
uniform float uQuality;         // 1 | 2 | 4 — fbm octave count
uniform float uRim;             // 0.0 at Low quality, 1.0 otherwise
uniform float uEffects;         // global effects intensity (FR-07 slider)

// Hash-based 3D value noise (iq-style; documented, deterministic).
float hash3(vec3 p) {
  p = fract(p * 0.3183099 + vec3(0.71, 0.113, 0.419));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

float valueNoise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f); // smoothstep interpolation
  float n000 = hash3(i);
  float n100 = hash3(i + vec3(1.0, 0.0, 0.0));
  float n010 = hash3(i + vec3(0.0, 1.0, 0.0));
  float n110 = hash3(i + vec3(1.0, 1.0, 0.0));
  float n001 = hash3(i + vec3(0.0, 0.0, 1.0));
  float n101 = hash3(i + vec3(1.0, 0.0, 1.0));
  float n011 = hash3(i + vec3(0.0, 1.0, 1.0));
  float n111 = hash3(i + vec3(1.0, 1.0, 1.0));
  return mix(
    mix(mix(n000, n100, f.x), mix(n010, n110, f.x), f.y),
    mix(mix(n001, n101, f.x), mix(n011, n111, f.x), f.y),
    f.z
  );
}

float fbm(vec3 p) {
  // Octave count comes from the uQuality uniform (1/2/4). A uniform branch
  // is coherent across the warp, so this costs nothing extra per preset.
  float sum = 0.0;
  float amp = 0.5;
  if (uQuality >= 1.0) { sum += amp * valueNoise(p); p *= 2.02; amp *= 0.5; }
  if (uQuality >= 2.0) { sum += amp * valueNoise(p); p *= 2.03; amp *= 0.5; }
  if (uQuality >= 4.0) {
    sum += amp * valueNoise(p); p *= 2.01; amp *= 0.5;
    sum += amp * valueNoise(p);
  }
  return sum;
}

// One field of hand-drawn hatching: ink lines along a slightly skewed
// direction, returned as 0 (paper) .. 1 (full ink on the line).
float hatchField(vec2 p, float freq, float width) {
  float v = fract(p.x * freq + p.y * 0.13);
  float d = abs(v - 0.5) / freq;
  return smoothstep(width, 0.0, d);
}

void main() {
  vec3 N = normalize(vWorldNormal);
  vec3 V = normalize(vViewDir);

  // Surface flow: the mottling drifts slowly along one axis. Decorative
  // motion only (spec §8.4) — nothing here simulates rotation or weather.
  vec3 samplePos = vObjPos * uNoiseScale + vec3(uTime * 0.03, 0.0, uTime * 0.015);
  float n = fbm(samplePos);
  float bands = 0.5 + 0.5 * sin(vObjPos.y * 6.0 + n * 5.0);
  float surface = clamp(n * 0.75 + bands * 0.35, 0.0, 1.0);

  // One stylized light, fixed direction, soft wrap.
  vec3 lightDir = normalize(vec3(0.55, 0.65, 0.52));
  float diff = clamp(dot(N, lightDir) * 0.6 + 0.45, 0.0, 1.0);

  // Engraving: hatching in stable object space (slightly warped for a
  // hand-drawn wobble); darker tone opens the crossed second field.
  vec2 hp = vObjPos.xy * 3.0 + n * 0.6;
  float tone = pow(1.0 - diff, 1.4);
  float h1 = hatchField(hp, 9.0, 0.014 + (1.0 - diff) * 0.006);
  float h2 = hatchField(hp.yx + 13.7, 11.0, 0.011);
  float hatch = max(h1, h2 * smoothstep(0.2, 0.7, tone));
  float ink = clamp(tone * 1.3 - 0.18, 0.0, 1.0);

  // Silhouette outline: the drawn pen ring around the body.
  float rim = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 1.6);
  float outline = smoothstep(0.5, 0.92, rim) * mix(0.6, 1.0, uRim);

  float inkAmount = clamp(hatch * ink + outline * 0.95 + surface * 0.15, 0.0, 1.0);
  vec3 color = mix(uPaper, uInk, inkAmount);

  // Gilded glint: a small tight highlight, gold leaf catching candlelight —
  // kept subtle so the engraved hatching stays the dominant read.
  vec3 H = normalize(lightDir + V);
  float spec = pow(clamp(dot(N, H), 0.0, 1.0), 64.0);
  color += vec3(0.55, 0.38, 0.10) * spec * uEffects * uGlowIntensity * 0.45;

  gl_FragColor = vec4(color, 1.0);
}
`;
