import type { WeatherTimeOfDay } from '../types/archive';

export type WeatherColorPhase = 'dawn' | 'day' | 'dusk' | 'night';

export interface WeatherThemePalette {
  phase: WeatherColorPhase;
  labelZh: string;
  labelEn: string;
  surfaceRgb: string;
  surfaceDeepRgb: string;
  cardRgb: string;
  elevatedBg: string;
  subtleBg: string;
  hoverBg: string;
  borderRgb: string;
  borderSubtle: string;
  borderStrong: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  accent: string;
  accentSoft: string;
  accentText: string;
  caretColor: string;
  glowPrimaryRgb: string;
  glowSecondaryRgb: string;
  shadowRgb: string;
  shadowSm: string;
  shadowMd: string;
  domeGradient: string;
  scrollbarThumb: string;
  scrollbarThumbHover: string;
  scrollbarThumbActive: string;
}

type Rgb = [number, number, number];

interface PaletteStop {
  phase: WeatherColorPhase;
  labelZh: string;
  labelEn: string;
  surface: Rgb;
  surfaceDeep: Rgb;
  card: Rgb;
  elevated: Rgb;
  subtle: Rgb;
  hover: Rgb;
  border: Rgb;
  textPrimary: Rgb;
  textSecondary: Rgb;
  textMuted: Rgb;
  accent: Rgb;
  accentText: Rgb;
  caret: Rgb;
  glowPrimary: Rgb;
  glowSecondary: Rgb;
  shadow: Rgb;
  domeStops: [Rgb, Rgb, Rgb];
}

const STOP_NIGHT: PaletteStop = {
  phase: 'night',
  labelZh: '深邃星夜',
  labelEn: 'Starry Night',
  surface: [10, 17, 30],
  surfaceDeep: [8, 14, 28],
  card: [14, 24, 44],
  elevated: [12, 19, 34],
  subtle: [24, 38, 62],
  hover: [42, 68, 108],
  border: [196, 224, 255],
  textPrimary: [242, 247, 255],
  textSecondary: [195, 215, 240],
  textMuted: [138, 165, 200],
  accent: [96, 165, 250],
  accentText: [4, 19, 34],
  caret: [147, 208, 255],
  glowPrimary: [96, 165, 250],
  glowSecondary: [129, 140, 248],
  shadow: [2, 8, 22],
  domeStops: [
    [96, 165, 250],
    [129, 140, 248],
    [192, 132, 252],
  ],
};

const STOP_DAWN: PaletteStop = {
  phase: 'dawn',
  labelZh: '晨曦破晓',
  labelEn: 'Morning Dawn',
  surface: [32, 22, 42],
  surfaceDeep: [24, 17, 34],
  card: [42, 28, 52],
  elevated: [34, 24, 44],
  subtle: [58, 40, 72],
  hover: [84, 56, 98],
  border: [253, 216, 228],
  textPrimary: [255, 246, 249],
  textSecondary: [236, 206, 222],
  textMuted: [190, 156, 178],
  accent: [251, 113, 133],
  accentText: [36, 10, 20],
  caret: [255, 174, 192],
  glowPrimary: [251, 113, 133],
  glowSecondary: [251, 191, 36],
  shadow: [18, 8, 24],
  domeStops: [
    [253, 164, 175],
    [251, 191, 36],
    [56, 189, 248],
  ],
};

const STOP_DAY: PaletteStop = {
  phase: 'day',
  labelZh: '明媚白昼',
  labelEn: 'Bright Day',
  surface: [12, 42, 76],
  surfaceDeep: [10, 34, 64],
  card: [16, 52, 92],
  elevated: [14, 40, 72],
  subtle: [26, 72, 120],
  hover: [38, 96, 154],
  border: [208, 240, 255],
  textPrimary: [244, 250, 255],
  textSecondary: [204, 232, 252],
  textMuted: [148, 194, 228],
  accent: [56, 189, 248],
  accentText: [3, 24, 42],
  caret: [186, 246, 255],
  glowPrimary: [56, 189, 248],
  glowSecondary: [34, 211, 238],
  shadow: [4, 18, 38],
  domeStops: [
    [56, 189, 248],
    [34, 211, 238],
    [251, 191, 36],
  ],
};

