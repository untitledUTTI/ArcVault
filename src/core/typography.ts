import type { EditorFontPreset, TypographySettings, UiFontPreset } from '../types/archive';

export const DEFAULT_TYPOGRAPHY: TypographySettings = {
  uiFontPreset: 'system-sans',
  uiFontCustom: '',
  editorFontPreset: 'sans',
  editorFontCustom: '',
  editorFontSize: 14.5,
  editorLineHeight: 1.8,
};

const UI_PRESET_MAP: Record<Exclude<UiFontPreset, 'custom'>, string> = {
  'system-sans': `'Inter', 'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei UI', system-ui, -apple-system, sans-serif`,
  'noto-sans-sc': `'Noto Sans SC', 'Source Han Sans SC', 'PingFang SC', 'Microsoft YaHei UI', sans-serif`,
  pingfang: `'PingFang SC', 'Hiragino Sans GB', 'HarmonyOS Sans SC', 'Microsoft YaHei UI', sans-serif`,
  serif: `'Noto Serif SC', 'Source Han Serif SC', 'Songti SC', Georgia, serif`,
  rounded: `'SF Pro Rounded', 'Nunito', 'YouYuan', 'Microsoft YaHei UI', sans-serif`,
};

const EDITOR_PRESET_MAP: Record<Exclude<EditorFontPreset, 'custom'>, string> = {
  sans: `'Inter', 'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei UI', system-ui, sans-serif`,
  'noto-sans-sc': `'Noto Sans SC', 'Source Han Sans SC', 'PingFang SC', 'Microsoft YaHei UI', sans-serif`,
  'academic-serif': `'Noto Serif SC', 'Source Han Serif SC', 'Songti SC', 'SimSun', Georgia, serif`,
  wenkai: `'LXGW WenKai', '霞鹜文楷', 'LXGW WenKai TC', 'Kaiti SC', 'KaiTi', 'STKaiti', serif`,
  xiaowei: `'ZCOOL XiaoWei', 'Noto Serif SC', 'Songti SC', serif`,
  mono: `'JetBrains Mono', 'Cascadia Code', 'Fira Code', Consolas, 'Microsoft YaHei UI', monospace`,
};

function sanitizeFontName(name: string): string {
  const cleaned = name.trim().replace(/[;{}"]/g, '');
  if (!cleaned) return '';
  if (cleaned.includes(',')) return cleaned;
  return `'${cleaned}'`;
}

export function resolveUiFontStack(typo?: TypographySettings): string {
  const t = typo ?? DEFAULT_TYPOGRAPHY;
  if (t.uiFontPreset === 'custom') {
    const custom = sanitizeFontName(t.uiFontCustom);
    if (custom) return `${custom}, ${UI_PRESET_MAP['system-sans']}`;
  }
  const key = t.uiFontPreset === 'custom' ? 'system-sans' : t.uiFontPreset;
  return UI_PRESET_MAP[key];
}

export function resolveEditorFontStack(typo?: TypographySettings): string {
  const t = typo ?? DEFAULT_TYPOGRAPHY;
  if (t.editorFontPreset === 'custom') {
    const custom = sanitizeFontName(t.editorFontCustom);
    if (custom) return `${custom}, ${EDITOR_PRESET_MAP.sans}`;
  }
  const key = t.editorFontPreset === 'custom' ? 'sans' : t.editorFontPreset;
  return EDITOR_PRESET_MAP[key];
}
