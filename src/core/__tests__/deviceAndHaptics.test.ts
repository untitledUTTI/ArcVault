import { describe, expect, it } from 'vitest';
import {
  detectPlatformOS,
  formatShortcut,
  resolveDeviceFormFactor,
} from '../../platform/device';
import {
  DEFAULT_HAPTICS,
  normalizeHapticsSettings,
  resolveHapticVibrationMs,
} from '../../platform/haptics';
import {
  applyMobilePowerBudget,
  getRenderQualityProfile,
} from '../renderEngine';
import {
  DEFAULT_GYROSCOPE,
  createMobileGestureGate,
  mapOrientationToTarget,
  normalizeGyroscopeSettings,
} from '../../platform/backgroundMotion';
import {
  DEFAULT_SCROLL_SCRUBBER,
  buildM3ScallopPath,
  computeRatioFromPointerY,
  computeScrubberMetrics,
  extractDocumentHeadings,
  isArticleScrollContainer,
  normalizeScrollScrubberSettings,
  resolveHeadingAtRatio,
  resolveThemeScrubberShape,
} from '../../components/TouchScrollScrubber';

describe('Six-platform device detection & shortcuts', () => {
  it('detects Windows, macOS, iPadOS (including iPad desktop UA), iOS, and Android', () => {
    expect(
      detectPlatformOS(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Win32',
        0,
      ),
    ).toBe('windows');

    expect(
      detectPlatformOS(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)',
        'MacIntel',
        0,
      ),
    ).toBe('macos');

    expect(
      detectPlatformOS(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
        'MacIntel',
        5,
      ),
    ).toBe('ipados');

    expect(
      detectPlatformOS('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', 'iPhone', 5),
    ).toBe('ios');

    expect(
      detectPlatformOS('Mozilla/5.0 (Linux; Android 15; Pixel 9)', 'Linux armv8l', 5),
    ).toBe('android');
  });

  it('resolves phone, tablet-portrait, tablet-landscape, desktop & preview overrides', () => {
    expect(resolveDeviceFormFactor(390, 844, 'ios', true, 'auto')).toBe('phone');
    expect(resolveDeviceFormFactor(412, 915, 'android', true, 'auto')).toBe('phone');
    expect(resolveDeviceFormFactor(800, 1280, 'android', true, 'auto')).toBe('tablet-portrait');
    expect(resolveDeviceFormFactor(1280, 800, 'android', true, 'auto')).toBe('tablet-landscape');
    expect(resolveDeviceFormFactor(820, 1180, 'ipados', true, 'auto')).toBe('tablet-portrait');
    expect(resolveDeviceFormFactor(1180, 820, 'ipados', true, 'auto')).toBe('tablet-landscape');
    expect(resolveDeviceFormFactor(1440, 900, 'windows', false, 'auto')).toBe('desktop');
    expect(resolveDeviceFormFactor(1440, 900, 'windows', false, 'phone')).toBe('phone');
  });

  it('formats Apple Command vs Windows Control shortcuts accurately', () => {
    expect(formatShortcut('Mod+Z', 'macos')).toBe('⌘Z');
    expect(formatShortcut('Mod+Shift+Z', 'ipados')).toBe('⌘⇧Z');
    expect(formatShortcut('Mod+Z', 'windows')).toBe('Ctrl+Z');
    expect(formatShortcut('Mod+Shift+Z', 'windows')).toBe('Ctrl+Y');
  });
});

describe('Graded Haptics & Mobile Render Power Budget', () => {
  it('computes graded vibration durations for off, gentle, and standard tiers', () => {
    expect(resolveHapticVibrationMs('selection', 'off')).toBeNull();
    const gentle = resolveHapticVibrationMs('medium', 'gentle') as number;
    const standard = resolveHapticVibrationMs('medium', 'standard') as number;
    expect(gentle).toBeGreaterThan(0);
    expect(gentle).toBeLessThan(standard);
    expect(Array.isArray(resolveHapticVibrationMs('success', 'standard'))).toBe(true);
    expect(normalizeHapticsSettings(null)).toEqual(DEFAULT_HAPTICS);
  });

  it('applies mobile power budget and reduced-motion caps', () => {
    const ultra = getRenderQualityProfile('ultra');
    const mobile = applyMobilePowerBudget(ultra, {
      isMobileOrTablet: true,
      prefersReducedMotion: false,
    });
    expect(mobile.gpuDprCap).toBeLessThanOrEqual(1.15);
    expect(mobile.gpuMinFrameMs).toBeGreaterThanOrEqual(33);
    expect(mobile.particleScale).toBeLessThan(ultra.particleScale);

    const reduced = applyMobilePowerBudget(ultra, {
      isMobileOrTablet: true,
      prefersReducedMotion: true,
    });
    expect(reduced.gpuMinFrameMs).toBeGreaterThanOrEqual(100);
  });
});

