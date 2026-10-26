/**
 * Fire-lit ragged parchment backdrop for the horoscope leaf (owner request,
 * 2026-10-26: "horoscope text should use shader to look like old ragged
 * paper lit by fire behind the paper and shining through the paper").
 *
 * Vanilla WebGL on purpose — no three.js: the horoscope page must not pay
 * for a scene graph to draw one quad. The module is dynamically imported by
 * the result card, so it stays out of the initial bundle too.
 *
 * Engineering rules mirrored from the explorer scene (docs/shaders.md):
 * elapsed-time-driven animation; zero allocations in the frame loop; render
 * paused when the tab is hidden or the card scrolls offscreen; a static
 * frame under prefers-reduced-motion; full teardown on dispose. On any
 * failure it returns null and the card keeps its CSS parchment fallback.
 */

import { paperCommon } from '@/shaders/paper';

export interface FirePaperOptions {
  prefersReducedMotion?: boolean;
}

export interface FirePaperHandle {
  dispose(): void;
}

const VERTEX_SOURCE = /* glsl */ `
attribute vec2 aPos;
varying vec2 vUv;

void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

const FRAGMENT_SOURCE = /* glsl */ `
precision mediump float;

varying vec2 vUv;

uniform float uTime;    // elapsed seconds
uniform float uAspect;  // width / height of the card
uniform float uSeed;    // per-mount variation of the torn profile

${paperCommon}

float edgeDistance(vec2 uv) {
  vec2 d = min(uv, 1.0 - uv);
  return min(d.x, d.y);
}

void main() {
  vec3 paper = parchmentBase(vUv, uAspect);

  // --- firelight behind the sheet -------------------------------------------
  // Two hearth points along the bottom edge; each breathes with its own mix
  // of slow, medium, and fast flame rhythms. The light "shines through" the
  // paper because the high-frequency fiber grain modulates it.
  float t = uTime;
  float breath = sin(t * 1.1) * 0.5 + sin(t * 2.3 + 1.3) * 0.3 + sin(t * 5.9 + 4.0) * 0.2;
  float sway = sin(t * 0.9 + 2.0) * 0.5 + sin(t * 3.1) * 0.35;

  vec2 f1 = vec2(0.30, -0.06);
  vec2 f2 = vec2(0.72, -0.06);
  float r1 = length((vUv - f1) * vec2(1.0, 1.9));
  float r2 = length((vUv - f2) * vec2(1.0, 1.9));
  float glow = exp(-r1 * 2.4) * (0.75 + 0.25 * breath) + exp(-r2 * 2.7) * (0.75 + 0.25 * sway);

  float grain = paperNoise(vec2(vUv.x * uAspect, vUv.y) * 240.0 + uSeed);
  glow *= 0.7 + 0.55 * grain;

  vec3 fireCol = mix(vec3(0.88, 0.40, 0.10), vec3(1.0, 0.74, 0.28), clamp(glow * 1.3, 0.0, 1.0));
  paper += fireCol * glow * 0.36;

  // --- ragged, torn edges -----------------------------------------------------
  float rough = paperFbm(vUv * vec2(13.0, 9.0) + uSeed) - 0.5;        // coarse tearing
  float fine = paperNoise(vUv * vec2(64.0, 44.0) + uSeed * 3.1) - 0.5; // fibrous bite
  float d = edgeDistance(vUv);
  float torn = d + rough * 0.028 + fine * 0.008;
  float alpha = smoothstep(0.008, 0.020, torn);

  // Scorched rim just inside the tear, as if the edge caught the candle.
  float scorch = smoothstep(0.035, 0.012, torn);
  paper = mix(paper, paper * vec3(0.62, 0.47, 0.30), scorch * 0.65);

  if (alpha < 0.01) discard;
  // Premultiplied output: the default WebGL context composites this canvas
  // onto the dark hall behind the card.
  gl_FragColor = vec4(paper * alpha, alpha);
}
`;

function compile(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.warn('fire-paper shader compile failed:', gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

export function createFirePaperCanvas(
  canvas: HTMLCanvasElement,
  options: FirePaperOptions = {},
): FirePaperHandle | null {
  const reduced = options.prefersReducedMotion ?? false;
  const maybeGl = (canvas.getContext('webgl', {
    alpha: true,
    antialias: false,
    depth: false,
    stencil: false,
    premultipliedAlpha: true,
  }) ?? canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null;
  if (!maybeGl) return null;
  const gl: WebGLRenderingContext = maybeGl;

  const vs = compile(gl, gl.VERTEX_SHADER, VERTEX_SOURCE);
  const fs = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_SOURCE);
  const program = gl.createProgram();
  if (!vs || !fs || !program) {
    if (vs) gl.deleteShader(vs);
    if (fs) gl.deleteShader(fs);
    if (program) gl.deleteProgram(program);
    return null;
  }
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.warn('fire-paper program link failed:', gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    return null;
  }
  gl.useProgram(program);

  // Fullscreen triangle: one buffer, three vertices, covers the canvas.
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(program, 'aPos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const uTime = gl.getUniformLocation(program, 'uTime');
  const uAspect = gl.getUniformLocation(program, 'uAspect');
  const uSeed = gl.getUniformLocation(program, 'uSeed');
  gl.uniform1f(uSeed, (Math.random() * 100) | 0);
  gl.uniform1f(uAspect, 1);

  let disposed = false;
  let running = false;
  let onScreen = true;
  let rafId = 0;
  let lastWidth = 0;
  let lastHeight = 0;

  function draw(now: number): void {
    // Reduced motion: a fixed pleasant phase — the paper looks lit, it just
    // never flickers.
    gl.uniform1f(uTime, reduced ? 7.3 : now / 1000);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  function resize(): void {
    if (disposed) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (w === 0 || h === 0) return;
    const bw = Math.round(w * dpr);
    const bh = Math.round(h * dpr);
    if (bw === lastWidth && bh === lastHeight) return;
    lastWidth = bw;
    lastHeight = bh;
    canvas.width = bw;
    canvas.height = bh;
    gl.viewport(0, 0, bw, bh);
    gl.uniform1f(uAspect, w / h);
    draw(performance.now());
  }

  function frame(now: number): void {
    rafId = 0;
    if (!running) return;
    draw(now);
    rafId = requestAnimationFrame(frame);
  }

  function updateLoop(): void {
    const shouldRun = !reduced && onScreen && !document.hidden;
    if (shouldRun && !running) {
      running = true;
      rafId = requestAnimationFrame(frame);
    } else if (!shouldRun && running) {
      running = false;
      if (rafId) cancelAnimationFrame(rafId);
      rafId = 0;
      draw(performance.now()); // settle on one consistent final frame
    }
  }

  function onIntersection(entries: IntersectionObserverEntry[]): void {
    onScreen = entries[0]?.isIntersecting ?? true;
    updateLoop();
  }

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas);
  const intersectionObserver = new IntersectionObserver(onIntersection);
  intersectionObserver.observe(canvas);
  document.addEventListener('visibilitychange', updateLoop);

  resize();
  updateLoop();

  return {
    dispose() {
      if (disposed) return;
      disposed = true;
      running = false;
      if (rafId) cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      document.removeEventListener('visibilitychange', updateLoop);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      const lose = gl.getExtension('WEBGL_lose_context');
      lose?.loseContext();
    },
  };
}
