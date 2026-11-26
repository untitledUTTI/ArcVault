import { describe, it, expect } from 'vitest';
import {
  MONET_STYLE_META,
  applyMonetCssVariables,
  extractSeedColorsFromRgba,
  generateMonetTokens,
} from '../monetEngine';

function relativeLuminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrastRatioHex(hex1: string, hex2: string): number {
  const l1 = relativeLuminance(hex1);
  const l2 = relativeLuminance(hex2);
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

describe('Android Monet Dynamic Color Engine (HCT / DynamicScheme)', () => {
  it('generates valid M3 color tokens across all 10 styles in both light and dark polarities', () => {
    const hexRegex = /^#[0-9a-f]{6}$/i;

    for (const meta of MONET_STYLE_META) {
      for (const isDark of [false, true]) {
        const tokens = generateMonetTokens({
          seedColor: '#1a73e8',
          style: meta.id,
          isDark,
          contrastLevel: 0,
        });

        expect(tokens.primary).toMatch(hexRegex);
        expect(tokens.primaryContainer).toMatch(hexRegex);
        expect(tokens.secondaryContainer).toMatch(hexRegex);
        expect(tokens.tertiaryContainer).toMatch(hexRegex);
        expect(tokens.surfaceContainerLow).toMatch(hexRegex);
        expect(tokens.onSurface).toMatch(hexRegex);
      }
    }
  });

  it('produces pure grayscale primary for monochrome and distinct hues for expressive/fruit-salad', () => {
    const mono = generateMonetTokens({
      seedColor: '#e53935',
      style: 'monochrome',
      isDark: false,
      contrastLevel: 0,
    });
    const r = mono.primary.slice(1, 3);
    const g = mono.primary.slice(3, 5);
    const b = mono.primary.slice(5, 7);
    expect(r).toBe(g);
    expect(g).toBe(b);

    const expressive = generateMonetTokens({
      seedColor: '#1a73e8',
      style: 'expressive',
      isDark: false,
      contrastLevel: 0,
    });
    const tonal = generateMonetTokens({
      seedColor: '#1a73e8',
      style: 'tonal-spot',
      isDark: false,
      contrastLevel: 0,
    });
    expect(expressive.tertiaryContainer).not.toBe(tonal.tertiaryContainer);

    const highContrast = generateMonetTokens({
      seedColor: '#1a73e8',
      style: 'tonal-spot',
      isDark: false,
      contrastLevel: 1.0,
    });
    expect(highContrast.primary).not.toBe(tonal.primary);
  });

  it('extracts dominant UI seed colors from RGBA pixels using QuantizerCelebi + Score', () => {
    // 64x64 vibrant teal-cyan image buffer
    const rgba = new Uint8ClampedArray(64 * 64 * 4);
    for (let i = 0; i < rgba.length; i += 4) {
      rgba[i] = 18;
      rgba[i + 1] = 148;
      rgba[i + 2] = 166;
      rgba[i + 3] = 255;
    }

    const seeds = extractSeedColorsFromRgba(rgba);
    expect(seeds.length).toBeGreaterThanOrEqual(1);
    expect(seeds[0]).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it('derives high-contrast WCAG AA caretColor across all Monet styles and cleans up CSS vars', () => {
    const hexRegex = /^#[0-9a-f]{6}$/i;
    for (const meta of MONET_STYLE_META) {
      for (const isDark of [false, true]) {
        const tokens = generateMonetTokens({
          seedColor: '#1a73e8',
          style: meta.id,
          isDark,
          contrastLevel: 0,
        });
        expect(tokens.caretColor).toMatch(hexRegex);
        expect(contrastRatioHex(tokens.caretColor, tokens.surfaceContainerLow)).toBeGreaterThanOrEqual(4.5);
        if (meta.id === 'monochrome') {
          expect(tokens.caretColor.slice(1, 3)).toBe(tokens.caretColor.slice(3, 5));
          expect(tokens.caretColor.slice(3, 5)).toBe(tokens.caretColor.slice(5, 7));
        }
      }
    }

    const store = new Map<string, string>();
    const mockRoot = {
      style: {
        setProperty: (k: string, v: string) => store.set(k, v),
        removeProperty: (k: string) => {
          store.delete(k);
          return '';
        },
      } as unknown as CSSStyleDeclaration,
    } as HTMLElement;

    const sample = generateMonetTokens({
      seedColor: '#6750a4',
      style: 'expressive',
      isDark: false,
      contrastLevel: 0,
    });
    applyMonetCssVariables(mockRoot, sample);
    expect(store.get('--arc-caret-color')).toBe(sample.caretColor);

    applyMonetCssVariables(mockRoot, null);
    expect(store.has('--arc-caret-color')).toBe(false);
  });
});