describe('Mobile Gesture Gate & Gyroscope Background Motion', () => {
  it('ignores taps and sub-threshold jitter on phone/tablet, activating only on swipe or long-press', () => {
    const gate = createMobileGestureGate({ swipeThresholdPx: 10, longPressMs: 320 });
    expect(gate.isActive()).toBe(false);

    // Tap with tiny finger jitter (<= 4px) must NOT activate background
    gate.onDown(200, 300);
    expect(gate.onMove(203, 302)).toBe(false);
    expect(gate.isActive()).toBe(false);
    gate.onUp();
    expect(gate.isActive()).toBe(false);

    // Swipe >= 10px activates immediately
    gate.onDown(200, 300);
    expect(gate.onMove(212, 300)).toBe(true);
    expect(gate.isActive()).toBe(true);
    gate.onUp();
    expect(gate.isActive()).toBe(false);

    // Long-press activates even without movement, and releases cleanly on pointerup
    gate.onDown(150, 150);
    expect(gate.activateLongPress()).toBe(true);
    expect(gate.isActive()).toBe(true);
    gate.onUp();
    expect(gate.isActive()).toBe(false);
  });

  it('maps gyroscope orientation relative to baseline, rotates axes in landscape, and clamps safely', () => {
    expect(normalizeGyroscopeSettings(null)).toEqual(DEFAULT_GYROSCOPE);
    expect(normalizeGyroscopeSettings({ enabled: true, sensitivity: 5 })).toEqual({
      enabled: true,
      sensitivity: 2.0,
    });

    const neutral = mapOrientationToTarget({
      beta: 45,
      gamma: 0,
      baseBeta: 45,
      baseGamma: 0,
      screenAngle: 0,
      sensitivity: 1.0,
    });
    expect(neutral.x).toBeCloseTo(0.5, 4);
    expect(neutral.y).toBeCloseTo(0.38, 4);

    const tiltedRight = mapOrientationToTarget({
      beta: 45,
      gamma: 16,
      baseBeta: 45,
      baseGamma: 0,
      screenAngle: 0,
      sensitivity: 1.0,
    });
    expect(tiltedRight.x).toBeGreaterThan(0.65);

    // Extreme angle stays clamped inside [0.04, 0.96]
    const extreme = mapOrientationToTarget({
      beta: 120,
      gamma: -120,
      baseBeta: 0,
      baseGamma: 0,
      sensitivity: 2.0,
    });
    expect(extreme.x).toBe(0.04);
    expect(extreme.y).toBe(0.96);

    // Landscape 90deg swaps tilt axis cleanly
    const landscapeTilt = mapOrientationToTarget({
      beta: 61,
      gamma: 0,
      baseBeta: 45,
      baseGamma: 0,
      screenAngle: 90,
      sensitivity: 1.0,
    });
    expect(landscapeTilt.x).toBeGreaterThan(0.65);
  });
});

