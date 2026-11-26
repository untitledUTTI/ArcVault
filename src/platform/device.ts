import { useEffect, useMemo, useState } from 'react';
import type {
  DeviceFormFactor,
  DevicePreviewOverride,
  PlatformOS,
} from '../types/archive';

export interface DeviceEnvironment {
  os: PlatformOS;
  formFactor: DeviceFormFactor;
  isPhone: boolean;
  isTablet: boolean;
  isTabletPortrait: boolean;
  isTabletLandscape: boolean;
  isDesktop: boolean;
  isMobileOS: boolean;
  isTouch: boolean;
  isMacLike: boolean;
  prefersReducedMotion: boolean;
  keyboardOffset: number;
  viewportWidth: number;
  viewportHeight: number;
  isSimulatedPreview: boolean;
}

export function detectPlatformOS(
  ua?: string,
  platform?: string,
  maxTouchPoints?: number,
): PlatformOS {
  const userAgent =
    ua ?? (typeof navigator !== 'undefined' ? navigator.userAgent : '');
  const plat =
    platform ?? (typeof navigator !== 'undefined' ? navigator.platform : '');
  const touchPts =
    maxTouchPoints ??
    (typeof navigator !== 'undefined' ? navigator.maxTouchPoints ?? 0 : 0);

  if (/iPad/i.test(userAgent)) return 'ipados';
  // iPadOS 13+ reports Macintosh / MacIntel with multi-touch points
  if (
    (/Macintosh|MacIntel/i.test(plat) || /Macintosh/i.test(userAgent)) &&
    touchPts > 1
  ) {
    return 'ipados';
  }
  if (/iPhone|iPod/i.test(userAgent)) return 'ios';
  if (/Android/i.test(userAgent)) return 'android';
  if (/Win/i.test(plat) || /Windows/i.test(userAgent)) return 'windows';
  if (/Mac/i.test(plat) || /Macintosh/i.test(userAgent)) return 'macos';
  return 'web';
}

export function resolveDeviceFormFactor(
  width: number,
  height: number,
  os: PlatformOS,
  isTouch: boolean,
  override: DevicePreviewOverride = 'auto',
): DeviceFormFactor {
  if (override !== 'auto') {
    return override;
  }

  const shortEdge = Math.min(width, height);
  const longEdge = Math.max(width, height);

  if (os === 'ios') {
    return shortEdge >= 600 ? (height > width ? 'tablet-portrait' : 'tablet-landscape') : 'phone';
  }

  if (os === 'ipados') {
    return height > width ? 'tablet-portrait' : 'tablet-landscape';
  }

  if (os === 'android') {
    if (shortEdge < 600 || width < 680) return 'phone';
    return height > width ? 'tablet-portrait' : 'tablet-landscape';
  }

  if (width < 700) {
    return 'phone';
  }

  if (width < 1180 && (isTouch || longEdge <= 1380)) {
    return height > width ? 'tablet-portrait' : 'tablet-landscape';
  }

  if (width < 980) {
    return height > width ? 'tablet-portrait' : 'tablet-landscape';
  }

  return 'desktop';
}

export function isAppleShortcutPlatform(os: PlatformOS): boolean {
  return os === 'macos' || os === 'ipados' || os === 'ios';
}

export type ShortcutChord =
  | 'Mod+Z'
  | 'Mod+Shift+Z'
  | 'Mod+S'
  | 'Alt+P'
  | 'Mod+,';

export function formatShortcut(chord: ShortcutChord, os: PlatformOS): string {
  const apple = isAppleShortcutPlatform(os);
  switch (chord) {
    case 'Mod+Z':
      return apple ? '⌘Z' : 'Ctrl+Z';
    case 'Mod+Shift+Z':
      return apple ? '⌘⇧Z' : 'Ctrl+Y';
    case 'Mod+S':
      return apple ? '⌘S' : 'Ctrl+S';
    case 'Alt+P':
      return apple ? '⌥P' : 'Alt+P';
    case 'Mod+,':
      return apple ? '⌘,' : 'Ctrl+,';
  }
}

