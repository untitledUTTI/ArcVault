import { describe, expect, it } from 'vitest';
import {
  DEFAULT_REVISION_STICKERS,
  JOURNAL_STRIP_STICKERS,
  createDefaultStickerTextStyle,
  getEffectiveStickerTextStyle,
  getStickerCategory,
  isStripImageSticker,
  loadCustomStickers,
  loadDocArchiveStickers,
  resolveStickerFontStack,
  saveCustomStickers,
  saveDocArchiveStickers,
  type RevisionArchiveStickerItem,
  type RevisionStickerDef,
} from '../revisionStickers';

describe('revisionStickers', () => {
  it('defines 40 unique transparent strip journal stickers with valid metadata', () => {
    expect(JOURNAL_STRIP_STICKERS).toHaveLength(40);
    const ids = new Set<string>();
    for (const stk of JOURNAL_STRIP_STICKERS) {
      expect(ids.has(stk.id)).toBe(false);
      ids.add(stk.id);
      expect(getStickerCategory(stk)).toBe('journal');
      expect(isStripImageSticker(stk)).toBe(true);
      expect(stk.pngUrl).toMatch(/\/stickers\/journal\/journal-\d{2}\.png$/);
      expect(stk.color).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(stk.defaultTextColor).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(stk.textInset).toHaveLength(4);
      expect(stk.label.length).toBeGreaterThan(0);
    }
  });

  it('tags basic stickers properly', () => {
    expect(DEFAULT_REVISION_STICKERS.length).toBeGreaterThan(0);
    for (const stk of DEFAULT_REVISION_STICKERS) {
      expect(getStickerCategory(stk)).toBe('basic');
      expect(isStripImageSticker(stk)).toBe(false);
    }
  });

  it('resolves font presets and sanitizes custom font names', () => {
    expect(resolveStickerFontStack({ fontFamily: 'serif' })).toContain('Noto Serif SC');
    expect(resolveStickerFontStack({ fontFamily: 'kaiti' })).toContain('LXGW WenKai');
    expect(resolveStickerFontStack({ fontFamily: 'mono' })).toContain('JetBrains Mono');
    expect(
      resolveStickerFontStack({
        fontFamily: 'custom',
        customFontName: 'FangZheng; color: red{}',
      }),
    ).toContain("'FangZheng color: red'");
    expect(
      resolveStickerFontStack({
        fontFamily: 'custom',
        customFontName: '   ',
      }),
    ).toContain('PingFang SC');
  });

  it('creates high-contrast default text styles for dark vs light stickers', () => {
    const blackBarcode = JOURNAL_STRIP_STICKERS.find((s) => s.id === 'stk-journal-03');
    const creamTag = JOURNAL_STRIP_STICKERS.find((s) => s.id === 'stk-journal-01');
    const burgundyTag = JOURNAL_STRIP_STICKERS.find((s) => s.id === 'stk-journal-23');

    const blackStyle = createDefaultStickerTextStyle(blackBarcode, '关键证据');
    const creamStyle = createDefaultStickerTextStyle(creamTag, '待补充');
    const burgundyStyle = createDefaultStickerTextStyle(burgundyTag, '重点');

    expect(blackStyle.color).toBe('#f8fafc');
    expect(burgundyStyle.color).toBe('#fdf2f4');
    expect(creamStyle.color).toBe('#3a332c');
    expect(creamStyle.text).toBe('待补充');
    expect(creamStyle.strokeEnabled).toBe(false);
  });

  it('round-trips archive stickers with textOverlay and tolerates legacy items without textOverlay', () => {
    const store: Record<string, string> = {};
    const origLocalStorage = globalThis.localStorage;
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: (k: string) => (k in store ? store[k] : null),
        setItem: (k: string, v: string) => {
          store[k] = v;
        },
        removeItem: (k: string) => {
          delete store[k];
        },
      },
    });

    try {
      const items: RevisionArchiveStickerItem[] = [
        {
          id: 'arc-1',
          annId: 'ann-1',
          stickerId: 'stk-journal-04',
          draftText: '旧版无样式归档',
          snippet: '摘要',
          savedAt: 1700000000000,
        },
        {
          id: 'arc-2',
          annId: 'ann-2',
          stickerId: 'stk-journal-08',
          draftText: '新版带样式归档',
          snippet: '摘要2',
          savedAt: 1700000005000,
          textOverlay: {
            text: '实验组核对',
            fontFamily: 'kaiti',
            customFontName: '',
            fontSize: 13,
            bold: true,
            italic: false,
            underline: true,
            letterSpacing: 1,
            color: '#fef3c7',
            strokeEnabled: true,
            strokeColor: '#0f172a',
            strokeWidth: 2,
            shadow: 'retro',
          },
        },
      ];

      saveDocArchiveStickers('doc-test', items);
      const loaded = loadDocArchiveStickers('doc-test');
      expect(loaded).toHaveLength(2);
      expect(loaded[0].textOverlay).toBeUndefined();
      expect(loaded[1].textOverlay?.fontFamily).toBe('kaiti');
      expect(loaded[1].textOverlay?.strokeEnabled).toBe(true);
      expect(loaded[1].textOverlay?.strokeWidth).toBe(2);

      const stk04 = JOURNAL_STRIP_STICKERS.find((s) => s.id === 'stk-journal-04');
      const fallbackStyle = getEffectiveStickerTextStyle(stk04, loaded[0]);
      expect(fallbackStyle.text).toBe('旧版无样式归档');
      const customStyle = getEffectiveStickerTextStyle(stk04, loaded[1]);
      expect(customStyle.text).toBe('实验组核对');

      const customStickers: RevisionStickerDef[] = [
        {
          id: 'stk-custom-1',
          label: '我的手帐条',
          color: '#10b981',
          category: 'custom',
          isCustom: true,
          isStripImage: true,
          pngUrl: '/stickers/journal/journal-04.png',
          defaultTextStyle: customStyle,
        },
      ];
      saveCustomStickers(customStickers);
      const loadedCustom = loadCustomStickers();
      expect(loadedCustom).toHaveLength(1);
      expect(loadedCustom[0].defaultTextStyle?.text).toBe('实验组核对');
      expect(getStickerCategory(loadedCustom[0])).toBe('custom');
    } finally {
      Object.defineProperty(globalThis, 'localStorage', {
        configurable: true,
        value: origLocalStorage,
      });
    }
  });
});
