export interface RevisionDraftEntry {
  annId: string;
  text: string;
  updatedAt: number;
}

export type StickerCategory = 'journal' | 'basic' | 'custom';

export type StickerFontPreset =
  | 'default'
  | 'serif'
  | 'kaiti'
  | 'fangsong'
  | 'rounded'
  | 'mono'
  | 'cursive'
  | 'custom';

export type StickerTextShadow = 'none' | 'soft' | 'retro';

export interface StickerTextStyle {
  text: string;
  fontFamily: StickerFontPreset;
  customFontName?: string;
  fontSize: number; // 9..20
  bold: boolean;
  italic: boolean;
  underline: boolean;
  letterSpacing: number; // 0..4
  color: string;
  strokeEnabled: boolean;
  strokeColor: string;
  strokeWidth: number; // 0.5..4
  shadow: StickerTextShadow;
}

export interface RevisionStickerDef {
  id: string;
  label: string;
  labelEn?: string;
  emoji?: string;
  color: string;
  category?: StickerCategory;
  pngUrl?: string;
  pngDataUrl?: string;
  isStripImage?: boolean;
  isCustom?: boolean;
  defaultTextColor?: string;
  defaultStrokeColor?: string;
  /** [top%, right%, bottom%, left%] safe inner padding for overlaid text */
  textInset?: [number, number, number, number];
  defaultTextStyle?: StickerTextStyle;
}

export interface RevisionArchiveStickerItem {
  id: string;
  annId: string;
  stickerId: string;
  draftText: string;
  snippet: string;
  savedAt: number;
  textOverlay?: StickerTextStyle;
}

export interface StickerFontPresetDef {
  id: StickerFontPreset;
  label: string;
  labelEn: string;
  stack: string;
}

export const STICKER_FONT_PRESETS: StickerFontPresetDef[] = [
  {
    id: 'default',
    label: '系统黑体',
    labelEn: 'Sans',
    stack: `'Inter', 'PingFang SC', 'Microsoft YaHei UI', system-ui, sans-serif`,
  },
  {
    id: 'serif',
    label: '优雅宋体',
    labelEn: 'Serif',
    stack: `'Source Han Serif SC', 'Noto Serif SC', 'Songti SC', 'SimSun', Georgia, serif`,
  },
  {
    id: 'kaiti',
    label: '手写楷体',
    labelEn: 'KaiTi',
    stack: `'LXGW WenKai', '霞鹜文楷', 'Kaiti SC', 'KaiTi', 'STKaiti', serif`,
  },
  {
    id: 'fangsong',
    label: '复古仿宋',
    labelEn: 'FangSong',
    stack: `'FangSong', 'STFangsong', 'Noto Serif SC', Georgia, serif`,
  },
  {
    id: 'rounded',
    label: '可爱圆体',
    labelEn: 'Rounded',
    stack: `'SF Pro Rounded', 'Nunito', 'YouYuan', 'Microsoft YaHei UI', sans-serif`,
  },
  {
    id: 'mono',
    label: '打字机',
    labelEn: 'Typewriter',
    stack: `'JetBrains Mono', 'Cascadia Code', 'Courier New', Consolas, monospace`,
  },
  {
    id: 'cursive',
    label: '花体手帐',
    labelEn: 'Script',
    stack: `'Segoe Script', 'Bradley Hand', 'Apple Chancery', 'KaiTi', cursive`,
  },
  {
    id: 'custom',
    label: '自定义字体',
    labelEn: 'Custom',
    stack: `'Inter', 'PingFang SC', 'Microsoft YaHei UI', sans-serif`,
  },
];

export const STICKER_TEXT_COLOR_PRESETS = [
  '#2c2623',
  '#4a3728',
  '#1e3a5f',
  '#7f1d1d',
  '#14532d',
  '#581c87',
  '#f8fafc',
  '#fef3c7',
];

export const STICKER_STROKE_COLOR_PRESETS = [
  '#ffffff',
  '#fefce8',
  '#1e293b',
  '#0f172a',
  '#7f1d1d',
  '#1e3a5f',
];

