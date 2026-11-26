import { describe, expect, it } from 'vitest';
import {
  WEATHER_THEME_CSS_KEYS,
  applyWeatherThemeVariables,
  resolveWeatherThemePalette,
} from '../weatherTheme';

function luminanceRgb(r: number, g: number, b: number): number {
  const lin = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrastWeather(caretHex: string, surfaceRgbStr: string): number {
  const cr = parseInt(caretHex.slice(1, 3), 16);
  const cg = parseInt(caretHex.slice(3, 5), 16);
  const cb = parseInt(caretHex.slice(5, 7), 16);
  const [sr, sg, sb] = surfaceRgbStr.split(',').map((s) => Number(s.trim()));
  const l1 = luminanceRgb(cr, cg, cb);
  const l2 = luminanceRgb(sr, sg, sb);
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

describe('weatherTheme', () => {
  it('resolves distinct palettes for explicit day, dusk, and night modes', () => {
    const day = resolveWeatherThemePalette('day');
    const dusk = resolveWeatherThemePalette('dusk');
    const night = resolveWeatherThemePalette('night');

    expect(day.phase).toBe('day');
    expect(day.labelZh).toBe('明媚白昼');
    expect(dusk.phase).toBe('dusk');
    expect(dusk.labelZh).toBe('暮色黄昏');
    expect(night.phase).toBe('night');
    expect(night.labelZh).toBe('深邃星夜');

    expect(day.accent).not.toBe(dusk.accent);
    expect(dusk.accent).not.toBe(night.accent);
    expect(day.surfaceRgb).not.toBe(night.surfaceRgb);
  });

  it('smoothly interpolates solar phases in auto mode and respects isLiveDay=false', () => {
    const lateNight = resolveWeatherThemePalette('auto', undefined, new Date(2026, 0, 1, 2, 0));
    const dawn = resolveWeatherThemePalette('auto', undefined, new Date(2026, 0, 1, 6, 12));
    const noon = resolveWeatherThemePalette('auto', undefined, new Date(2026, 0, 1, 12, 30));
    const goldenHour = resolveWeatherThemePalette('auto', undefined, new Date(2026, 0, 1, 18, 18));
    const blend = resolveWeatherThemePalette('auto', undefined, new Date(2026, 0, 1, 17, 15));

    expect(lateNight.phase).toBe('night');
    expect(dawn.phase).toBe('dawn');
    expect(noon.phase).toBe('day');
    expect(goldenHour.phase).toBe('dusk');

    // 17:15 sits midway between day (16:00) and dusk (18:30), so surfaceRgb differs from both endpoints
    expect(blend.surfaceRgb).not.toBe(noon.surfaceRgb);
    expect(blend.surfaceRgb).not.toBe(goldenHour.surfaceRgb);

    const liveNight = resolveWeatherThemePalette('auto', false, new Date(2026, 0, 1, 12, 30));
    expect(liveNight.phase).toBe('night');
    expect(liveNight.accent).toBe(lateNight.accent);
  });

  it('applies and cleans up all weather CSS variables cleanly', () => {
    const store = new Map<string, string>();
    const mockRoot = {
      style: {
        setProperty: (k: string, v: string) => store.set(k, v),
        removeProperty: (k: string) => {
          store.delete(k);
          return '';
        },
      } as unknown as CSSStyleDeclaration,
    };

    const palette = resolveWeatherThemePalette('dusk');
    applyWeatherThemeVariables(mockRoot, palette);

    for (const key of WEATHER_THEME_CSS_KEYS) {
      expect(store.has(key)).toBe(true);
    }
    expect(store.get('--accent')).toBe(palette.accent);
    expect(store.get('--arc-caret-color')).toBe(palette.caretColor);
    expect(store.get('--bg-surface')).toContain('var(--weather-glass-alpha)');

    const dawn = resolveWeatherThemePalette('auto', undefined, new Date(2026, 0, 1, 6, 12));
    const day = resolveWeatherThemePalette('day');
    const night = resolveWeatherThemePalette('night');
    for (const p of [dawn, day, palette, night]) {
      expect(p.caretColor).toMatch(/^#[0-9a-f]{6}$/i);
      expect(contrastWeather(p.caretColor, p.surfaceRgb)).toBeGreaterThanOrEqual(4.5);
    }
    expect(day.caretColor).not.toBe(palette.caretColor);
    expect(palette.caretColor).not.toBe(night.caretColor);

    applyWeatherThemeVariables(mockRoot, null);
    for (const key of WEATHER_THEME_CSS_KEYS) {
      expect(store.has(key)).toBe(false);
    }
  });
});
