import type {
  PhrasebankActivationScope,
  PhrasebankCapsuleIconId,
  PhrasebankSettings,
} from '../types/archive';
import {
  ALL_CAPSULE_ICONS,
  COMPACT_CAPSULE_ICONS,
  DEFAULT_PHRASEBANK_SETTINGS,
  normalizePhrasebankSettings,
} from './phrasebank/phrasebankStorage';

export const WORKSPACE_LAYOUT_STORAGE_KEY = 'arcvault_workspace_layout_v1';
export const LAYOUT_PRESETS_STORAGE_KEY = 'arcvault_layout_presets_v1';

export interface DocumentScrollState {
  editorScrollTop: number;
  previewScrollTop: number;
  annotationScrollTop: number;
  updatedAt: number;
}

export interface WorkspaceCapsuleLayout {
  enabled: boolean;
  dismissed: boolean;
  collapsed: boolean;
  scope: PhrasebankActivationScope;
  visibleIcons: PhrasebankCapsuleIconId[];
  position: { x: number; y: number } | null;
}

export interface WorkspaceLayoutConfig {
  leftSidebarCollapsed: boolean;
  rightSidebarCollapsed: boolean;
  splitPreview: boolean;
  timelineCollapsed: boolean;
  leftSidebarWidth: number;
  previewWidth: number;
  annotationWidth: number;
  timelineHeight: number;
  capsule: WorkspaceCapsuleLayout;
}

export interface PersistedWorkspaceLayout {
  leftSidebarCollapsed: boolean;
  rightSidebarCollapsed: boolean;
  splitPreview: boolean;
  timelineCollapsed: boolean;
  leftSidebarWidth: number;
  previewWidth: number;
  annotationWidth: number;
  timelineHeight: number;
  activeSpaceId: string;
  activeDocId: string | null;
  scrollPositions: Record<string, DocumentScrollState>;
}

export interface WorkspaceLayoutPreset {
  id: string;
  name: string;
  description?: string;
  builtin: boolean;
  createdAt: string;
  layout: WorkspaceLayoutConfig;
}

function clampNumber(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.round(Math.max(min, Math.min(max, value)));
}

function clampScrollTop(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.round(value));
}

export function cloneCapsuleLayout(capsule: WorkspaceCapsuleLayout): WorkspaceCapsuleLayout {
  const norm = normalizePhrasebankSettings(capsule);
  return {
    enabled: norm.enabled,
    dismissed: Boolean(norm.dismissed),
    collapsed: norm.collapsed,
    scope: norm.scope,
    visibleIcons: [...norm.visibleIcons],
    position: norm.position ? { x: Math.round(norm.position.x), y: Math.round(norm.position.y) } : null,
  };
}

export function cloneLayoutConfig(layout: WorkspaceLayoutConfig): WorkspaceLayoutConfig {
  return {
    leftSidebarCollapsed: Boolean(layout.leftSidebarCollapsed),
    rightSidebarCollapsed: Boolean(layout.rightSidebarCollapsed),
    splitPreview: Boolean(layout.splitPreview),
    timelineCollapsed: Boolean(layout.timelineCollapsed),
    leftSidebarWidth: clampNumber(layout.leftSidebarWidth, 264, 180, 440),
    previewWidth: clampNumber(layout.previewWidth, 360, 220, 680),
    annotationWidth: clampNumber(layout.annotationWidth, 340, 230, 580),
    timelineHeight: clampNumber(layout.timelineHeight, 224, 145, 420),
    capsule: cloneCapsuleLayout(layout.capsule),
  };
}

export function capsuleLayoutFromSettings(pb?: PhrasebankSettings): WorkspaceCapsuleLayout {
  const norm = normalizePhrasebankSettings(pb);
  return {
    enabled: norm.enabled,
    dismissed: Boolean(norm.dismissed),
    collapsed: norm.collapsed,
    scope: norm.scope,
    visibleIcons: [...norm.visibleIcons],
    position: norm.position ? { ...norm.position } : null,
  };
}

export const DEFAULT_LAYOUT_CONFIG: WorkspaceLayoutConfig = {
  leftSidebarCollapsed: false,
  rightSidebarCollapsed: false,
  splitPreview: true,
  timelineCollapsed: false,
  leftSidebarWidth: 264,
  previewWidth: 360,
  annotationWidth: 340,
  timelineHeight: 224,
  capsule: {
    enabled: DEFAULT_PHRASEBANK_SETTINGS.enabled,
    dismissed: Boolean(DEFAULT_PHRASEBANK_SETTINGS.dismissed),
    collapsed: DEFAULT_PHRASEBANK_SETTINGS.collapsed,
    scope: DEFAULT_PHRASEBANK_SETTINGS.scope,
    visibleIcons: [...ALL_CAPSULE_ICONS],
    position: null,
  },
};