const STOP_DUSK: PaletteStop = {
  phase: 'dusk',
  labelZh: '暮色黄昏',
  labelEn: 'Golden Dusk',
  surface: [38, 24, 44],
  surfaceDeep: [28, 18, 36],
  card: [48, 30, 52],
  elevated: [36, 22, 42],
  subtle: [68, 42, 68],
  hover: [96, 58, 86],
  border: [253, 224, 196],
  textPrimary: [255, 248, 242],
  textSecondary: [240, 212, 194],
  textMuted: [194, 160, 146],
  accent: [245, 158, 11],
  accentText: [34, 18, 4],
  caret: [255, 207, 102],
  glowPrimary: [245, 158, 11],
  glowSecondary: [244, 114, 182],
  shadow: [20, 8, 18],
  domeStops: [
    [251, 191, 36],
    [251, 113, 133],
    [168, 85, 247],
  ],
};

const SOLAR_KEYFRAMES: Array<{ hour: number; stop: PaletteStop }> = [
  { hour: 0.0, stop: STOP_NIGHT },
  { hour: 4.5, stop: STOP_NIGHT },
  { hour: 6.2, stop: STOP_DAWN },
  { hour: 8.5, stop: STOP_DAY },
  { hour: 16.0, stop: STOP_DAY },
  { hour: 18.3, stop: STOP_DUSK },
  { hour: 20.5, stop: STOP_NIGHT },
  { hour: 24.0, stop: STOP_NIGHT },
];

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpRgb(c1: Rgb, c2: Rgb, t: number): Rgb {
  return [
    Math.round(lerp(c1[0], c2[0], t)),
    Math.round(lerp(c1[1], c2[1], t)),
    Math.round(lerp(c1[2], c2[2], t)),
  ];
}

function rgbTuple(c: Rgb): string {
  return `${c[0]}, ${c[1]}, ${c[2]}`;
}

