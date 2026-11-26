import { describe, expect, it } from 'vitest';
import {
  BUILTIN_LAYOUT_PRESETS,
  cloneLayoutConfig,
  createCustomLayoutPreset,
  DEFAULT_LAYOUT_CONFIG,
  deleteCustomLayoutPreset,
  isLayoutMatchingPreset,
  normalizePersistedLayout,
  summarizeLayoutBadges,
  updateCustomLayoutPreset,
} from '../workspaceLayout';

describe('workspaceLayout', () => {
  it('clamps out-of-range pane sizes and scroll offsets on normalize', () => {
    const normalized = normalizePersistedLayout({
      leftSidebarCollapsed: true,
      leftSidebarWidth: 50,
      previewWidth: 1200,
      annotationWidth: 999,
      timelineHeight: 20,
      activeSpaceId: 'sp_writing',
      activeDocId: 'doc_123',
      scrollPositions: {
        doc_123: {
          editorScrollTop: -40,
          previewScrollTop: 320.7,
          annotationScrollTop: 120,
          updatedAt: 1000,
        },
      },
    });

    expect(normalized.leftSidebarCollapsed).toBe(true);
    expect(normalized.leftSidebarWidth).toBe(180);
    expect(normalized.previewWidth).toBe(680);
    expect(normalized.annotationWidth).toBe(580);
    expect(normalized.timelineHeight).toBe(145);
    expect(normalized.activeSpaceId).toBe('sp_writing');
    expect(normalized.activeDocId).toBe('doc_123');
    expect(normalized.scrollPositions.doc_123.editorScrollTop).toBe(0);
    expect(normalized.scrollPositions.doc_123.previewScrollTop).toBe(321);
  });

  it('creates, updates, deletes, and matches custom presets without mutating builtins', () => {
    const base = cloneLayoutConfig(DEFAULT_LAYOUT_CONFIG);
    base.leftSidebarCollapsed = true;
    base.capsule.position = { x: 240, y: 420 };
    base.capsule.visibleIcons = ['smart', 'sections', 'reference'];

    const { preset, list } = createCustomLayoutPreset('我的论文布局', base, []);
    expect(preset.builtin).toBe(false);
    expect(list).toHaveLength(1);
    expect(isLayoutMatchingPreset(base, preset)).toBe(true);

    // Mutating original object after creation should not affect stored preset
    base.capsule.visibleIcons.push('skeleton');
    expect(preset.layout.capsule.visibleIcons).toHaveLength(3);
    expect(isLayoutMatchingPreset(base, preset)).toBe(false);

    // Updating preset
    const updatedList = updateCustomLayoutPreset(preset.id, base, list);
    expect(isLayoutMatchingPreset(base, updatedList[0])).toBe(true);

    // Builtins are ignored on delete/update
    const afterBuiltinDelete = deleteCustomLayoutPreset(BUILTIN_LAYOUT_PRESETS[0].id, updatedList);
    expect(afterBuiltinDelete).toHaveLength(1);

    const afterCustomDelete = deleteCustomLayoutPreset(preset.id, updatedList);
    expect(afterCustomDelete).toHaveLength(0);
  });

  it('produces readable summary badges for pane and capsule states', () => {
    const cfg = cloneLayoutConfig(DEFAULT_LAYOUT_CONFIG);
    cfg.timelineCollapsed = true;
    cfg.capsule.enabled = false;
    const badges = summarizeLayoutBadges(cfg);
    expect(badges).toContain('时间轴收起');
    expect(badges).toContain('胶囊已禁用');
  });
});