export const DEFAULT_WORKSPACE_LAYOUT: PersistedWorkspaceLayout = {
  leftSidebarCollapsed: false,
  rightSidebarCollapsed: false,
  splitPreview: true,
  timelineCollapsed: false,
  leftSidebarWidth: 264,
  previewWidth: 360,
  annotationWidth: 340,
  timelineHeight: 224,
  activeSpaceId: 'sp_paper',
  activeDocId: null,
  scrollPositions: {},
};

export const BUILTIN_LAYOUT_PRESETS: WorkspaceLayoutPreset[] = [
  {
    id: 'preset_standard',
    name: '标准学术工作台',
    description: '四栏全开 + 学术句库胶囊完整展开',
    builtin: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    layout: cloneLayoutConfig(DEFAULT_LAYOUT_CONFIG),
  },
  {
    id: 'preset_focus_paper',
    name: '专注论文写作',
    description: '收起左栏/时间轴与双栏预览，保留批注栏与完整写作胶囊',
    builtin: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    layout: {
      leftSidebarCollapsed: true,
      rightSidebarCollapsed: false,
      splitPreview: false,
      timelineCollapsed: true,
      leftSidebarWidth: 264,
      previewWidth: 360,
      annotationWidth: 320,
      timelineHeight: 224,
      capsule: {
        enabled: true,
        dismissed: false,
        collapsed: false,
        scope: 'paper-only',
        visibleIcons: [...ALL_CAPSULE_ICONS],
        position: null,
      },
    },
  },
  {
    id: 'preset_review_compare',
    name: '双栏审阅对照',
    description: '展开预览与批注栏进行精细校对，胶囊保持精简迷你形态',
    builtin: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    layout: {
      leftSidebarCollapsed: true,
      rightSidebarCollapsed: false,
      splitPreview: true,
      timelineCollapsed: false,
      leftSidebarWidth: 264,
      previewWidth: 420,
      annotationWidth: 380,
      timelineHeight: 190,
      capsule: {
        enabled: true,
        dismissed: false,
        collapsed: true,
        scope: 'paper-only',
        visibleIcons: [...COMPACT_CAPSULE_ICONS],
        position: null,
      },
    },
  },
];

export function normalizePersistedLayout(
  raw?: Partial<PersistedWorkspaceLayout> | null,
): PersistedWorkspaceLayout {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_WORKSPACE_LAYOUT, scrollPositions: {} };
  }

  const scrollPositions: Record<string, DocumentScrollState> = {};
  if (raw.scrollPositions && typeof raw.scrollPositions === 'object') {
    for (const [docId, entry] of Object.entries(raw.scrollPositions)) {
      if (!docId || !entry || typeof entry !== 'object') continue;
      scrollPositions[docId] = {
        editorScrollTop: clampScrollTop(entry.editorScrollTop),
        previewScrollTop: clampScrollTop(entry.previewScrollTop),
        annotationScrollTop: clampScrollTop(entry.annotationScrollTop),
        updatedAt:
          typeof entry.updatedAt === 'number' && Number.isFinite(entry.updatedAt)
            ? entry.updatedAt
            : 0,
      };
    }
  }

  return {
    leftSidebarCollapsed: Boolean(raw.leftSidebarCollapsed),
    rightSidebarCollapsed: Boolean(raw.rightSidebarCollapsed),
    splitPreview: raw.splitPreview ?? DEFAULT_WORKSPACE_LAYOUT.splitPreview,
    timelineCollapsed: Boolean(raw.timelineCollapsed),
    leftSidebarWidth: clampNumber(raw.leftSidebarWidth, 264, 180, 440),
    previewWidth: clampNumber(raw.previewWidth, 360, 220, 680),
    annotationWidth: clampNumber(raw.annotationWidth, 340, 230, 580),
    timelineHeight: clampNumber(raw.timelineHeight, 224, 145, 420),
    activeSpaceId:
      typeof raw.activeSpaceId === 'string' && raw.activeSpaceId
        ? raw.activeSpaceId
        : DEFAULT_WORKSPACE_LAYOUT.activeSpaceId,
    activeDocId: typeof raw.activeDocId === 'string' && raw.activeDocId ? raw.activeDocId : null,
    scrollPositions,
  };
}

export function loadPersistedLayout(): PersistedWorkspaceLayout {
  try {
    const raw = localStorage.getItem(WORKSPACE_LAYOUT_STORAGE_KEY);
    if (!raw) return normalizePersistedLayout(null);
    return normalizePersistedLayout(JSON.parse(raw) as Partial<PersistedWorkspaceLayout>);
  } catch {
    return normalizePersistedLayout(null);
  }
}

