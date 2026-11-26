import {
  argbFromHex,
  argbFromRgb,
  hexFromArgb,
  Hct,
  QuantizerCelebi,
  SchemeContent,
  SchemeExpressive,
  SchemeFidelity,
  SchemeFruitSalad,
  SchemeMonochrome,
  SchemeNeutral,
  SchemeRainbow,
  SchemeTonalSpot,
  SchemeVibrant,
  DynamicScheme,
  TonalPalette,
  Score,
  Variant,
} from '@material/material-color-utilities';
import type { MonetSettings, MonetStyle } from '../types/archive';

export interface MonetStyleInfo {
  id: MonetStyle;
  nameZh: string;
  nameEn: string;
  desc: string;
  descEn: string;
}

export const MONET_STYLE_META: MonetStyleInfo[] = [
  { id: 'tonal-spot', nameZh: '色调点', nameEn: 'Tonal Spot', desc: 'Android 默认经典莫奈，沉稳协调', descEn: 'Classic balanced Android Material You palette' },
  { id: 'expressive', nameZh: '表达', nameEn: 'Expressive', desc: 'M3E 官方主推，色相跳跃更具表现力', descEn: 'M3 Expressive signature with lively hue shifts' },
  { id: 'vibrant', nameZh: '鲜艳', nameEn: 'Vibrant', desc: '高饱和鲜活强调色，富有活力', descEn: 'High-chroma vibrant accents full of energy' },
  { id: 'neutral', nameZh: '自然', nameEn: 'Neutral', desc: '低彩度微暖/微冷中性灰，专注耐看', descEn: 'Low-chroma warm/cool neutrals for focused reading' },
  { id: 'monochrome', nameZh: '单色', nameEn: 'Monochrome', desc: '纯净极简黑白灰阶，零色彩干扰', descEn: 'Pure minimalist grayscale with zero color distraction' },
  { id: 'fidelity', nameZh: '保真', nameEn: 'Fidelity', desc: '忠实保留种子原色色相与饱和度', descEn: 'Faithfully preserves the seed hue and chroma' },
  { id: 'content', nameZh: '内容', nameEn: 'Content', desc: '紧扣内容/封面主色自动协调配对', descEn: 'Harmonizes closely with content or cover artwork' },
  { id: 'rainbow', nameZh: '彩虹', nameEn: 'Rainbow', desc: '多色相旋转拼接，灵动丰富', descEn: 'Playful multi-hue rotation across accent roles' },
  { id: 'fruit-salad', nameZh: '水果沙拉', nameEn: 'Fruit Salad', desc: '对比鲜明的双果色混搭趣味主题', descEn: 'Playful high-contrast dual-tone fruit palette' },
  { id: 'fantasy', nameZh: '幻想', nameEn: 'Fantasy', desc: '梦幻天象三色相偏移，高雅浪漫', descEn: 'Dreamy tri-hue celestial shift, refined and poetic' },
];

export const DEFAULT_MONET: MonetSettings = {
  seedColor: '#6750a4',
  style: 'expressive',
  isDark: false,
  contrastLevel: 0,
  extractedSeeds: [],
};

export const MONET_CURATED_SEEDS: Array<{ hex: string; label: string; labelEn: string }> = [
  { hex: '#6750a4', label: 'M3 薰衣草紫', labelEn: 'M3 Lavender' },
  { hex: '#1a73e8', label: 'Pixel 晴空蓝', labelEn: 'Pixel Sky Blue' },
  { hex: '#006a6a', label: '松石青黛', labelEn: 'Pine Teal' },
  { hex: '#2e7d32', label: '森屿苔绿', labelEn: 'Forest Moss' },
  { hex: '#d84315', label: '落日赤陶', labelEn: 'Sunset Terracotta' },
  { hex: '#c2185b', label: '维纳斯玫红', labelEn: 'Venus Rose' },
  { hex: '#b45309', label: '琥珀金秋', labelEn: 'Autumn Amber' },
  { hex: '#455a64', label: '暮色星岩', labelEn: 'Dusk Slate' },
];

export interface MonetColorTokens {
  primary: string;
  onPrimary: string;
  primaryContainer: string;
  onPrimaryContainer: string;
  secondary: string;
  secondaryContainer: string;
  onSecondaryContainer: string;
  tertiary: string;
  tertiaryContainer: string;
  onTertiaryContainer: string;
  background: string;
  surface: string;
  surfaceContainerLowest: string;
  surfaceContainerLow: string;
  surfaceContainer: string;
  surfaceContainerHigh: string;
  surfaceContainerHighest: string;
  onSurface: string;
  onSurfaceVariant: string;
  outline: string;
  outlineVariant: string;
  caretColor: string;
  isDark: boolean;
}

