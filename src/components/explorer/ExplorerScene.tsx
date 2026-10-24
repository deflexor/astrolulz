'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { ZODIAC_SIGNS, type ZodiacSignId } from '@/lib/astrology/zodiacSigns';
import { CONTROL_DEFAULTS, CONTROL_RANGES, type SceneQualityId } from '@/lib/explorer/sceneConfig';
import type { SceneStats, ZodiacSceneHandle } from '@/lib/explorer/createZodiacScene';
import styles from './ExplorerScene.module.css';

/**
 * Zodiac explorer client shell (spec §5.2, FR-05..FR-08, §14).
 *
 * The Three.js engine is dynamically imported inside the mount effect:
 * nothing WebGL-related runs during SSR, and three.js stays out of the page's
 * initial JS bundle. All sign information stays available as plain DOM even
 * when WebGL cannot start (readable fallback, FR-05).
 */

type SceneLoadState = 'loading' | 'ready' | 'unavailable';

const QUALITY_IDS: readonly SceneQualityId[] = ['low', 'medium', 'high'];

// A stable non-leap year for formatting approximate date ranges.
const DATES_YEAR = 2001;

function formatApproxDates(locale: string, sign: (typeof ZODIAC_SIGNS)[number]): string {
  const fmt = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' });
  const start = new Date(DATES_YEAR, sign.approxStart.month - 1, sign.approxStart.day);
  const end = new Date(DATES_YEAR, sign.approxEnd.month - 1, sign.approxEnd.day);
  return `${fmt.format(start)} – ${fmt.format(end)}`;
}

