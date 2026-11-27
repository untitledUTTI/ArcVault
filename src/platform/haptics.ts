import type {
  HapticIntensity,
  HapticPattern,
  HapticsSettings,
} from '../types/archive';
import { isTauriRuntime, nativeTriggerHaptic } from './bridge';

export const DEFAULT_HAPTICS: HapticsSettings = {
  enabled: true,
  intensity: 'standard',
};

export function normalizeHapticsSettings(
  raw?: Partial<HapticsSettings> | null,
): HapticsSettings {
  const intensity: HapticIntensity =
    raw?.intensity === 'off' ||
    raw?.intensity === 'gentle' ||
    raw?.intensity === 'standard'
      ? raw.intensity
      : DEFAULT_HAPTICS.intensity;

  return {
    enabled: raw?.enabled ?? DEFAULT_HAPTICS.enabled,
    intensity,
  };
}

export function resolveHapticVibrationMs(
  pattern: HapticPattern,
  intensity: HapticIntensity,
): number | number[] | null {
  if (intensity === 'off') return null;
  const scale = intensity === 'gentle' ? 0.55 : 1;
  const s = (ms: number) => Math.max(6, Math.round(ms * scale));

  switch (pattern) {
    case 'selection':
      return s(10);
    case 'light':
      return s(16);
    case 'medium':
      return s(28);
    case 'heavy':
      return s(44);
    case 'success':
      return [s(14), 32, s(26)];
    case 'warning':
      return [s(22), 36, s(22)];
    case 'error':
      return [s(32), 28, s(32), 28, s(42)];
  }
}

export interface HapticTriggerContext {
  settings?: HapticsSettings;
  isTouchDevice?: boolean;
  forceTest?: boolean;
}

interface AndroidNativeHapticsBridge {
  trigger?: (pattern: string, intensity: string) => boolean;
}

function triggerAndroidNativeHaptic(
  pattern: HapticPattern,
  intensity: HapticIntensity,
): boolean {
  if (typeof window === 'undefined') return false;
  const bridge = (window as unknown as { __ARC_ANDROID_HAPTICS__?: AndroidNativeHapticsBridge })
    .__ARC_ANDROID_HAPTICS__;
  if (!bridge || typeof bridge.trigger !== 'function') return false;
  try {
    return Boolean(bridge.trigger(pattern, intensity));
  } catch {
    return false;
  }
}

export async function triggerHaptic(
  pattern: HapticPattern,
  ctx?: HapticTriggerContext,
): Promise<boolean> {
  const norm = normalizeHapticsSettings(ctx?.settings);
  if (!norm.enabled || norm.intensity === 'off') return false;
  if (!ctx?.forceTest && ctx?.isTouchDevice === false) return false;

  if (triggerAndroidNativeHaptic(pattern, norm.intensity)) {
    return true;
  }

  if (isTauriRuntime()) {
    const handled = await nativeTriggerHaptic(pattern, norm.intensity);
    if (handled) return true;
  }

  const vib = resolveHapticVibrationMs(pattern, norm.intensity);
  if (!vib) return false;

  if (
    typeof navigator !== 'undefined' &&
    typeof navigator.vibrate === 'function'
  ) {
    try {
      return navigator.vibrate(vib);
    } catch {
      return false;
    }
  }

  return false;
}

export async function testHapticPattern(
  pattern: HapticPattern,
  settings?: HapticsSettings,
): Promise<{
  ok: boolean;
  channel: 'tauri' | 'web-vibrate' | 'simulated' | 'disabled';
  message: string;
}> {
  const norm = normalizeHapticsSettings(settings);
  if (!norm.enabled || norm.intensity === 'off') {
    return {
      ok: false,
      channel: 'disabled',
      message: '震动反馈当前已关闭，请先启用触感开关或切换为柔和/标准档位。',
    };
  }

  if (triggerAndroidNativeHaptic(pattern, norm.intensity)) {
    return {
      ok: true,
      channel: 'tauri',
      message: `已触发 Android 原生系统触感（${pattern} · ${norm.intensity}）`,
    };
  }

  if (isTauriRuntime()) {
    const handled = await nativeTriggerHaptic(pattern, norm.intensity);
    if (handled) {
      return {
        ok: true,
        channel: 'tauri',
        message: `已触发原生 Tauri 震动（${pattern} · ${norm.intensity}）`,
      };
    }
  }

  const vib = resolveHapticVibrationMs(pattern, norm.intensity);
  if (
    vib &&
    typeof navigator !== 'undefined' &&
    typeof navigator.vibrate === 'function'
  ) {
    const ok = navigator.vibrate(vib);
    if (ok) {
      return {
        ok: true,
        channel: 'web-vibrate',
        message: `已通过浏览器震动引擎触发（${pattern} · ${JSON.stringify(vib)}ms）`,
      };
    }
  }

  return {
    ok: true,
    channel: 'simulated',
    message: `当前桌面硬件无震动马达，已模拟波形（${pattern} · ${JSON.stringify(vib)}ms）；在 Android / iOS / iPadOS 真机将触发系统线性马达。`,
  };
}