function buildDynamicScheme(settings: MonetSettings): DynamicScheme {
  const safeHex = /^#[0-9a-fA-F]{6}$/.test(settings.seedColor) ? settings.seedColor : '#6750a4';
  const sourceHct = Hct.fromInt(argbFromHex(safeHex));
  const { isDark, contrastLevel, style } = settings;

  switch (style) {
    case 'tonal-spot':
      return new SchemeTonalSpot(sourceHct, isDark, contrastLevel, '2025');
    case 'neutral':
      return new SchemeNeutral(sourceHct, isDark, contrastLevel, '2025');
    case 'monochrome':
      return new SchemeMonochrome(sourceHct, isDark, contrastLevel, '2025');
    case 'vibrant':
      return new SchemeVibrant(sourceHct, isDark, contrastLevel, '2025');
    case 'rainbow':
      return new SchemeRainbow(sourceHct, isDark, contrastLevel);
    case 'expressive':
      return new SchemeExpressive(sourceHct, isDark, contrastLevel, '2025');
    case 'content':
      return new SchemeContent(sourceHct, isDark, contrastLevel);
    case 'fruit-salad':
      return new SchemeFruitSalad(sourceHct, isDark, contrastLevel);
    case 'fidelity':
      return new SchemeFidelity(sourceHct, isDark, contrastLevel);
    case 'fantasy': {
      // Dreamy 3-way celestial hue rotation with rich pastel/aurora chroma
      const h = sourceHct.hue;
      const baseC = Math.max(46, sourceHct.chroma);
      return new DynamicScheme({
        sourceColorHct: sourceHct,
        variant: Variant.EXPRESSIVE,
        contrastLevel,
        isDark,
        specVersion: '2021',
        primaryPalette: TonalPalette.fromHueAndChroma((h + 15) % 360, baseC),
        secondaryPalette: TonalPalette.fromHueAndChroma((h + 62) % 360, 32),
        tertiaryPalette: TonalPalette.fromHueAndChroma((h + 158) % 360, 56),
        neutralPalette: TonalPalette.fromHueAndChroma((h + 24) % 360, 10),
        neutralVariantPalette: TonalPalette.fromHueAndChroma((h + 24) % 360, 16),
      });
    }
  }
}

export function generateMonetTokens(settings: MonetSettings): MonetColorTokens {
  const s = buildDynamicScheme(settings);
  const primaryHct = Hct.fromInt(s.primary);
  const targetTone = settings.isDark
    ? Math.max(primaryHct.tone, 82)
    : Math.min(primaryHct.tone, 38);
  const targetChroma =
    settings.style === 'monochrome' || settings.style === 'neutral'
      ? primaryHct.chroma
      : Math.max(primaryHct.chroma, 42);
  const caretColor = hexFromArgb(
    Hct.from(primaryHct.hue, targetChroma, targetTone).toInt(),
  );

  return {
    primary: hexFromArgb(s.primary),
    onPrimary: hexFromArgb(s.onPrimary),
    primaryContainer: hexFromArgb(s.primaryContainer),
    onPrimaryContainer: hexFromArgb(s.onPrimaryContainer),
    secondary: hexFromArgb(s.secondary),
    secondaryContainer: hexFromArgb(s.secondaryContainer),
    onSecondaryContainer: hexFromArgb(s.onSecondaryContainer),
    tertiary: hexFromArgb(s.tertiary),
    tertiaryContainer: hexFromArgb(s.tertiaryContainer),
    onTertiaryContainer: hexFromArgb(s.onTertiaryContainer),
    background: hexFromArgb(s.background),
    surface: hexFromArgb(s.surface),
    surfaceContainerLowest: hexFromArgb(s.surfaceContainerLowest),
    surfaceContainerLow: hexFromArgb(s.surfaceContainerLow),
    surfaceContainer: hexFromArgb(s.surfaceContainer),
    surfaceContainerHigh: hexFromArgb(s.surfaceContainerHigh),
    surfaceContainerHighest: hexFromArgb(s.surfaceContainerHighest),
    onSurface: hexFromArgb(s.onSurface),
    onSurfaceVariant: hexFromArgb(s.onSurfaceVariant),
    outline: hexFromArgb(s.outline),
    outlineVariant: hexFromArgb(s.outlineVariant),
    caretColor,
    isDark: settings.isDark,
  };
}

const MONET_CSS_KEYS = [
  '--m3-surface-container-lowest',
  '--m3-surface-container-low',
  '--m3-surface-container',
  '--m3-surface-container-high',
  '--m3-surface-container-highest',
  '--m3-primary',
  '--m3-on-primary',
  '--m3-primary-container',
  '--m3-on-primary-container',
  '--m3-secondary',
  '--m3-secondary-container',
  '--m3-on-secondary-container',
  '--m3-tertiary',
  '--m3-tertiary-container',
  '--m3-on-tertiary-container',
  '--m3-outline',
  '--m3-outline-variant',
  '--bg-app',
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
  '--arc-dome-gradient',
  '--scrollbar-thumb',
  '--scrollbar-thumb-hover',
  '--scrollbar-thumb-active',
  '--arc-caret-color',
  '--shadow-sm',
  '--shadow-md',
];