describe('TouchScrollScrubber Math Helpers', () => {
  it('returns non-scrollable metrics when container has no overflow or invalid track dimensions', () => {
    expect(
      computeScrubberMetrics({
        scrollTop: 0,
        scrollHeight: 500,
        clientHeight: 500,
        trackHeight: 400,
      }).scrollable,
    ).toBe(false);

    expect(
      computeScrubberMetrics({
        scrollTop: 0,
        scrollHeight: 1200,
        clientHeight: 400,
        trackHeight: 0,
      }).scrollable,
    ).toBe(false);
  });

  it('clamps thumb height and computes accurate progress ratio and thumbTop', () => {
    const atTop = computeScrubberMetrics({
      scrollTop: 0,
      scrollHeight: 4000,
      clientHeight: 400,
      trackHeight: 300,
      minThumbHeight: 42,
    });
    expect(atTop.scrollable).toBe(true);
    expect(atTop.ratio).toBe(0);
    expect(atTop.percent).toBe(0);
    expect(atTop.thumbHeight).toBe(42);
    expect(atTop.thumbTop).toBe(0);

    const atMid = computeScrubberMetrics({
      scrollTop: 600,
      scrollHeight: 1600,
      clientHeight: 400,
      trackHeight: 300,
      minThumbHeight: 40,
    });
    expect(atMid.ratio).toBeCloseTo(0.5, 4);
    expect(atMid.percent).toBe(50);
    expect(atMid.thumbHeight).toBe(40);
    expect(atMid.thumbTop).toBeCloseTo(130, 4);

    const atBottom = computeScrubberMetrics({
      scrollTop: 1500,
      scrollHeight: 1600,
      clientHeight: 400,
      trackHeight: 300,
      minThumbHeight: 40,
    });
    expect(atBottom.ratio).toBe(1);
    expect(atBottom.percent).toBe(100);
    expect(atBottom.thumbTop).toBeCloseTo(260, 4);
  });

  it('normalizes size/shape settings, maps theme shapes, and generates M3E scallop paths', () => {
    expect(normalizeScrollScrubberSettings(null)).toEqual(DEFAULT_SCROLL_SCRUBBER);
    expect(normalizeScrollScrubberSettings({ size: 90, shape: 'm3-clover' })).toEqual({
      size: 60,
      shape: 'm3-clover',
    });
    expect(normalizeScrollScrubberSettings({ size: 12 })).toEqual({
      size: 28,
      shape: 'auto',
    });

    expect(resolveThemeScrubberShape('m3-expressive', 'auto')).toBe('m3-burst');
    expect(resolveThemeScrubberShape('paper', 'auto')).toBe('squircle');
    expect(resolveThemeScrubberShape('celestial-optics', 'auto')).toBe('orb');
    expect(resolveThemeScrubberShape('light', 'm3-clover')).toBe('m3-clover');

    const path = buildM3ScallopPath(8, 40.5, 6.2, 32);
    expect(path.startsWith('M')).toBe(true);
    expect(path.endsWith('Z')).toBe(true);
  });

  it('extracts Markdown, LaTeX, and Chinese headings and resolves the active chapter at ratio', () => {
    const sample = [
      '# 引言与背景',
      '正文内容 [@zotero:001]',
      '\\section{方法论推导}',
      '推导过程',
      '第一章 实验评估',
      '总结',
    ].join('\n');

    const headings = extractDocumentHeadings(sample);
    expect(headings.map((h) => h.title)).toEqual([
      '引言与背景',
      '方法论推导',
      '第一章 实验评估',
    ]);

    expect(resolveHeadingAtRatio(headings, 0.05)?.title).toBe('引言与背景');
    expect(resolveHeadingAtRatio(headings, 0.45)?.title).toBe('方法论推导');
    expect(resolveHeadingAtRatio(headings, 0.95)?.title).toBe('第一章 实验评估');
  });

  it('maps pointer Y position within track bounds accurately', () => {
    expect(computeRatioFromPointerY(100, 100, 300, 60, 0)).toBe(0);
    expect(computeRatioFromPointerY(250, 100, 300, 60, 30)).toBeCloseTo(0.5, 4);
    expect(computeRatioFromPointerY(500, 100, 300, 60, 30)).toBe(1);
    expect(computeRatioFromPointerY(40, 100, 300, 60, 0)).toBe(0);
  });

  it('restricts TouchScrollScrubber strictly to article panes and excludes annotations/revisions', () => {
    const makeMockEl = (classes: string[], ancestorMatch: string | null = null) =>
      ({
        classList: {
          contains: (cls: string) => classes.includes(cls),
        },
        closest: (selector: string) =>
          ancestorMatch && selector.includes(ancestorMatch) ? ({} as Element) : null,
      }) as unknown as HTMLElement;

    expect(isArticleScrollContainer(makeMockEl(['arc-editor-pane']))).toBe(true);
    expect(isArticleScrollContainer(makeMockEl(['arc-preview-pane']))).toBe(true);
    expect(isArticleScrollContainer(makeMockEl(['cm-scroller'], '.arc-editor-pane'))).toBe(true);

    expect(isArticleScrollContainer(makeMockEl(['arc-annotation-pane'], '.arc-annotation-pane'))).toBe(false);
    expect(isArticleScrollContainer(makeMockEl(['arc-annotation-comment-body'], '.arc-annotation-pane'))).toBe(false);
    expect(isArticleScrollContainer(makeMockEl(['arc-settings-content'], '.arc-modal'))).toBe(false);
    expect(isArticleScrollContainer(makeMockEl(['arc-doc-list'], '.arc-sidebar'))).toBe(false);
  });
});
