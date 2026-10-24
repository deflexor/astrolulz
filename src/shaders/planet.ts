/**
 * Shader A — planet surface + atmosphere (spec FR-06, docs/shaders.md).
 *
 * Original GLSL. The vertex stage transforms the sphere and passes
 * object-space position and world-space normal as varyings; the fragment
 * stage builds a stylized surface from two octaves-of-value-noise bands
 * (fbm, octave count selected by the uQuality uniform — no recompiles),
 * a two-stop palette gradient, a single stylized light term, and an optional
 * fresnel rim for atmospheric glow (disabled at Low quality via uRim).
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

uniform float uTime;            // elapsed seconds (drives surface flow)
uniform vec3 uColorA;           // palette stop 1 (bands/lowlands)
uniform vec3 uColorB;           // palette stop 2 (highlands)
uniform float uGlowIntensity;   // fresnel rim strength (FR-07 glow slider)
uniform float uNoiseScale;      // spatial frequency of the surface bands
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

void main() {
  // Surface flow: the noise field drifts slowly along one axis. Decorative
  // motion only (spec §8.4) — nothing here simulates rotation or weather.
  vec3 samplePos = vObjPos * uNoiseScale + vec3(uTime * 0.03, 0.0, uTime * 0.015);

  float n = fbm(samplePos);
  // Stretch the noise into latitude-ish bands for a gas-giant look.
  float bands = 0.5 + 0.5 * sin(vObjPos.y * 6.0 + n * 5.0);
  float surface = clamp(n * 0.75 + bands * 0.35, 0.0, 1.0);

  vec3 color = mix(uColorA, uColorB, smoothstep(0.15, 0.85, surface));

  // One stylized light: fixed direction, soft wrap for a painterly look.
  vec3 lightDir = normalize(vec3(0.55, 0.65, 0.52));
  float diff = clamp(dot(normalize(vWorldNormal), lightDir) * 0.6 + 0.45, 0.0, 1.0);
  color *= diff;

  // Fresnel rim / atmosphere: pow(1 - N·V, p), dropped entirely at Low.
  float rim = pow(1.0 - clamp(dot(normalize(vWorldNormal), normalize(vViewDir)), 0.0, 1.0), 2.6);
  color += uColorB * rim * uRim * uGlowIntensity * uEffects * 1.6;

  gl_FragColor = vec4(color, 1.0);
}
`;
