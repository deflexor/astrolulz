import * as THREE from 'three';
import { ZODIAC_SIGNS, type ZodiacSignId } from '@/lib/astrology/zodiacSigns';
import {
  CONTROL_DEFAULTS,
  QUALITY_PRESETS,
  STAR_BUFFER_CAPACITY,
  noiseOctavesUniform,
  visibleStarCount,
  type SceneQualityId,
} from './sceneConfig';
import { planetFragmentSource, planetVertexSource } from '@/shaders/planet';
import { starFragmentSource, starVertexSource } from '@/shaders/stars';
import { glowFragmentSource, glowVertexSource } from '@/shaders/glow';
import { meteorFragmentSource, meteorVertexSource } from '@/shaders/meteor';
import { parchmentFragmentSource, parchmentVertexSource } from '@/shaders/paper';

/**
 * Browser-only zodiac scene engine (spec §5.2, FR-05..08, §12–13).
 *
 * Framework-free on purpose: React only mounts/disposes it and mirrors the
 * control state. This module must never be imported from a server component —
 * the ExplorerScene client component loads it with a dynamic import inside an
 * effect, so nothing WebGL-related runs during SSR and three.js stays out of
 * the initial page bundle.
 *
 * Engineering rules honored here (docs/shaders.md):
 * elapsed-time-driven animation; zero allocations in the frame loop; shared
 * geometries; one draw call for all stars; render paused when the tab is
 * hidden or the animation is paused; every resource disposed on teardown.
 */

export interface SceneStats {
  fps: number;
  avgFrameMs: number;
  p95FrameMs: number;
  drawCalls: number;
  triangles: number;
  stars: number;
  renderScale: number;
  quality: SceneQualityId;
  paused: boolean;
}

export interface SceneSettings {
  paused: boolean;
  effectsIntensity: number;
  glowIntensity: number;
  starDensity: number;
  quality: SceneQualityId;
}

export interface ZodiacSceneHandle extends SceneSettings {
  setSelectedSign(signId: ZodiacSignId | null): void;
  setPaused(paused: boolean): void;
  setEffectsIntensity(value: number): void;
  setGlowIntensity(value: number): void;
  setStarDensity(value: number): void;
  setQuality(quality: SceneQualityId): void;
  /** Shows/hides the arcane sign↔planet links (default: visible). */
  setLinksVisible(visible: boolean): void;
  /** Restores every control to its default and returns the effective state. */
  resetToDefaults(): SceneSettings;
  dispose(): void;
}

export interface ZodiacSceneOptions {
  /** Fired when the user picks a glyph with the pointer (keyboard selection
   *  goes through the DOM control group instead). */
  onSignPick?: (signId: ZodiacSignId) => void;
  /** Renderer-level estimates, pushed at most ~2×/s (FR-08). */
  onStats?: (stats: SceneStats) => void;
  prefersReducedMotion?: boolean;
}

const GLYPH_RING_RADIUS = 4.7;
const STATS_WINDOW = 180;
const STATS_INTERVAL_MS = 500;
const METEOR_POOL_SIZE = 3;

/**
 * Per-sign pigment colors (owner request, 2026-10-24: "different colors";
 * medieval restyle 2026-10-26: the neon palette became manuscript pigments —
 * vermilion, azurite, terre verte, indigo, and friends). Element families
 * share a pigment region so the wheel still reads by color. Decorative only
 * (spec §8.4).
 */
const SIGN_COLORS: Record<ZodiacSignId, number> = {
  aries: 0xb4432c, // vermilion
  taurus: 0x6f7a4a, // terre verte
  gemini: 0x4c6c9c, // azurite
  cancer: 0x46618f, // indigo
  leo: 0xc05a2e, // minium (red lead)
  virgo: 0x77743e, // olive earth
  libra: 0x5c7aa3, // pale azurite
  scorpio: 0x6d4a6e, // plum ink
  sagittarius: 0xa8543a, // sanguine
  capricorn: 0x7d5c33, // raw umber
  aquarius: 0x4e8a80, // verdigris
  pisces: 0x4a7f8f, // blue-green copper
};

/**
 * Decorative sign→celestial-body pairing for the arcane links (stylized,
 * inspired by traditional rulerships where the five bodies allow it —
 * spec §8.4: not astronomy). Indexes into PLANETS.
 */
