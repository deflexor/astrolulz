/**
 * Shader D — falling star / meteor streak (owner request, 2026-10-24;
 * medieval restyle 2026-10-26: the additive light streak became an ink
 * stroke — a sepia comet drawn across the chart, fading like drying ink).
 *
 * A billboarded quad with a dense head fading into a tail along local +x.
 * Life-cycle fade (uFade) is driven by the engine, so the streak appears,
 * crosses the sheet, and dissolves without any reallocation — a pool of
 * three meshes is reused forever.
 */

export const meteorVertexSource = /* glsl */ `
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const meteorFragmentSource = /* glsl */ `
precision mediump float;

varying vec2 vUv;

uniform vec3 uColor; // sepia drawing ink
uniform float uFade; // 0..1 life-cycle envelope

void main() {
  float head = pow(vUv.x, 2.0);                       // dense at x = 1 (head)
  float thickness = 1.0 - abs(vUv.y - 0.5) * 2.0;     // feather toward edges
  thickness = pow(max(0.0, thickness), 1.4);
  float a = head * thickness * uFade * 0.8;
  if (a < 0.01) discard;
  gl_FragColor = vec4(uColor, a);
}
`;