function sanitizeStickerFontName(name?: string): string {
  const cleaned = (name ?? '').trim().replace(/[;{}"]/g, '');
  if (!cleaned) return '';
  if (cleaned.includes(',')) return cleaned;
  return `'${cleaned}'`;
}

export function resolveStickerFontStack(
  style: Pick<StickerTextStyle, 'fontFamily' | 'customFontName'>,
): string {
  const defaultStack = STICKER_FONT_PRESETS[0].stack;
  if (style.fontFamily === 'custom') {
    const custom = sanitizeStickerFontName(style.customFontName);
    return custom ? `${custom}, ${defaultStack}` : defaultStack;
  }
  const found = STICKER_FONT_PRESETS.find((p) => p.id === style.fontFamily);
  return found ? found.stack : defaultStack;
}

function journalPngUrl(num: number): string {
  const base =
    (typeof import.meta !== 'undefined' &&
      (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL) ||
    '/';
  const normalized = base.endsWith('/') ? base : `${base}/`;
  return `${normalized}stickers/journal/journal-${String(num).padStart(2, '0')}.png`;
}

export const DEFAULT_REVISION_STICKERS: RevisionStickerDef[] = [
  { id: 'stk-star', label: '核心论点', emoji: '⭐', color: '#f59e0b', category: 'basic' },
  { id: 'stk-check', label: '待核实', emoji: '🔍', color: '#3b82f6', category: 'basic' },
  { id: 'stk-spark', label: '润色灵感', emoji: '✨', color: '#8b5cf6', category: 'basic' },
  { id: 'stk-alert', label: '数据存疑', emoji: '📌', color: '#ef4444', category: 'basic' },
  { id: 'stk-done', label: '已定稿', emoji: '🌿', color: '#10b981', category: 'basic' },
  { id: 'stk-kraft', label: '牛皮手帐', emoji: '🏷️', color: '#b45309', category: 'basic' },
  { id: 'stk-washi-sakura', label: '樱花胶带', emoji: '🌸', color: '#ec4899', category: 'basic' },
  { id: 'stk-washi-grid', label: '格纹纸条', emoji: '📎', color: '#0d9488', category: 'basic' },
  { id: 'stk-wax', label: '火漆印章', emoji: '🕯️', color: '#b91c1c', category: 'basic' },
  { id: 'stk-stamp', label: '复古邮票', emoji: '📮', color: '#6366f1', category: 'basic' },
];

interface JournalStickerSpec {
  num: number;
  label: string;
  labelEn: string;
  color: string;
  textColor?: string;
  strokeColor?: string;
  textInset?: [number, number, number, number];
}

const JOURNAL_SPECS: JournalStickerSpec[] = [
  { num: 1, label: '绳结米白吊牌', labelEn: 'Twine Cream Tag', color: '#d6cfc2', textColor: '#3a332c', textInset: [16, 8, 16, 28] },
  { num: 2, label: '淡紫锯齿票券', labelEn: 'Lilac Ticket', color: '#b8a3d1', textColor: '#36274a', textInset: [16, 22, 16, 12] },
  { num: 3, label: '黑底条码票签', labelEn: 'Black Barcode Tag', color: '#27272a', textColor: '#f8fafc', strokeColor: '#09090b', textInset: [16, 24, 16, 12] },
  { num: 4, label: '灰绿胶囊长条', labelEn: 'Sage Pill Label', color: '#9ab0a1', textColor: '#24352a', textInset: [16, 18, 16, 18] },
  { num: 5, label: '米白波浪异形条', labelEn: 'Wavy Cream Strip', color: '#d8d4ce', textColor: '#33312e', textInset: [20, 16, 20, 16] },
  { num: 6, label: '光影米白票券', labelEn: 'Shadow Cream Ticket', color: '#d1ccc4', textColor: '#34302b', textInset: [14, 22, 14, 12] },
  { num: 7, label: '云朵撕边长条', labelEn: 'Cloud Torn Strip', color: '#8fa0b0', textColor: '#1e293b', textInset: [16, 10, 16, 44] },
  { num: 8, label: '黑底挂绳细条', labelEn: 'Black Cord Tag', color: '#1f2937', textColor: '#f8fafc', strokeColor: '#0f172a', textInset: [10, 22, 44, 10] },
  { num: 9, label: '米白条码票签', labelEn: 'Cream Barcode Ticket', color: '#d9d2c5', textColor: '#332d26', textInset: [14, 10, 14, 26] },
  { num: 10, label: '复古邮戳信笺条', labelEn: 'Vintage Postal Card', color: '#6b8299', textColor: '#253240', textInset: [24, 14, 16, 12] },
  { num: 11, label: '复古粉雕花长条', labelEn: 'Vintage Rose Strip', color: '#c98e89', textColor: '#4a2320', textInset: [18, 16, 18, 16] },
  { num: 12, label: '雾蓝鸢尾长条', labelEn: 'Misty Blue Iris', color: '#8ea6b8', textColor: '#213442', textInset: [18, 16, 18, 16] },
  { num: 13, label: '复古黄包裹票券', labelEn: 'Parcel Cream Ticket', color: '#d9be82', textColor: '#453414', textInset: [22, 22, 14, 12] },
  { num: 14, label: '灰绿复古细胶囊', labelEn: 'Vintage Sage Pill', color: '#9ca894', textColor: '#293324', textInset: [18, 18, 18, 18] },
  { num: 15, label: '砖红燕尾丝带条', labelEn: 'Terracotta Ribbon', color: '#be8376', textColor: '#3f1e18', textInset: [18, 22, 18, 22] },
  { num: 16, label: '雾蓝切角长条', labelEn: 'Slate Chamfer Tag', color: '#849ca6', textColor: '#1f3038', textInset: [16, 14, 16, 14] },
  { num: 17, label: '米白红框邮波条', labelEn: 'Crimson Wave Frame', color: '#b87676', textColor: '#3f2222', textInset: [18, 16, 18, 16] },
  { num: 18, label: '蜜桃虚线胶囊条', labelEn: 'Peach Stitch Pill', color: '#d9a491', textColor: '#4a291e', textInset: [18, 18, 18, 18] },
  { num: 19, label: '米白双线长条', labelEn: 'Double-Line Cream', color: '#d6cfc4', textColor: '#2e2923', textInset: [16, 12, 16, 12] },
  { num: 20, label: '樱粉细长雕花条', labelEn: 'Sakura Ornate Bar', color: '#cfa0ae', textColor: '#47222d', textInset: [18, 16, 18, 16] },
  { num: 21, label: '奶茶内切角长条', labelEn: 'Milk Tea Bracket', color: '#c9b79c', textColor: '#3d301e', textInset: [18, 16, 18, 16] },
  { num: 22, label: '米白电影票券', labelEn: 'Cream Cinema Ticket', color: '#d8d0c1', textColor: '#332d22', textInset: [16, 18, 16, 18] },
  { num: 23, label: '酒红雕花票签', labelEn: 'Burgundy Ornate Tag', color: '#8a3c48', textColor: '#fdf2f4', strokeColor: '#45121b', textInset: [18, 16, 18, 16] },
  { num: 24, label: '抹茶双联票券', labelEn: 'Matcha Stub Ticket', color: '#9ca691', textColor: '#252e1e', textInset: [16, 26, 16, 12] },
  { num: 25, label: '米白齿边徽章票', labelEn: 'Stamp Edge Ticket', color: '#d4c8b4', textColor: '#382e1e', textInset: [16, 14, 16, 18] },
  { num: 26, label: '灰蓝切角标签', labelEn: 'Steel Blue Frame', color: '#8e9ca8', textColor: '#1f2933', textInset: [16, 14, 16, 14] },
  { num: 27, label: '米白花角标签', labelEn: 'Floral Corner Tag', color: '#d6ccb8', textColor: '#362d1e', textInset: [18, 14, 18, 14] },
  { num: 28, label: '浅绿花卉标签', labelEn: 'Botanical Sage Tag', color: '#a5b09c', textColor: '#263020', textInset: [16, 12, 16, 22] },
  { num: 29, label: '牛皮焦糖花框条', labelEn: 'Caramel Kraft Tag', color: '#a67c52', textColor: '#fffbeb', strokeColor: '#45270e', textInset: [16, 14, 16, 14] },
  { num: 30, label: '极简米灰细线条', labelEn: 'Minimal Greige Strip', color: '#c9c6c0', textColor: '#2e2c29', textInset: [16, 12, 16, 12] },
  { num: 31, label: '蓝边水波纹长条', labelEn: 'Blue Wave Label', color: '#6b88a8', textColor: '#1e324a', textInset: [18, 14, 18, 14] },
  { num: 32, label: '粉红爱心细长条', labelEn: 'Blush Heart Bar', color: '#d6a3a6', textColor: '#4a2124', textInset: [18, 22, 18, 12] },
  { num: 33, label: '淡紫便签横条', labelEn: 'Lavender Ruled Strip', color: '#b9acc7', textColor: '#31263d', textInset: [16, 24, 16, 12] },
  { num: 34, label: '淡紫胶囊长条', labelEn: 'Lavender Pill Strip', color: '#c4b8cc', textColor: '#352a3d', textInset: [18, 18, 18, 18] },
  { num: 35, label: '雾蓝方点长条', labelEn: 'Powder Blue Dots', color: '#a3b5c4', textColor: '#1f3140', textInset: [18, 16, 18, 16] },
  { num: 36, label: '米白蓝框细条', labelEn: 'Blue-Trimmed Strip', color: '#7a95b0', textColor: '#1e3247', textInset: [18, 20, 18, 12] },
  { num: 37, label: '雾蓝双边水波条', labelEn: 'Sky Border Wave', color: '#9ab0c4', textColor: '#1e3245', textInset: [18, 14, 18, 14] },
  { num: 38, label: '蜜桃锯齿票券', labelEn: 'Peach Ticket Stub', color: '#d4a39e', textColor: '#45221e', textInset: [16, 18, 16, 18] },
  { num: 39, label: '浅蓝虚线胶囊条', labelEn: 'Ice Blue Stitch Pill', color: '#b2c0c9', textColor: '#22313b', textInset: [18, 18, 18, 18] },
  { num: 40, label: '粉红叠层长条', labelEn: 'Layered Rose Ticket', color: '#c98c96', textColor: '#421e25', textInset: [18, 18, 18, 16] },
];

export const JOURNAL_STRIP_STICKERS: RevisionStickerDef[] = JOURNAL_SPECS.map((spec) => ({
  id: `stk-journal-${String(spec.num).padStart(2, '0')}`,
  label: spec.label,
  labelEn: spec.labelEn,
  color: spec.color,
  category: 'journal',
  pngUrl: journalPngUrl(spec.num),
  isStripImage: true,
  defaultTextColor: spec.textColor ?? '#2c2623',
  defaultStrokeColor: spec.strokeColor ?? '#ffffff',
  textInset: spec.textInset ?? [16, 14, 16, 14],
}));

export function getStickerCategory(sticker: RevisionStickerDef): StickerCategory {
  if (sticker.category) return sticker.category;
  if (sticker.isCustom) return 'custom';
  if (sticker.id.startsWith('stk-journal-')) return 'journal';
  return 'basic';
}

export function resolveStickerImageUrl(sticker?: RevisionStickerDef | null): string | undefined {
  if (!sticker) return undefined;
  return sticker.pngDataUrl || sticker.pngUrl;
}

export function isStripImageSticker(sticker?: RevisionStickerDef | null): boolean {
  if (!sticker) return false;
  return Boolean(sticker.isStripImage || sticker.pngUrl || sticker.pngDataUrl);
}

export function createDefaultStickerTextStyle(
  sticker?: RevisionStickerDef | null,
  initialText = '',
): StickerTextStyle {
  if (sticker?.defaultTextStyle) {
    return {
      ...sticker.defaultTextStyle,
      text: initialText || sticker.defaultTextStyle.text,
    };
  }
  return {
    text: initialText,
    fontFamily: 'default',
    customFontName: '',
    fontSize: 12,
    bold: true,
    italic: false,
    underline: false,
    letterSpacing: 0.5,
    color: sticker?.defaultTextColor ?? '#2c2623',
    strokeEnabled: false,
    strokeColor: sticker?.defaultStrokeColor ?? '#ffffff',
    strokeWidth: 1.5,
    shadow: 'none',
  };
}

export function getEffectiveStickerTextStyle(
  sticker?: RevisionStickerDef | null,
  archiveItem?: Pick<RevisionArchiveStickerItem, 'textOverlay' | 'draftText'> | null,
): StickerTextStyle {
  if (archiveItem?.textOverlay) {
    return archiveItem.textOverlay;
  }
  if (sticker?.defaultTextStyle) {
    return sticker.defaultTextStyle;
  }
  return createDefaultStickerTextStyle(sticker, archiveItem?.draftText?.slice(0, 18) ?? '');
}

export const CUSTOM_STICKERS_STORAGE_KEY = 'arcvault_rev_custom_stickers_v1';

export function loadCustomStickers(): RevisionStickerDef[] {
  try {
    const raw = localStorage.getItem(CUSTOM_STICKERS_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as RevisionStickerDef[]) : [];
  } catch {
    return [];
  }
}

export function saveCustomStickers(stickers: RevisionStickerDef[]): void {
  try {
    localStorage.setItem(CUSTOM_STICKERS_STORAGE_KEY, JSON.stringify(stickers));
  } catch {
    // ignore quota errors
  }
}

export function loadDocArchiveStickers(docId: string): RevisionArchiveStickerItem[] {
  try {
    const raw = localStorage.getItem(`arcvault_rev_archive_stickers_v1_${docId}`);
    return raw ? (JSON.parse(raw) as RevisionArchiveStickerItem[]) : [];
  } catch {
    return [];
  }
}

export function saveDocArchiveStickers(
  docId: string,
  items: RevisionArchiveStickerItem[],
): void {
  try {
    localStorage.setItem(`arcvault_rev_archive_stickers_v1_${docId}`, JSON.stringify(items));
  } catch {
    // ignore quota errors
  }
}