const SIGN_LINK_PLANET: readonly number[] = [4, 3, 2, 1, 0, 2, 3, 4, 0, 4, 3, 1];

interface PlanetSpec {
  orbitRadius: number;
  size: number;
  orbitSpeed: number;
  phase: number;
  /** Ground color of this body's etched plate (parchment tint). */
  colorA: number;
  /** Ink color of this body's drawing. */
  colorB: number;
  noiseScale: number;
}

const PLANETS: readonly PlanetSpec[] = [
  {
    orbitRadius: 0,
    size: 1.05,
    orbitSpeed: 0,
    phase: 0,
    colorA: 0xeadfbc, // sunlit vellum plate
    colorB: 0x4a2c10, // dark umber ink
    noiseScale: 2.6,
  }, // sun
  {
    orbitRadius: 1.35,
    size: 0.32,
    orbitSpeed: 0.42,
    phase: 0.8,
    colorA: 0xf2ead0, // pale moon-vellum
    colorB: 0x3c4258, // slate ink
    noiseScale: 4.0,
  }, // moon
  {
    orbitRadius: 1.95,
    size: 0.3,
    orbitSpeed: 0.3,
    phase: 2.4,
    colorA: 0xeedfb4,
    colorB: 0x4a4038, // grey-brown ink
    noiseScale: 5.0,
  }, // mercury
  {
    orbitRadius: 2.6,
    size: 0.46,
    orbitSpeed: 0.21,
    phase: 4.1,
    colorA: 0xf2e2b0,
    colorB: 0x6d4a1e, // golden-brown ink
    noiseScale: 3.2,
  }, // venus
  {
    orbitRadius: 3.3,
    size: 0.4,
    orbitSpeed: 0.14,
    phase: 5.5,
    colorA: 0xf0dcae,
    colorB: 0x7c3a20, // red-chalk ink
    noiseScale: 3.8,
  }, // mars
];