export function getSimulatedFrameDimensions(
  formFactor: DeviceFormFactor,
): { width: number; height: number; label: string } {
  switch (formFactor) {
    case 'phone':
      return { width: 390, height: 844, label: '手机 · 390×844' };
    case 'tablet-portrait':
      return { width: 820, height: 1120, label: '平板竖屏 · 820×1120' };
    case 'tablet-landscape':
      return { width: 1180, height: 800, label: '平板横屏 · 1180×800' };
    default:
      return { width: 1360, height: 860, label: '桌面工作台' };
  }
}

function readViewportMetrics() {
  if (typeof window === 'undefined') {
    return {
      width: 1360,
      height: 860,
      isTouch: false,
      prefersReducedMotion: false,
      keyboardOffset: 0,
    };
  }
  const vv = window.visualViewport;
  const width = window.innerWidth;
  const height = window.innerHeight;
  const isTouch =
    (typeof navigator !== 'undefined' && (navigator.maxTouchPoints ?? 0) > 0) ||
    window.matchMedia?.('(pointer: coarse)').matches === true;
  const prefersReducedMotion =
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
  const keyboardOffset = vv
    ? Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop))
    : 0;
  return { width, height, isTouch, prefersReducedMotion, keyboardOffset };
}

export function useDeviceEnvironment(
  override: DevicePreviewOverride = 'auto',
): DeviceEnvironment {
  const [metrics, setMetrics] = useState(readViewportMetrics);

  useEffect(() => {
    const update = () => setMetrics(readViewportMetrics());
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    const vv = window.visualViewport;
    vv?.addEventListener('resize', update);
    vv?.addEventListener('scroll', update);

    const motionMq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const pointerMq = window.matchMedia?.('(pointer: coarse)');
    motionMq?.addEventListener?.('change', update);
    pointerMq?.addEventListener?.('change', update);

    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
      vv?.removeEventListener('resize', update);
      vv?.removeEventListener('scroll', update);
      motionMq?.removeEventListener?.('change', update);
      pointerMq?.removeEventListener?.('change', update);
    };
  }, []);

  const os = useMemo(() => detectPlatformOS(), []);
  const isSimulatedPreview = override !== 'auto';

  const env = useMemo<DeviceEnvironment>(() => {
    const formFactor = resolveDeviceFormFactor(
      metrics.width,
      metrics.height,
      os,
      metrics.isTouch,
      override,
    );
    const simDims = isSimulatedPreview
      ? getSimulatedFrameDimensions(formFactor)
      : null;
    const effectiveTouch =
      metrics.isTouch ||
      formFactor === 'phone' ||
      formFactor === 'tablet-portrait' ||
      formFactor === 'tablet-landscape';
    const isPhone = formFactor === 'phone';
    const isTabletPortrait = formFactor === 'tablet-portrait';
    const isTabletLandscape = formFactor === 'tablet-landscape';
    const isTablet = isTabletPortrait || isTabletLandscape;
    const isDesktop = formFactor === 'desktop';
    const isMobileOS = os === 'ios' || os === 'ipados' || os === 'android';

    return {
      os,
      formFactor,
      isPhone,
      isTablet,
      isTabletPortrait,
      isTabletLandscape,
      isDesktop,
      isMobileOS,
      isTouch: effectiveTouch,
      isMacLike: isAppleShortcutPlatform(os),
      prefersReducedMotion: metrics.prefersReducedMotion,
      keyboardOffset: metrics.keyboardOffset,
      viewportWidth: simDims ? simDims.width : metrics.width,
      viewportHeight: simDims ? simDims.height : metrics.height,
      isSimulatedPreview,
    };
  }, [metrics, os, override, isSimulatedPreview]);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.device = env.formFactor;
    root.dataset.os = env.os;
    root.dataset.touch = env.isTouch ? 'true' : 'false';
    root.dataset.simulatedPreview = env.isSimulatedPreview ? 'true' : 'false';
    root.style.setProperty('--arc-keyboard-offset', `${env.keyboardOffset}px`);
  }, [env]);

  return env;
}