function rgbHex(c: Rgb): string {
  return (
    '#' +
    c
      .map((n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0'))
      .join('')
  );
}

function rgbaStr(c: Rgb, alpha: number): string {
  return `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${alpha})`;
}

function buildPalette(stop: PaletteStop): WeatherThemePalette {
  const surfaceRgb = rgbTuple(stop.surface);
  const surfaceDeepRgb = rgbTuple(stop.surfaceDeep);
  const cardRgb = rgbTuple(stop.card);
  const borderRgb = rgbTuple(stop.border);
  const glowPrimaryRgb = rgbTuple(stop.glowPrimary);
  const glowSecondaryRgb = rgbTuple(stop.glowSecondary);
  const shadowRgb = rgbTuple(stop.shadow);

  return {
    phase: stop.phase,
    labelZh: stop.labelZh,
    labelEn: stop.labelEn,
    surfaceRgb,
    surfaceDeepRgb,
    cardRgb,
    elevatedBg: rgbaStr(stop.elevated, 0.88),
    subtleBg: rgbaStr(stop.subtle, 0.54),
    hoverBg: rgbaStr(stop.hover, 0.6),
    borderRgb,
    borderSubtle: rgbaStr(stop.border, 0.18),
    borderStrong: rgbaStr(stop.glowPrimary, 0.4),
    textPrimary: rgbHex(stop.textPrimary),
    textSecondary: rgbHex(stop.textSecondary),
    textMuted: rgbHex(stop.textMuted),
    accent: rgbHex(stop.accent),
    accentSoft: rgbaStr(stop.accent, 0.18),
    accentText: rgbHex(stop.accentText),
    caretColor: rgbHex(stop.caret),
    glowPrimaryRgb,
    glowSecondaryRgb,
    shadowRgb,
    shadowSm: `0 4px 16px rgba(${shadowRgb}, 0.44)`,
    shadowMd: `0 18px 46px rgba(${shadowRgb}, 0.68)`,
    domeGradient: `linear-gradient(135deg, ${rgbHex(stop.domeStops[0])} 0%, ${rgbHex(stop.domeStops[1])} 52%, ${rgbHex(stop.domeStops[2])} 100%)`,
    scrollbarThumb: rgbaStr(stop.border, 0.28),
    scrollbarThumbHover: rgbaStr(stop.border, 0.52),
    scrollbarThumbActive: rgbaStr(stop.accent, 0.85),
  };
}

function interpolateStops(a: PaletteStop, b: PaletteStop, t: number, phase: WeatherColorPhase, labelZh: string, labelEn: string): PaletteStop {
  return {
    phase,
    labelZh,
    labelEn,
    surface: lerpRgb(a.surface, b.surface, t),
    surfaceDeep: lerpRgb(a.surfaceDeep, b.surfaceDeep, t),
    card: lerpRgb(a.card, b.card, t),
    elevated: lerpRgb(a.elevated, b.elevated, t),
    subtle: lerpRgb(a.subtle, b.subtle, t),
    hover: lerpRgb(a.hover, b.hover, t),
    border: lerpRgb(a.border, b.border, t),
    textPrimary: lerpRgb(a.textPrimary, b.textPrimary, t),
    textSecondary: lerpRgb(a.textSecondary, b.textSecondary, t),
    textMuted: lerpRgb(a.textMuted, b.textMuted, t),
    accent: lerpRgb(a.accent, b.accent, t),
    accentText: lerpRgb(a.accentText, b.accentText, t),
    caret: lerpRgb(a.caret, b.caret, t),
    glowPrimary: lerpRgb(a.glowPrimary, b.glowPrimary, t),
    glowSecondary: lerpRgb(a.glowSecondary, b.glowSecondary, t),
    shadow: lerpRgb(a.shadow, b.shadow, t),
    domeStops: [
      lerpRgb(a.domeStops[0], b.domeStops[0], t),
      lerpRgb(a.domeStops[1], b.domeStops[1], t),
      lerpRgb(a.domeStops[2], b.domeStops[2], t),
    ],
  };
}

function resolvePhaseLabel(hour: number): { phase: WeatherColorPhase; labelZh: string; labelEn: string } {
  if (hour >= 4.75 && hour < 7.5) return { phase: 'dawn', labelZh: '晨曦破晓', labelEn: 'Morning Dawn' };
  if (hour >= 7.5 && hour < 16.75) return { phase: 'day', labelZh: '明媚白昼', labelEn: 'Bright Day' };
  if (hour >= 16.75 && hour < 19.75) return { phase: 'dusk', labelZh: '暮色黄昏', labelEn: 'Golden Dusk' };
  return { phase: 'night', labelZh: '深邃星夜', labelEn: 'Starry Night' };
}

/**
 * Resolves the UI glass, border, text and accent palette for the Real-Time Weather
 * theme from either an explicit timeOfDay override or smooth solar-time interpolation.
 */
export function resolveWeatherThemePalette(
  timeOfDay: WeatherTimeOfDay,
  isLiveDay?: boolean,
  now: Date = new Date(),
): WeatherThemePalette {
  if (timeOfDay === 'day') return buildPalette(STOP_DAY);
  if (timeOfDay === 'dusk') return buildPalette(STOP_DUSK);
  if (timeOfDay === 'night') return buildPalette(STOP_NIGHT);
  if (isLiveDay === false) return buildPalette(STOP_NIGHT);

  const hour = Math.max(0, Math.min(24, now.getHours() + now.getMinutes() / 60));
  const { phase, labelZh, labelEn } = resolvePhaseLabel(hour);

  for (let i = 0; i < SOLAR_KEYFRAMES.length - 1; i++) {
    const k0 = SOLAR_KEYFRAMES[i];
    const k1 = SOLAR_KEYFRAMES[i + 1];
    if (hour >= k0.hour && hour <= k1.hour) {
      const span = Math.max(0.001, k1.hour - k0.hour);
      const t = (hour - k0.hour) / span;
      return buildPalette(interpolateStops(k0.stop, k1.stop, t, phase, labelZh, labelEn));
    }
  }

  return buildPalette(STOP_NIGHT);
}

export const WEATHER_THEME_CSS_KEYS = [
  '--weather-surface-rgb',
  '--weather-surface-deep-rgb',
  '--weather-card-rgb',
  '--weather-border-rgb',
  '--weather-glow-primary-rgb',
  '--weather-glow-secondary-rgb',
  '--weather-shadow-rgb',
  '--bg-surface',
  '--bg-elevated',
  '--bg-subtle',
  '--bg-hover',
  '--border-subtle',
  '--border-strong',
  '--text-primary',
  '--text-secondary',
  '--text-muted',
  '--accent',
  '--accent-soft',
  '--accent-text',
  '--arc-caret-color',
  '--shadow-sm',
  '--shadow-md',
  '--arc-dome-gradient',
  '--scrollbar-thumb',
  '--scrollbar-thumb-hover',
  '--scrollbar-thumb-active',
] as const;

export function applyWeatherThemeVariables(
  root: Pick<HTMLElement, 'style'>,
  palette: WeatherThemePalette | null,
): void {
  if (!palette) {
    for (const key of WEATHER_THEME_CSS_KEYS) {
      root.style.removeProperty(key);
    }
    return;
  }

  root.style.setProperty('--weather-surface-rgb', palette.surfaceRgb);
  root.style.setProperty('--weather-surface-deep-rgb', palette.surfaceDeepRgb);
  root.style.setProperty('--weather-card-rgb', palette.cardRgb);
  root.style.setProperty('--weather-border-rgb', palette.borderRgb);
  root.style.setProperty('--weather-glow-primary-rgb', palette.glowPrimaryRgb);
  root.style.setProperty('--weather-glow-secondary-rgb', palette.glowSecondaryRgb);
  root.style.setProperty('--weather-shadow-rgb', palette.shadowRgb);

  root.style.setProperty(
    '--bg-surface',
    `rgba(${palette.surfaceRgb}, var(--weather-glass-alpha))`,
  );
  root.style.setProperty('--bg-elevated', palette.elevatedBg);
  root.style.setProperty('--bg-subtle', palette.subtleBg);
  root.style.setProperty('--bg-hover', palette.hoverBg);
  root.style.setProperty('--border-subtle', palette.borderSubtle);
  root.style.setProperty('--border-strong', palette.borderStrong);
  root.style.setProperty('--text-primary', palette.textPrimary);
  root.style.setProperty('--text-secondary', palette.textSecondary);
  root.style.setProperty('--text-muted', palette.textMuted);
  root.style.setProperty('--accent', palette.accent);
  root.style.setProperty('--accent-soft', palette.accentSoft);
  root.style.setProperty('--accent-text', palette.accentText);
  root.style.setProperty('--arc-caret-color', palette.caretColor);
  root.style.setProperty('--shadow-sm', palette.shadowSm);
  root.style.setProperty('--shadow-md', palette.shadowMd);
  root.style.setProperty('--arc-dome-gradient', palette.domeGradient);
  root.style.setProperty('--scrollbar-thumb', palette.scrollbarThumb);
  root.style.setProperty('--scrollbar-thumb-hover', palette.scrollbarThumbHover);
  root.style.setProperty('--scrollbar-thumb-active', palette.scrollbarThumbActive);
}
