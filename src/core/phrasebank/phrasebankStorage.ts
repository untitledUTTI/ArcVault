import type { PhrasebankSettings } from '../../types/archive';
import { SKELETON_TEMPLATES } from './data';
import { DEFAULT_PLACEHOLDERS } from './placeholders';
import type { CapsuleIconId, PhrasebankUserState } from './types';

export const PHRASEBANK_USER_STORAGE_KEY = 'arcvault_phrasebank_user_v1';

export interface CapsuleIconMeta {
  id: CapsuleIconId;
  labelCn: string;
  labelEn: string;
  shortCn: string;
  shortEn: string;
  descCn: string;
  descEn: string;
  defaultVisible: boolean;
}

export const CAPSULE_ICON_META: CapsuleIconMeta[] = [
  {
    id: 'smart',
    labelCn: '智能识别与替换',
    labelEn: 'Smart Detection & Replace',
    shortCn: '智能替换',
    shortEn: 'Smart',
    descCn: '识别口语词、缩写、英美拼写、绝对化断言并推荐学术句型',
    descEn: 'Detect colloquialisms, contractions, US/UK spelling, absolutes & suggest academic phrases',
    defaultVisible: true,
  },
  {
    id: 'sections',
    labelCn: '论文章节导航',
    labelEn: 'Section Navigator',
    shortCn: '章节导航',
    shortEn: 'Sections',
    descCn: '自动识别摘要/引言/综述/方法/结果/讨论/结论并匹配对应句库',
    descEn: 'Auto-detect Abstract/Intro/Lit Review/Methods/Results/Discussion/Conclusion & match phrases',
    defaultVisible: true,
  },
  {
    id: 'context',
    labelCn: '上下文分析建议',
    labelEn: 'Context Analysis',
    shortCn: '语境建议',
    shortEn: 'Context',
    descCn: '结合所选段落与章节结构生成修改建议与可一键应用改写',
    descEn: 'Analyze selected paragraph & section structure for one-click academic rewrites',
    defaultVisible: true,
  },
  {
    id: 'lookup',
    labelCn: '句型与表达速查',
    labelEn: 'Phrase Lookup',
    shortCn: '句型速查',
    shortEn: 'Lookup',
    descCn: '中英双语意图检索书面论文句库、拼句器与汇报答辩句型',
    descEn: 'Search academic phrasebank, sentence builder & presentation expressions',
    defaultVisible: true,
  },
  {
    id: 'reference',
    labelCn: '写作规范与词表',
    labelEn: 'Style & Wordlists',
    shortCn: '规范词表',
    shortEn: 'Reference',
    descCn: '口语替换表、8项风格准则、连接词矩阵、易混词、Evidence搭配与学术动词',
    descEn: 'Colloquial replacements, 8 style rules, connectors, confusables & academic verbs',
    defaultVisible: true,
  },
  {
    id: 'favorites',
    labelCn: '收藏与私人句库',
    labelEn: 'Favorites & Custom Bank',
    shortCn: '收藏库',
    shortEn: 'Favorites',
    descCn: '管理收藏句型、置顶表达、自建句型、最近使用与JSON备份',
    descEn: 'Manage starred & pinned phrases, custom phrases, recents & JSON backup',
    defaultVisible: true,
  },
  {
    id: 'placeholders',
    labelCn: '占位符自动替换',
    labelEn: 'Placeholder Auto-Fill',
    shortCn: '占位符',
    shortEn: 'Slots',
    descCn: '批量替换句型中的 X/Y/Z 与 Smith (2020) / Jones (2019)',
    descEn: 'Batch-fill X/Y/Z and citation slots like Smith (2020) / Jones (2019)',
    defaultVisible: true,
  },
  {
    id: 'skeleton',
    labelCn: '写作骨架拼装台',
    labelEn: 'Draft Skeleton Builder',
    shortCn: '骨架台',
    shortEn: 'Skeleton',
    descCn: '按论文段落模板拼装句型草稿并一键插入正文',
    descEn: 'Assemble paragraph skeletons from templates and insert into manuscript',
    defaultVisible: true,
  },
];