export function ExplorerScene() {
  const t = useTranslations('explorer');
  const tRoot = useTranslations();
  const locale = useLocale();

  const containerRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<ZodiacSceneHandle | null>(null);

  const [sceneState, setSceneState] = useState<SceneLoadState>('loading');
  const [selectedSign, setSelectedSign] = useState<ZodiacSignId | null>(null);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [effects, setEffects] = useState<number>(CONTROL_DEFAULTS.effectsIntensity);
  const [glow, setGlow] = useState<number>(CONTROL_DEFAULTS.glowIntensity);
  const [density, setDensity] = useState<number>(CONTROL_DEFAULTS.starDensity);
  const [quality, setQuality] = useState<SceneQualityId>('medium');
  const [stats, setStats] = useState<SceneStats | null>(null);
  const [perfOpen, setPerfOpen] = useState(false);

  // Mount the browser-only engine. Dynamic import keeps three.js out of the
  // SSR pass and the initial bundle (spec §4.1).
  useEffect(() => {
    let disposed = false;
    let handle: ZodiacSceneHandle | null = null;

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    /* eslint-disable react-hooks/set-state-in-effect -- one-time read of OS-level preference; mirrors the URL-restore pattern in HoroscopeForm */
    setReducedMotion(prefersReduced);
    setPaused(prefersReduced);
    /* eslint-enable react-hooks/set-state-in-effect */

    (async () => {
      const { createZodiacScene, isWebglAvailable } =
        await import('@/lib/explorer/createZodiacScene');
      if (disposed || !containerRef.current) return;
      if (!isWebglAvailable()) {
        setSceneState('unavailable');
        return;
      }
      try {
        handle = createZodiacScene(containerRef.current, {
          prefersReducedMotion: prefersReduced,
          onSignPick: (signId) => setSelectedSign(signId),
          onStats: (next) => setStats(next),
        });
        sceneRef.current = handle;
        setSceneState('ready');
      } catch {
        // Renderer construction can throw on blocklisted GPUs / no context.
        setSceneState('unavailable');
      }
    })();

    return () => {
      disposed = true;
      handle?.dispose();
      sceneRef.current = null;
    };
  }, []);

  const selectSign = useCallback((signId: ZodiacSignId) => {
    setSelectedSign(signId);
    sceneRef.current?.setSelectedSign(signId);
  }, []);

  const togglePause = useCallback(() => {
    setPaused((prev) => {
      const next = !prev;
      sceneRef.current?.setPaused(next);
      return next;
    });
  }, []);

  const changeEffects = useCallback((value: number) => {
    setEffects(value);
    sceneRef.current?.setEffectsIntensity(value);
  }, []);

  const changeGlow = useCallback((value: number) => {
    setGlow(value);
    sceneRef.current?.setGlowIntensity(value);
  }, []);

  const changeDensity = useCallback((value: number) => {
    setDensity(value);
    sceneRef.current?.setStarDensity(value);
  }, []);

  const changeQuality = useCallback((value: SceneQualityId) => {
    setQuality(value);
    sceneRef.current?.setQuality(value);
  }, []);

  const [linksVisible, setLinksVisible] = useState(true);
  const changeLinks = useCallback((visible: boolean) => {
    setLinksVisible(visible);
    sceneRef.current?.setLinksVisible(visible);
  }, []);

  const resetDefaults = useCallback(() => {
    const handle = sceneRef.current;
    if (!handle) {
      setEffects(CONTROL_DEFAULTS.effectsIntensity);
      setGlow(CONTROL_DEFAULTS.glowIntensity);
      setDensity(CONTROL_DEFAULTS.starDensity);
      setQuality('medium');
      setPaused(false);
      setLinksVisible(true);
      return;
    }
    const next = handle.resetToDefaults();
    setEffects(next.effectsIntensity);
    setGlow(next.glowIntensity);
    setDensity(next.starDensity);
    setQuality(next.quality);
    setPaused(next.paused);
    setLinksVisible(true);
  }, []);

  const selected = selectedSign ? ZODIAC_SIGNS.find((s) => s.id === selectedSign)! : null;

  return (
    <div className={styles.explorer}>
      <div className={styles.mainColumn}>
        <div
          ref={containerRef}
          className={styles.canvasWrap}
          role="img"
          aria-label={t('canvasLabel')}
        >
          {sceneState === 'loading' && <p className={styles.overlay}>{t('loading')}</p>}
          {sceneState === 'unavailable' && (
            <div className={`${styles.overlay} ${styles.overlayWide}`}>
              <p>{t('canvasFallback')}</p>
            </div>
          )}
        </div>
        <p className={styles.decorativeNote}>{t('decorativeNote')}</p>

        <fieldset className={styles.controls}>
          <legend className="fieldset-label">{t('controls.title')}</legend>
          <div className={styles.controlRow}>
            <button type="button" className={styles.controlButton} onClick={togglePause}>
              {paused ? t('controls.resume') : t('controls.pause')}
            </button>
            <button type="button" className={styles.controlButton} onClick={resetDefaults}>
              {t('controls.reset')}
            </button>
            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={linksVisible}
                onChange={(e) => changeLinks(e.target.checked)}
              />
              {t('controls.links')}
            </label>
          </div>
          {reducedMotion && <p className={styles.reducedNote}>{t('controls.reducedMotion')}</p>}
          <label className={styles.sliderLabel}>
            <span>{t('controls.effects')}</span>
            <input
              type="range"
              min={CONTROL_RANGES.effectsIntensity.min}
              max={CONTROL_RANGES.effectsIntensity.max}
              step={CONTROL_RANGES.effectsIntensity.step}
              value={effects}
              onChange={(e) => changeEffects(Number(e.target.value))}
            />
          </label>
          <label className={styles.sliderLabel}>
            <span>{t('controls.glow')}</span>
            <input
              type="range"
              min={CONTROL_RANGES.glowIntensity.min}
              max={CONTROL_RANGES.glowIntensity.max}
              step={CONTROL_RANGES.glowIntensity.step}
              value={glow}
              onChange={(e) => changeGlow(Number(e.target.value))}
            />
          </label>
          <label className={styles.sliderLabel}>
            <span>{t('controls.density')}</span>
            <input
              type="range"
              min={CONTROL_RANGES.starDensity.min}
              max={CONTROL_RANGES.starDensity.max}
              step={CONTROL_RANGES.starDensity.step}
              value={density}
              onChange={(e) => changeDensity(Number(e.target.value))}
            />
          </label>
          <div className={styles.qualityRow} role="group" aria-label={t('controls.quality')}>
            <span className={styles.qualityLabel}>{t('controls.quality')}</span>
            {QUALITY_IDS.map((id) => (
              <button
                key={id}
                type="button"
                className={id === quality ? styles.segmentActive : ''}
                aria-pressed={id === quality}
                onClick={() => changeQuality(id)}
              >
                {t(`controls.quality_${id}`)}
              </button>
            ))}
          </div>
        </fieldset>

        <div className={styles.perfBlock}>
          <button
            type="button"
            className={styles.perfToggle}
            aria-expanded={perfOpen}
            aria-controls="explorer-perf"
            onClick={() => setPerfOpen((v) => !v)}
          >
            {t('perf.title')}
          </button>
          {perfOpen && (
            <div id="explorer-perf" className={styles.perfPanel}>
              <p className={styles.perfNote}>{t('perf.note')}</p>
              <dl className={styles.perfGrid}>
                <dt>{t('perf.fps')}</dt>
                <dd>{stats ? (stats.paused ? t('perf.paused') : stats.fps.toFixed(1)) : '—'}</dd>
                <dt>{t('perf.avg')}</dt>
                <dd>{stats ? `${stats.avgFrameMs.toFixed(1)} ms` : '—'}</dd>
                <dt>{t('perf.p95')}</dt>
                <dd>{stats ? `${stats.p95FrameMs.toFixed(1)} ms` : '—'}</dd>
                <dt>{t('perf.draws')}</dt>
                <dd>{stats?.drawCalls ?? '—'}</dd>
                <dt>{t('perf.tris')}</dt>
                <dd>{stats ? stats.triangles.toLocaleString(locale) : '—'}</dd>
                <dt>{t('perf.stars')}</dt>
                <dd>{stats?.stars ?? '—'}</dd>
                <dt>{t('perf.scale')}</dt>
                <dd>{stats ? `×${stats.renderScale.toFixed(2)}` : '—'}</dd>
              </dl>
            </div>
          )}
        </div>
      </div>

      <aside className={styles.sideColumn}>
        <fieldset className={styles.signBlock}>
          <legend className="fieldset-label">{t('selection.label')}</legend>
          <p className={styles.selectionHint}>{t('selection.hint')}</p>
          <div className={styles.signGrid} role="group" aria-label={t('selection.label')}>
            {ZODIAC_SIGNS.map((sign) => (
              <button
                key={sign.id}
                type="button"
                className={`${styles.signButton} ${sign.id === selectedSign ? styles.signButtonActive : ''}`}
                aria-pressed={sign.id === selectedSign}
                onClick={() => selectSign(sign.id)}
              >
                <span className={styles.signSymbol} aria-hidden="true">
                  {sign.symbol}
                </span>
                <span className={styles.signName}>{tRoot(`zodiac.${sign.id}.name`)}</span>
              </button>
            ))}
          </div>
          <p className="visually-hidden" aria-live="polite">
            {selectedSign
              ? t('selection.selected', { name: tRoot(`zodiac.${selectedSign}.name`) })
              : t('selection.noneSelected')}
          </p>
        </fieldset>

        <div className={styles.infoPanel} aria-live="polite">
          {selected ? (
            <>
              <h2 className={styles.infoTitle}>
                <span aria-hidden="true">{selected.symbol}</span>{' '}
                {tRoot(`zodiac.${selected.id}.name`)}
              </h2>
              <p className={styles.infoDescription}>{tRoot(`zodiac.${selected.id}.description`)}</p>
              <dl className={styles.infoFacts}>
                <dt>{t('info.element')}</dt>
                <dd>{tRoot(`elements.${selected.element}`)}</dd>
                <dt>{t('info.dates')}</dt>
                <dd>{t('info.datesApprox', { range: formatApproxDates(locale, selected) })}</dd>
              </dl>
              <Link
                className={styles.horoscopeLink}
                href={{ pathname: '/', query: { sign: selected.id } }}
              >
                {t('info.readHoroscope', { name: tRoot(`zodiac.${selected.id}.name`) })} →
              </Link>
            </>
          ) : (
            <p className={styles.infoDescription}>{t('selection.noneSelected')}</p>
          )}
        </div>
      </aside>
    </div>
  );
}