export function applyMonetCssVariables(
  root: HTMLElement,
  tokens: MonetColorTokens | null,
): void {
  if (!tokens) {
    for (const k of MONET_CSS_KEYS) {
      root.style.removeProperty(k);
    }
    return;
  }

  root.style.setProperty('--m3-surface-container-lowest', tokens.surfaceContainerLowest);
  root.style.setProperty('--m3-surface-container-low', tokens.surfaceContainerLow);
  root.style.setProperty('--m3-surface-container', tokens.surfaceContainer);
  root.style.setProperty('--m3-surface-container-high', tokens.surfaceContainerHigh);
  root.style.setProperty('--m3-surface-container-highest', tokens.surfaceContainerHighest);
  root.style.setProperty('--m3-primary', tokens.primary);
  root.style.setProperty('--m3-on-primary', tokens.onPrimary);
  root.style.setProperty('--m3-primary-container', tokens.primaryContainer);
  root.style.setProperty('--m3-on-primary-container', tokens.onPrimaryContainer);
  root.style.setProperty('--m3-secondary', tokens.secondary);
  root.style.setProperty('--m3-secondary-container', tokens.secondaryContainer);
  root.style.setProperty('--m3-on-secondary-container', tokens.onSecondaryContainer);
  root.style.setProperty('--m3-tertiary', tokens.tertiary);
  root.style.setProperty('--m3-tertiary-container', tokens.tertiaryContainer);
  root.style.setProperty('--m3-on-tertiary-container', tokens.onTertiaryContainer);
  root.style.setProperty('--m3-outline', tokens.outline);
  root.style.setProperty('--m3-outline-variant', tokens.outlineVariant);

  root.style.setProperty('--bg-app', tokens.surfaceContainer);
  root.style.setProperty('--bg-surface', tokens.surfaceContainerLow);
  root.style.setProperty('--bg-elevated', tokens.surfaceContainerLowest);
  root.style.setProperty('--bg-subtle', tokens.surfaceContainerHigh);
  root.style.setProperty('--bg-hover', tokens.surfaceContainerHighest);
  root.style.setProperty(
    '--border-subtle',
    `color-mix(in srgb, ${tokens.outlineVariant} 55%, transparent)`,
  );
  root.style.setProperty('--border-strong', tokens.outline);

  root.style.setProperty('--text-primary', tokens.onSurface);
  root.style.setProperty('--text-secondary', tokens.onSurfaceVariant);
  root.style.setProperty(
    '--text-muted',
    `color-mix(in srgb, ${tokens.onSurfaceVariant} 72%, ${tokens.surface})`,
  );

  root.style.setProperty('--accent', tokens.primary);
  root.style.setProperty('--accent-soft', tokens.primaryContainer);
  root.style.setProperty('--accent-text', tokens.onPrimary);

  root.style.setProperty(
    '--arc-dome-gradient',
    `linear-gradient(135deg, ${tokens.primary} 0%, ${tokens.secondary} 50%, ${tokens.tertiary} 100%)`,
  );
  root.style.setProperty(
    '--scrollbar-thumb',
    `color-mix(in srgb, ${tokens.primary} 26%, transparent)`,
  );
  root.style.setProperty(
    '--scrollbar-thumb-hover',
    `color-mix(in srgb, ${tokens.primary} 50%, transparent)`,
  );
  root.style.setProperty('--scrollbar-thumb-active', tokens.primary);
  root.style.setProperty('--arc-caret-color', tokens.caretColor);

  root.style.setProperty(
    '--shadow-sm',
    tokens.isDark
      ? '0 4px 14px rgba(0, 0, 0, 0.38)'
      : `0 4px 14px color-mix(in srgb, ${tokens.primary} 10%, transparent)`,
  );
  root.style.setProperty(
    '--shadow-md',
    tokens.isDark
      ? '0 16px 38px rgba(0, 0, 0, 0.54)'
      : `0 16px 38px color-mix(in srgb, ${tokens.primary} 16%, transparent)`,
  );
}

/**
 * Runs Android's exact QuantizerCelebi + Score pipeline on raw RGBA pixel data
 * to extract up to 4 ranked UI-suitable Monet seed colors.
 */
export function extractSeedColorsFromRgba(rgba: Uint8ClampedArray): string[] {
  const pixels: number[] = [];
  for (let i = 0; i < rgba.length; i += 4) {
    const a = rgba[i + 3];
    if (a < 128) continue;
    pixels.push(argbFromRgb(rgba[i], rgba[i + 1], rgba[i + 2]));
  }
  if (pixels.length === 0) return ['#6750a4'];

  const quantized = QuantizerCelebi.quantize(pixels, 128);
  const ranked = Score.score(quantized, {
    desired: 4,
    fallbackColorARGB: argbFromHex('#6750a4'),
  });
  return ranked.map((argb) => hexFromArgb(argb));
}

export async function extractSeedsFromImageFile(
  file: File,
): Promise<{ seeds: string[]; thumbDataUrl: string }> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('读取图片失败'));
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('解码图片失败'));
    image.src = dataUrl;
  });

  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return { seeds: ['#6750a4'], thumbDataUrl: dataUrl };

  ctx.drawImage(img, 0, 0, size, size);
  const imageData = ctx.getImageData(0, 0, size, size);
  const seeds = extractSeedColorsFromRgba(imageData.data);
  const thumbDataUrl = canvas.toDataURL('image/jpeg', 0.8);
  return { seeds, thumbDataUrl };
}