/** Cheap synchronous WebGL availability probe (no renderer created). */
export function isWebglAvailable(): boolean {
  if (typeof document === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    return !!(canvas.getContext('webgl2') ?? canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

function makeGlyphTexture(symbol: string): THREE.Texture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, size, size);
    ctx.font = '600 86px "Segoe UI Symbol", "Noto Sans Symbols 2", serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(symbol, size / 2, size / 2 + 6);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createZodiacScene(
  container: HTMLElement,
  options: ZodiacSceneOptions = {},
): ZodiacSceneHandle {
  const reducedMotion = options.prefersReducedMotion ?? false;

  // --- renderer / camera ----------------------------------------------------
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance',
  });
  renderer.setClearColor(0xeaddb6, 1); // vellum — matches the page parchment
  container.appendChild(renderer.domElement);
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';
  renderer.domElement.style.display = 'block';
  renderer.domElement.style.touchAction = 'pan-y';

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 120);
  camera.position.set(0, 6.4, 8.4);
  // Aim slightly below the wheel and lift the wheel itself: together this
  // moves the visual center up ~50 px (owner request, 2026-10-24) so the
  // bottom glyph clears the canvas edge with margin.
  camera.lookAt(0, -0.45, 0);

  // --- parchment sheet: camera-independent background quad -------------------
  const bgMaterial = new THREE.ShaderMaterial({
    vertexShader: parchmentVertexSource,
    fragmentShader: parchmentFragmentSource,
    uniforms: {
      uTime: { value: 0 },
      uAspect: { value: 1 },
      uEffects: { value: CONTROL_DEFAULTS.effectsIntensity },
    },
    depthTest: false,
    depthWrite: false,
  });
  const bgQuad = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), bgMaterial);
  bgQuad.renderOrder = -1;
  bgQuad.frustumCulled = false;
  scene.add(bgQuad);

  // --- zodiac wheel: ring, glyphs -------------------------------------------
  const wheel = new THREE.Group();
  wheel.position.y = 0.55;
  scene.add(wheel);

  const ringGeometry = new THREE.BufferGeometry().setFromPoints(
    Array.from({ length: 129 }, (_, i) => {
      const a = (i / 128) * Math.PI * 2;
      return new THREE.Vector3(Math.cos(a) * GLYPH_RING_RADIUS, 0, Math.sin(a) * GLYPH_RING_RADIUS);
    }),
  );
  const ringMaterial = new THREE.LineBasicMaterial({
    color: 0x4a3820, // iron-gall ink rule
    transparent: true,
    opacity: 0.5,
  });
  wheel.add(new THREE.Line(ringGeometry, ringMaterial));

  const glyphColorSelected = new THREE.Color(0xc9a227); // gilded gold leaf

  const glowGeometry = new THREE.PlaneGeometry(2.4, 2.4);
  const glyphGlowMaterials: THREE.ShaderMaterial[] = [];
  const glyphGlowMeshes: THREE.Mesh[] = [];
  // Base glow strength per glyph, rescaled by the glow slider on change.
  const glowBase: number[] = [];

  const glyphSprites = ZODIAC_SIGNS.map((sign, index) => {
    const signColor = new THREE.Color(SIGN_COLORS[sign.id]);

    // Additive pulsing halo behind the glyph (Shader C), billboarded in the
    // frame loop by copying the camera quaternion.
    const glowMaterial = new THREE.ShaderMaterial({
      vertexShader: glowVertexSource,
      fragmentShader: glowFragmentSource,
      uniforms: {
        uColor: { value: signColor },
        uTime: { value: 0 },
        uPhase: { value: (index / ZODIAC_SIGNS.length) * Math.PI * 2 },
        uIntensity: { value: 1.5 * CONTROL_DEFAULTS.glowIntensity },
        uEffects: { value: CONTROL_DEFAULTS.effectsIntensity },
      },
      transparent: true,
      depthWrite: false,
      // Pigment wash: normal transparency stains the parchment; additive
      // blending would bleach it toward white.
      blending: THREE.NormalBlending,
    });
    glyphGlowMaterials.push(glowMaterial);
    glowBase.push(1.5);
    const glow = new THREE.Mesh(glowGeometry, glowMaterial);
    glow.renderOrder = 1;
    wheel.add(glow);
    glyphGlowMeshes.push(glow);

    const material = new THREE.SpriteMaterial({
      map: makeGlyphTexture(sign.symbol),
      transparent: true,
      depthWrite: false,
      opacity: 0.85,
    });
    material.color.copy(signColor);
    const sprite = new THREE.Sprite(material);
    sprite.renderOrder = 2;
    const angle = (index / ZODIAC_SIGNS.length) * Math.PI * 2;
    sprite.position.set(
      Math.cos(angle) * GLYPH_RING_RADIUS,
      0,
      Math.sin(angle) * GLYPH_RING_RADIUS,
    );
    glow.position.copy(sprite.position);
    sprite.userData = { signId: sign.id, baseScale: 0.8, targetScale: 0.8, signColor };
    sprite.scale.setScalar(0.8);
    wheel.add(sprite);
    return sprite;
  });

  // --- planets: Shader A, shared geometry ------------------------------------
  const sphereGeometry = new THREE.SphereGeometry(1, 48, 32);
  const planetMeshes: THREE.Mesh[] = PLANETS.map((spec) => {
    const material = new THREE.ShaderMaterial({
      vertexShader: planetVertexSource,
      fragmentShader: planetFragmentSource,
      uniforms: {
        uTime: { value: 0 },
        uPaper: { value: new THREE.Color(spec.colorA) },
        uInk: { value: new THREE.Color(spec.colorB) },
        uGlowIntensity: { value: CONTROL_DEFAULTS.glowIntensity },
        uNoiseScale: { value: spec.noiseScale },
        uQuality: { value: 2 },
        uRim: { value: 1 },
        uEffects: { value: CONTROL_DEFAULTS.effectsIntensity },
      },
    });
    const mesh = new THREE.Mesh(sphereGeometry, material);
    mesh.scale.setScalar(spec.size);
    wheel.add(mesh);
    return mesh;
  });

  const orbitMaterials: THREE.LineBasicMaterial[] = [];
  PLANETS.forEach((spec) => {
    if (spec.orbitRadius === 0) return;
    const points = Array.from({ length: 97 }, (_, i) => {
      const a = (i / 96) * Math.PI * 2;
      return new THREE.Vector3(Math.cos(a) * spec.orbitRadius, 0, Math.sin(a) * spec.orbitRadius);
    });
    const material = new THREE.LineBasicMaterial({
      color: 0x5a4830, // drawn orbit, lighter ink
      transparent: true,
      opacity: 0.3,
    });
    orbitMaterials.push(material);
    wheel.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(points), material));
  });

  // --- star field: Shader B, single Points draw call --------------------------
  const starGeometry = new THREE.BufferGeometry();
  const starPositions = new Float32Array(STAR_BUFFER_CAPACITY * 3);
  const starSeeds = new Float32Array(STAR_BUFFER_CAPACITY);
  const starSizes = new Float32Array(STAR_BUFFER_CAPACITY);
  const starTemps = new Float32Array(STAR_BUFFER_CAPACITY);
  for (let i = 0; i < STAR_BUFFER_CAPACITY; i++) {
    // Uniform direction × varied radius → spherical shell backdrop.
    const u = Math.random() * 2 - 1;
    const theta = Math.random() * Math.PI * 2;
    const r = 18 + Math.random() * 28;
    const s = Math.sqrt(1 - u * u);
    starPositions[i * 3] = Math.cos(theta) * s * r;
    starPositions[i * 3 + 1] = u * r;
    starPositions[i * 3 + 2] = Math.sin(theta) * s * r;
    starSeeds[i] = Math.random();
    starSizes[i] = 1.1 + Math.random() * 2.3;
    starTemps[i] = Math.random() ** 1.6; // skew toward cool stars, a few warm
  }
  starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
  starGeometry.setAttribute('aSeed', new THREE.BufferAttribute(starSeeds, 1));
  starGeometry.setAttribute('aSize', new THREE.BufferAttribute(starSizes, 1));
  starGeometry.setAttribute('aTemp', new THREE.BufferAttribute(starTemps, 1));
  const starMaterial = new THREE.ShaderMaterial({
    vertexShader: starVertexSource,
    fragmentShader: starFragmentSource,
    uniforms: {
      uTime: { value: 0 },
      uPixelRatio: { value: 1 },
      uEffects: { value: CONTROL_DEFAULTS.effectsIntensity },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.NormalBlending, // gilded dots, not lights
  });
  const stars = new THREE.Points(starGeometry, starMaterial);
  scene.add(stars);

  // --- falling stars: fixed pool, reused forever (Shader D) --------------------
  const meteorGeometry = new THREE.PlaneGeometry(1, 1);
  interface MeteorState {
    mesh: THREE.Mesh;
    material: THREE.ShaderMaterial;
    active: boolean;
    t: number;
    life: number;
    vx: number;
    vy: number;
    speed: number;
  }
  const meteors: MeteorState[] = Array.from({ length: METEOR_POOL_SIZE }, () => {
    const material = new THREE.ShaderMaterial({
      vertexShader: meteorVertexSource,
      fragmentShader: meteorFragmentSource,
      uniforms: {
        uColor: { value: new THREE.Color(0x4a3320) }, // sepia drawing ink
        uFade: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending, // an ink stroke, not a light streak
    });
    const mesh = new THREE.Mesh(meteorGeometry, material);
    mesh.visible = false;
    mesh.scale.set(2.0, 0.09, 1);
    scene.add(mesh);
    return { mesh, material, active: false, t: 0, life: 1, vx: 1, vy: -1, speed: 8 };
  });
  let nextMeteorAt = 2.5; // simTime seconds

  function spawnMeteor(): void {
    const meteor = meteors.find((m) => !m.active);
    if (!meteor) return;
    const direction = Math.random() < 0.5 ? -1 : 1;
    meteor.active = true;
    meteor.t = 0;
    meteor.life = 0.9 + Math.random() * 0.5;
    meteor.vx = direction * (0.55 + Math.random() * 0.35);
    meteor.vy = -(0.75 + Math.random() * 0.25);
    meteor.speed = 7 + Math.random() * 3;
    meteor.mesh.position.set(
      (Math.random() * 2 - 1) * 7,
      3.2 + Math.random() * 2.6,
      -4 + Math.random() * 6,
    );
    meteor.mesh.scale.set(1.8 + Math.random() * 0.9, 0.09, 1);
    meteor.mesh.quaternion.copy(camera.quaternion);
    // Orient the streak along its travel direction on screen.
    meteor.mesh.rotateZ(Math.atan2(meteor.vx, -meteor.vy));
    meteor.mesh.visible = true;
  }

  function updateMeteors(dt: number): void {
    if (simTime >= nextMeteorAt) {
      spawnMeteor();
      nextMeteorAt = simTime + 2.5 + Math.random() * 5;
    }
    for (const meteor of meteors) {
      if (!meteor.active) continue;
      meteor.t += dt;
      const progress = meteor.t / meteor.life;
      if (progress >= 1) {
        meteor.active = false;
        meteor.mesh.visible = false;
        continue;
      }
      meteor.mesh.position.x += meteor.vx * meteor.speed * dt;
      meteor.mesh.position.y += meteor.vy * meteor.speed * dt;
      meteor.material.uniforms.uFade.value = Math.sin(Math.PI * progress) * 0.9;
    }
  }

  // --- arcane links: sign glyph ↔ celestial body, switchable -------------------
  // Endpoints are recomputed in world space every frame (the wheel rotates and
  // the planets orbit), written into one preallocated position buffer.
  const linkPositions = new Float32Array(ZODIAC_SIGNS.length * 2 * 3);
  const linkGeometry = new THREE.BufferGeometry();
  linkGeometry.setAttribute('position', new THREE.BufferAttribute(linkPositions, 3));
  const linkMaterial = new THREE.LineBasicMaterial({
    color: 0x5a4326, // inked link lines on the chart
    transparent: true,
    opacity: 0.35,
    depthWrite: false,
  });
  const links = new THREE.LineSegments(linkGeometry, linkMaterial);
  scene.add(links);
  let linksVisible = true;
  const linkStartScratch = new THREE.Vector3();
  const linkEndScratch = new THREE.Vector3();

  function updateLinks(): void {
    if (!linksVisible || !links.visible) return;
    for (let i = 0; i < glyphSprites.length; i++) {
      glyphSprites[i].getWorldPosition(linkStartScratch);
      planetMeshes[SIGN_LINK_PLANET[i]].getWorldPosition(linkEndScratch);
      const o = i * 6;
      linkPositions[o] = linkStartScratch.x;
      linkPositions[o + 1] = linkStartScratch.y;
      linkPositions[o + 2] = linkStartScratch.z;
      linkPositions[o + 3] = linkEndScratch.x;
      linkPositions[o + 4] = linkEndScratch.y;
      linkPositions[o + 5] = linkEndScratch.z;
    }
    linkGeometry.attributes.position.needsUpdate = true;
    // Gentle opacity pulse; scaled by the effects slider.
    linkMaterial.opacity =
      (0.2 + 0.12 * Math.sin(simTime * 1.7)) * (0.4 + 0.6 * settings.effectsIntensity);
  }

  // --- state ------------------------------------------------------------------
  const settings: SceneSettings = {
    paused: reducedMotion, // respect prefers-reduced-motion: still interactive, not self-animating
    effectsIntensity: CONTROL_DEFAULTS.effectsIntensity,
    glowIntensity: CONTROL_DEFAULTS.glowIntensity,
    starDensity: CONTROL_DEFAULTS.starDensity,
    quality: 'medium',
  };
  let selectedSign: ZodiacSignId | null = null;
  let hoverSign: ZodiacSignId | null = null;
  let simTime = 0;
  let renderOnce = true; // draw at least one frame regardless of pause state
  let rotationVelocity = 0;
  const autoRotateSpeed = reducedMotion ? 0 : 0.045; // rad/s, decorative

  const frameTimes = new Float32Array(STATS_WINDOW);
  let frameCount = 0;
  let frameSum = 0;
  let lastStatsPush = 0;
  let lastFrameNow = performance.now();

  const hoverTintScratch = new THREE.Color();
  const white = new THREE.Color(0xffffff);

  function applySelectedGlyphState(): void {
    for (let i = 0; i < glyphSprites.length; i++) {
      const sprite = glyphSprites[i];
      const id = sprite.userData.signId as ZodiacSignId;
      const signColor = sprite.userData.signColor as THREE.Color;
      const isSelected = id === selectedSign;
      const isHover = id === hoverSign && !isSelected;
      const target = isSelected ? 1.15 : isHover ? 0.95 : sprite.userData.baseScale;
      sprite.userData.targetScale = target;
      if (settings.paused) sprite.scale.setScalar(target); // easing loop doesn't run while paused
      const material = sprite.material as THREE.SpriteMaterial;
      material.color.copy(
        isSelected
          ? glyphColorSelected
          : isHover
            ? hoverTintScratch.copy(signColor).lerp(white, 0.35)
            : signColor,
      );
      material.opacity = isSelected ? 1 : isHover ? 1 : 0.95;
      glowBase[i] = isSelected ? 2.8 : isHover ? 2.0 : 1.5;
      glyphGlowMaterials[i].uniforms.uIntensity.value = glowBase[i] * settings.glowIntensity;
    }
    renderOnce = true;
  }

  function applyStarDrawRange(): void {
    starGeometry.setDrawRange(0, visibleStarCount(settings.quality, settings.starDensity));
    renderOnce = true;
  }

  function applyQuality(): void {
    const preset = QUALITY_PRESETS[settings.quality];
    const dpr = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1;
    renderer.setPixelRatio(Math.min(dpr, preset.maxPixelRatio));
    starMaterial.uniforms.uPixelRatio.value = renderer.getPixelRatio();
    const octaves = noiseOctavesUniform(settings.quality);
    const rim = preset.rimEnabled ? 1 : 0;
    for (const mesh of planetMeshes) {
      const uniforms = (mesh.material as THREE.ShaderMaterial).uniforms;
      uniforms.uQuality.value = octaves;
      uniforms.uRim.value = rim;
    }
    applyStarDrawRange();
    resize(); // pixel-ratio changes require a buffer resize
    renderOnce = true;
  }

  // --- sizing ------------------------------------------------------------------
  function resize(): void {
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (w === 0 || h === 0) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    bgMaterial.uniforms.uAspect.value = w / h;
    renderOnce = true;
  }
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(container);

  // --- pointer interaction -------------------------------------------------------
  const raycaster = new THREE.Raycaster();
  const pointerNdc = new THREE.Vector2();
  let pointerDown = false;
  let dragged = false;
  let lastPointerX = 0;
  let downX = 0;
  let downY = 0;

  function ndcFromEvent(event: PointerEvent): void {
    const rect = renderer.domElement.getBoundingClientRect();
    pointerNdc.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
  }

  function glyphAtPointer(event: PointerEvent): ZodiacSignId | null {
    ndcFromEvent(event);
    raycaster.setFromCamera(pointerNdc, camera);
    const hit = raycaster.intersectObjects(glyphSprites, false)[0];
    return hit ? ((hit.object.userData.signId as ZodiacSignId) ?? null) : null;
  }

  function onPointerDown(event: PointerEvent): void {
    pointerDown = true;
    dragged = false;
    lastPointerX = event.clientX;
    downX = event.clientX;
    downY = event.clientY;
  }

  function onPointerMove(event: PointerEvent): void {
    if (pointerDown) {
      const dx = event.clientX - lastPointerX;
      if (Math.abs(event.clientX - downX) + Math.abs(event.clientY - downY) > 6) dragged = true;
      wheel.rotation.y += dx * 0.005;
      rotationVelocity = dx * 0.005 * 60; // approximate rad/s for inertia
      lastPointerX = event.clientX;
      renderOnce = true;
      return;
    }
    const hovered = glyphAtPointer(event);
    if (hovered !== hoverSign) {
      hoverSign = hovered;
      renderer.domElement.style.cursor = hovered ? 'pointer' : 'grab';
      applySelectedGlyphState();
    }
  }

  function onPointerUp(event: PointerEvent): void {
    pointerDown = false;
    if (dragged) return; // a drag is not a click
    const picked = glyphAtPointer(event);
    if (picked) options.onSignPick?.(picked);
  }

  function onPointerLeave(): void {
    pointerDown = false;
    if (hoverSign !== null) {
      hoverSign = null;
      renderer.domElement.style.cursor = 'grab';
      applySelectedGlyphState();
    }
  }

  const dom = renderer.domElement;
  dom.style.cursor = 'grab';
  dom.addEventListener('pointerdown', onPointerDown);
  dom.addEventListener('pointermove', onPointerMove);
  dom.addEventListener('pointerup', onPointerUp);
  dom.addEventListener('pointerleave', onPointerLeave);

  // --- visibility: pause rendering on hidden tabs --------------------------------
  function onVisibilityChange(): void {
    if (document.hidden) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    } else if (!settings.paused) {
      clock.getDelta(); // discard the hidden-period delta
      lastFrameNow = performance.now();
      rafId = requestAnimationFrame(tick);
    }
  }
  document.addEventListener('visibilitychange', onVisibilityChange);

  // --- frame loop -------------------------------------------------------------------
  const clock = new THREE.Clock();
  let rafId = 0;

  function pushStats(now: number): void {
    if (!options.onStats) return;
    if (now - lastStatsPush < STATS_INTERVAL_MS) return;
    lastStatsPush = now;
    // p95 needs order statistics; computed twice a second, not per frame.
    const sorted = Array.from(frameTimes.subarray(0, Math.min(frameCount, STATS_WINDOW))).sort(
      (a, b) => a - b,
    );
    const avg = frameCount > 0 ? frameSum / Math.min(frameCount, STATS_WINDOW) : 0;
    const p95 =
      sorted.length > 0 ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] : 0;
    options.onStats({
      fps: settings.paused ? 0 : avg > 0 ? 1000 / avg : 0,
      avgFrameMs: avg,
      p95FrameMs: p95,
      drawCalls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles,
      stars: visibleStarCount(settings.quality, settings.starDensity),
      renderScale: renderer.getPixelRatio(),
      quality: settings.quality,
      paused: settings.paused,
    });
  }

  function tick(): void {
    if (disposed) return;
    rafId = requestAnimationFrame(tick);
    const now = performance.now();
    const frameDelta = now - lastFrameNow; // ms
    lastFrameNow = now;

    if (!settings.paused) {
      const dt = Math.min(clock.getDelta(), 0.1);
      simTime += dt;
      // Planets: decorative orbits (spec §8.4 — no astronomy).
      for (let i = 0; i < PLANETS.length; i++) {
        const spec = PLANETS[i];
        const mesh = planetMeshes[i];
        const angle = spec.phase + simTime * spec.orbitSpeed;
        mesh.position.set(
          Math.cos(angle) * spec.orbitRadius,
          0,
          Math.sin(angle) * spec.orbitRadius,
        );
      }
      // Wheel: inertia from dragging + gentle auto-rotation.
      wheel.rotation.y += (autoRotateSpeed + rotationVelocity) * dt;
      rotationVelocity *= Math.pow(0.02, dt); // exponential decay toward 0
      // Glyph scale easing.
      for (const sprite of glyphSprites) {
        const target = sprite.userData.targetScale as number;
        const current = sprite.scale.x;
        const next = current + (target - current) * Math.min(1, dt * 10);
        sprite.scale.setScalar(next);
      }
      starMaterial.uniforms.uTime.value = simTime;
      bgMaterial.uniforms.uTime.value = simTime;
      for (const mesh of planetMeshes) {
        (mesh.material as THREE.ShaderMaterial).uniforms.uTime.value = simTime;
      }
      // Glyph glows: pulse phase + billboard toward the camera.
      for (let i = 0; i < glyphGlowMeshes.length; i++) {
        glyphGlowMaterials[i].uniforms.uTime.value = simTime;
        glyphGlowMeshes[i].quaternion.copy(camera.quaternion);
      }
      updateMeteors(dt);
      updateLinks();
      renderOnce = true;
    }

    if (settings.paused || document.hidden) {
      // Paused: render only when something visibly changed (interaction or a
      // control change), instead of burning frames on a static image.
      if (!renderOnce) {
        pushStats(now);
        return;
      }
      renderOnce = false;
    }

    // Record frame time — only for frames that actually render, capped so
    // tab switches don't poison the average (spec §13.4: honest numbers).
    const recorded = Math.min(frameDelta, 100);
    const slot = frameCount % STATS_WINDOW;
    frameSum += recorded - frameTimes[slot];
    frameTimes[slot] = recorded;
    frameCount++;

    renderer.render(scene, camera);
    pushStats(now);
  }

  // --- boot ------------------------------------------------------------------------
  applyQuality();
  resize();
  applySelectedGlyphState();
  rafId = requestAnimationFrame(tick);

  // --- handle ----------------------------------------------------------------------
  let disposed = false;

  return {
    get paused() {
      return settings.paused;
    },
    get effectsIntensity() {
      return settings.effectsIntensity;
    },
    get glowIntensity() {
      return settings.glowIntensity;
    },
    get starDensity() {
      return settings.starDensity;
    },
    get quality() {
      return settings.quality;
    },

    setSelectedSign(signId) {
      selectedSign = signId;
      applySelectedGlyphState();
    },
    setPaused(paused) {
      settings.paused = paused;
      if (!paused && !document.hidden && rafId === 0) {
        clock.getDelta();
        lastFrameNow = performance.now();
        rafId = requestAnimationFrame(tick);
      }
      renderOnce = true;
      pushStats(performance.now());
    },
    setEffectsIntensity(value) {
      settings.effectsIntensity = value;
      starMaterial.uniforms.uEffects.value = value;
      bgMaterial.uniforms.uEffects.value = value;
      for (const mesh of planetMeshes) {
        (mesh.material as THREE.ShaderMaterial).uniforms.uEffects.value = value;
      }
      for (const material of glyphGlowMaterials) {
        material.uniforms.uEffects.value = value;
      }
      renderOnce = true;
    },
    setGlowIntensity(value) {
      settings.glowIntensity = value;
      for (const mesh of planetMeshes) {
        (mesh.material as THREE.ShaderMaterial).uniforms.uGlowIntensity.value = value;
      }
      for (let i = 0; i < glyphGlowMaterials.length; i++) {
        glyphGlowMaterials[i].uniforms.uIntensity.value = glowBase[i] * value;
      }
      renderOnce = true;
    },
    setLinksVisible(visible) {
      linksVisible = visible;
      links.visible = visible;
      renderOnce = true;
    },
    setStarDensity(value) {
      settings.starDensity = value;
      applyStarDrawRange();
    },
    setQuality(quality) {
      settings.quality = quality;
      applyQuality();
    },
    resetToDefaults() {
      settings.effectsIntensity = CONTROL_DEFAULTS.effectsIntensity;
      settings.glowIntensity = CONTROL_DEFAULTS.glowIntensity;
      settings.starDensity = CONTROL_DEFAULTS.starDensity;
      settings.quality = 'medium';
      rotationVelocity = 0;
      applyQuality();
      this.setEffectsIntensity(settings.effectsIntensity);
      this.setGlowIntensity(settings.glowIntensity);
      this.setLinksVisible(true);
      if (settings.paused && !reducedMotion) this.setPaused(false);
      return { ...settings };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      document.removeEventListener('visibilitychange', onVisibilityChange);
      dom.removeEventListener('pointerdown', onPointerDown);
      dom.removeEventListener('pointermove', onPointerMove);
      dom.removeEventListener('pointerup', onPointerUp);
      dom.removeEventListener('pointerleave', onPointerLeave);
      for (const sprite of glyphSprites) {
        const material = sprite.material as THREE.SpriteMaterial;
        material.map?.dispose();
        material.dispose();
      }
      glowGeometry.dispose();
      for (const material of glyphGlowMaterials) material.dispose();
      meteorGeometry.dispose();
      for (const meteor of meteors) meteor.material.dispose();
      linkGeometry.dispose();
      linkMaterial.dispose();
      sphereGeometry.dispose();
      ringGeometry.dispose();
      for (const mesh of planetMeshes) (mesh.material as THREE.ShaderMaterial).dispose();
      wheel.traverse((object) => {
        if (object instanceof THREE.LineLoop || object instanceof THREE.Line) {
          object.geometry.dispose();
        }
      });
      orbitMaterials.forEach((material) => material.dispose());
      ringMaterial.dispose();
      bgQuad.geometry.dispose();
      bgMaterial.dispose();
      starGeometry.dispose();
      starMaterial.dispose();
      renderer.dispose();
      try {
        renderer.forceContextLoss();
      } catch {
        // Some browsers throw if the context is already gone — fine.
      }
      dom.remove();
    },
  };
}