export function savePersistedLayout(state: PersistedWorkspaceLayout): void {
  try {
    localStorage.setItem(WORKSPACE_LAYOUT_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore storage quota errors
  }
}

export function loadCustomLayoutPresets(): WorkspaceLayoutPreset[] {
  try {
    const raw = localStorage.getItem(LAYOUT_PRESETS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Array<Partial<WorkspaceLayoutPreset>>;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (p): p is WorkspaceLayoutPreset =>
          Boolean(p && typeof p.id === 'string' && typeof p.name === 'string' && p.layout),
      )
      .map((p) => ({
        id: p.id,
        name: p.name.trim() || '未命名预设',
        description: p.description,
        builtin: false,
        createdAt: typeof p.createdAt === 'string' ? p.createdAt : new Date().toISOString(),
        layout: cloneLayoutConfig(p.layout),
      }));
  } catch {
    return [];
  }
}

export function saveCustomLayoutPresets(presets: WorkspaceLayoutPreset[]): void {
  try {
    const customOnly = presets.filter((p) => !p.builtin);
    localStorage.setItem(LAYOUT_PRESETS_STORAGE_KEY, JSON.stringify(customOnly));
  } catch {
    // ignore storage quota errors
  }
}

export function getAllLayoutPresets(
  customPresets: WorkspaceLayoutPreset[],
): WorkspaceLayoutPreset[] {
  return [...BUILTIN_LAYOUT_PRESETS, ...customPresets.filter((p) => !p.builtin)];
}

export function createCustomLayoutPreset(
  name: string,
  layout: WorkspaceLayoutConfig,
  existing: WorkspaceLayoutPreset[],
): { preset: WorkspaceLayoutPreset; list: WorkspaceLayoutPreset[] } {
  const cleanName = name.trim() || `自定义预设 ${existing.filter((p) => !p.builtin).length + 1}`;
  const preset: WorkspaceLayoutPreset = {
    id: `preset_custom_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name: cleanName,
    builtin: false,
    createdAt: new Date().toISOString(),
    layout: cloneLayoutConfig(layout),
  };
  return {
    preset,
    list: [...existing.filter((p) => !p.builtin), preset],
  };
}

export function updateCustomLayoutPreset(
  presetId: string,
  layout: WorkspaceLayoutConfig,
  existing: WorkspaceLayoutPreset[],
): WorkspaceLayoutPreset[] {
  const snapshot = cloneLayoutConfig(layout);
  return existing
    .filter((p) => !p.builtin)
    .map((p) => (p.id === presetId ? { ...p, layout: snapshot } : p));
}

export function deleteCustomLayoutPreset(
  presetId: string,
  existing: WorkspaceLayoutPreset[],
): WorkspaceLayoutPreset[] {
  return existing.filter((p) => !p.builtin && p.id !== presetId);
}

export function isLayoutMatchingPreset(
  current: WorkspaceLayoutConfig,
  preset: WorkspaceLayoutPreset,
): boolean {
  const a = cloneLayoutConfig(current);
  const b = cloneLayoutConfig(preset.layout);

  if (
    a.leftSidebarCollapsed !== b.leftSidebarCollapsed ||
    a.rightSidebarCollapsed !== b.rightSidebarCollapsed ||
    a.splitPreview !== b.splitPreview ||
    a.timelineCollapsed !== b.timelineCollapsed ||
    a.leftSidebarWidth !== b.leftSidebarWidth ||
    a.previewWidth !== b.previewWidth ||
    a.annotationWidth !== b.annotationWidth ||
    a.timelineHeight !== b.timelineHeight
  ) {
    return false;
  }

  if (
    a.capsule.enabled !== b.capsule.enabled ||
    a.capsule.dismissed !== b.capsule.dismissed ||
    a.capsule.collapsed !== b.capsule.collapsed ||
    a.capsule.scope !== b.capsule.scope ||
    a.capsule.visibleIcons.length !== b.capsule.visibleIcons.length ||
    a.capsule.visibleIcons.some((id, idx) => id !== b.capsule.visibleIcons[idx])
  ) {
    return false;
  }

  if (a.capsule.position === null && b.capsule.position === null) return true;
  if (!a.capsule.position || !b.capsule.position) return false;
  return (
    Math.abs(a.capsule.position.x - b.capsule.position.x) <= 2 &&
    Math.abs(a.capsule.position.y - b.capsule.position.y) <= 2
  );
}

export function summarizeLayoutBadges(layout: WorkspaceLayoutConfig): string[] {
  const badges: string[] = [
    layout.leftSidebarCollapsed ? '左栏收起' : `左栏 ${layout.leftSidebarWidth}px`,
    layout.splitPreview ? `预览 ${layout.previewWidth}px` : '预览关闭',
    layout.rightSidebarCollapsed ? '批注收起' : `批注 ${layout.annotationWidth}px`,
    layout.timelineCollapsed ? '时间轴收起' : `时间轴 ${layout.timelineHeight}px`,
  ];

  if (!layout.capsule.enabled) {
    badges.push('胶囊已禁用');
  } else if (layout.capsule.dismissed) {
    badges.push('胶囊已隐藏');
  } else if (layout.capsule.collapsed) {
    badges.push(`胶囊收起 (${layout.capsule.visibleIcons.length}图标)`);
  } else {
    badges.push(`胶囊展开 (${layout.capsule.visibleIcons.length}图标)`);
  }

  return badges;
}