export const ALL_CAPSULE_ICONS: CapsuleIconId[] = CAPSULE_ICON_META.map((m) => m.id);

export const COMPACT_CAPSULE_ICONS: CapsuleIconId[] = [
  'smart',
  'sections',
  'context',
  'lookup',
  'reference',
  'favorites',
];

export const DEFAULT_PHRASEBANK_SETTINGS: PhrasebankSettings = {
  enabled: true,
  dismissed: false,
  preferPhrasebankForAi: true,
  scope: 'paper-only',
  visibleIcons: [...ALL_CAPSULE_ICONS],
  collapsed: false,
  position: null,
};

export const DEFAULT_PHRASEBANK_USER_STATE: PhrasebankUserState = {
  favorites: [],
  pinnedFavorites: [],
  customPhrases: [],
  recentCopies: [],
  placeholders: { ...DEFAULT_PLACEHOLDERS },
  placeholdersEnabled: true,
  skeletonItems: [],
  activeTemplateId: SKELETON_TEMPLATES[0].id,
};

export function normalizePhrasebankSettings(
  raw?: Partial<PhrasebankSettings>,
): PhrasebankSettings {
  const validSet = new Set<CapsuleIconId>(ALL_CAPSULE_ICONS);
  const rawIcons = Array.isArray(raw?.visibleIcons)
    ? raw.visibleIcons.filter((id): id is CapsuleIconId => validSet.has(id as CapsuleIconId))
    : [];
  const visibleIcons = rawIcons.length > 0 ? Array.from(new Set(rawIcons)) : [...ALL_CAPSULE_ICONS];

  return {
    enabled: raw?.enabled ?? DEFAULT_PHRASEBANK_SETTINGS.enabled,
    dismissed: Boolean(raw?.dismissed),
    preferPhrasebankForAi: raw?.preferPhrasebankForAi ?? true,
    scope: raw?.scope === 'all-spaces' ? 'all-spaces' : 'paper-only',
    visibleIcons,
    collapsed: Boolean(raw?.collapsed),
    position:
      raw?.position &&
      typeof raw.position.x === 'number' &&
      typeof raw.position.y === 'number' &&
      Number.isFinite(raw.position.x) &&
      Number.isFinite(raw.position.y)
        ? { x: raw.position.x, y: raw.position.y }
        : null,
  };
}

export function loadPhrasebankUserState(): PhrasebankUserState {
  try {
    const raw = localStorage.getItem(PHRASEBANK_USER_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PHRASEBANK_USER_STATE };
    const parsed = JSON.parse(raw) as Partial<PhrasebankUserState>;
    return {
      favorites: Array.isArray(parsed.favorites) ? parsed.favorites : [],
      pinnedFavorites: Array.isArray(parsed.pinnedFavorites) ? parsed.pinnedFavorites : [],
      customPhrases: Array.isArray(parsed.customPhrases) ? parsed.customPhrases : [],
      recentCopies: Array.isArray(parsed.recentCopies) ? parsed.recentCopies : [],
      placeholders: {
        ...DEFAULT_PLACEHOLDERS,
        ...(parsed.placeholders ?? {}),
      },
      placeholdersEnabled: parsed.placeholdersEnabled ?? true,
      skeletonItems: Array.isArray(parsed.skeletonItems) ? parsed.skeletonItems : [],
      activeTemplateId:
        typeof parsed.activeTemplateId === 'string' && parsed.activeTemplateId
          ? parsed.activeTemplateId
          : SKELETON_TEMPLATES[0].id,
    };
  } catch {
    return { ...DEFAULT_PHRASEBANK_USER_STATE };
  }
}

export function savePhrasebankUserState(state: PhrasebankUserState): void {
  try {
    localStorage.setItem(PHRASEBANK_USER_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore storage quota errors
  }
}
