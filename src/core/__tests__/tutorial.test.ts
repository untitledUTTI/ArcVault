import { describe, expect, it } from 'vitest';
import {
  MOBILE_PERMISSION_CARDS,
  TUTORIAL_CONFIRM_PHRASE,
  TUTORIAL_MODULES,
  TUTORIAL_WARNING_COUNTDOWN_SECONDS,
  TUTORIAL_WARNING_TEXT,
  areAllMobilePermissionsGranted,
  buildTutorialFlow,
  canConfirmWarning,
  canProceedFromCacheSetup,
  canUnlockWarningInput,
  computeGuideCardPlacement,
  formatActionGateButtonText,
  getInitialTutorialPhase,
  getStepAdvanceRelation,
  hasCompletedOnboarding,
  markOnboardingCompleted,
  shouldShowMobilePermissionsStep,
  type StorageLike,
} from '../tutorial';

function createMemoryStorage(): StorageLike {
  const map = new Map<string, string>();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value);
    },
  };
}

describe('Live In-App Spotlight Tutorial & First-Run Warning Gate', () => {
  it('starts first-run on the welcome phase before tutorial steps and replay on picker', () => {
    const storage = createMemoryStorage();
    expect(hasCompletedOnboarding(storage)).toBe(false);
    expect(getInitialTutorialPhase('first-run')).toBe('welcome');
    expect(getInitialTutorialPhase('replay')).toBe('picker');
    expect(hasCompletedOnboarding(storage)).toBe(false);
  });

  it('persists onboarding completion independently of version', () => {
    const storage = createMemoryStorage();
    expect(hasCompletedOnboarding(storage)).toBe(false);
    markOnboardingCompleted(storage);
    expect(hasCompletedOnboarding(storage)).toBe(true);
    expect(hasCompletedOnboarding(null)).toBe(false);
  });

  it('includes all 8 modules with live spotlight steps and action gates', () => {
    expect(TUTORIAL_MODULES.map((m) => m.id)).toEqual([
      'workspace',
      'word-annotations',
      'version-dome',
      'academic-ai',
      'sync-security',
      'themes-multidevice',
      'format-matrix',
      'limitations',
    ]);

    for (const mod of TUTORIAL_MODULES) {
      expect(mod.title.trim().length).toBeGreaterThan(0);
      expect(mod.shortTitle.trim().length).toBeGreaterThan(0);
      expect(mod.summary.trim().length).toBeGreaterThan(0);
      expect(mod.points.length).toBeGreaterThanOrEqual(3);
      expect(mod.steps.length).toBeGreaterThanOrEqual(1);
      for (const st of mod.steps) {
        expect(st.id.trim().length).toBeGreaterThan(0);
        expect(st.title.trim().length).toBeGreaterThan(0);
        expect(st.description.trim().length).toBeGreaterThan(0);
        expect(st.scene.trim().length).toBeGreaterThan(0);
        if (st.actionGate) {
          expect(st.actionGate.triggerSelector.trim().length).toBeGreaterThan(0);
          expect(st.actionGate.buttonLabel.trim().length).toBeGreaterThan(0);
        }
      }
    }

    // Verify Workspace module includes permanent Trash spotlight & modal steps
    const wsMod = TUTORIAL_MODULES.find((m) => m.id === 'workspace')!;
    expect(wsMod.steps.map((s) => s.id)).toEqual([
      'ws-spaces',
      'ws-trash-btn',
      'ws-trash-modal',
      'ws-format',
    ]);
    expect(wsMod.summary).toContain('回收站');
    expect(wsMod.steps[1].targetSelectors).toContain('[data-tour="sidebar-trash-btn"]');
    expect(wsMod.steps[1].actionGate?.buttonLabel).toBe('回收站');
    expect(wsMod.steps[1].description).toContain('永久保留');
    expect(wsMod.steps[2].scene).toBe('trash-modal');
    expect(wsMod.steps[2].targetSelectors).toContain('[data-tour="trash-modal"]');
    expect(wsMod.steps[2].bullets?.join(' ')).toContain('永久保留');

    // Verify Word Cover Split 2-step flow matches the exact spotlight interaction template
    const wordMod = TUTORIAL_MODULES.find((m) => m.id === 'word-annotations')!;
    expect(wordMod.steps[0].scene).toBe('cover-split');
    expect(wordMod.steps[0].targetSelectors).toContain('[data-tour="cover-split-body"]');
    expect(wordMod.steps[0].actionGate).toBeUndefined();

    expect(wordMod.steps[1].scene).toBe('cover-split');
    expect(wordMod.steps[1].targetSelectors).toContain('[data-tour="cover-split-footer"]');
    expect(wordMod.steps[1].actionGate?.buttonLabel).toBe('确认切分并提取正文');
    expect(wordMod.steps[1].actionGate?.triggerSelector).toBe('[data-tour="cover-confirm-btn"]');
  });

  it('builds flattened first-run flow ending with cache-setup and mandatory warning step', () => {
    const totalModuleSteps = TUTORIAL_MODULES.reduce((acc, m) => acc + m.steps.length, 0);
    const flow = buildTutorialFlow('first-run');
    expect(flow.length).toBe(totalModuleSteps + 2);
    expect(flow[flow.length - 2]).toEqual({ kind: 'cache-setup' });
    expect(flow[flow.length - 1]).toEqual({ kind: 'warning' });
    expect(flow.slice(0, -2).every((s) => s.kind === 'step')).toBe(true);
  });

  it('builds replay flow with selected modules only and never shows cache-setup or warning', () => {
    const partial = buildTutorialFlow('replay', ['limitations', 'format-matrix']);
    expect(partial.length).toBe(2);
    expect(partial.every((s) => s.kind === 'step')).toBe(true);
    expect(
      partial.map((s) => (s.kind === 'step' ? s.module.id : '')),
    ).toEqual(['format-matrix', 'limitations']);

    const fullReplay = buildTutorialFlow('replay');
    const totalModuleSteps = TUTORIAL_MODULES.reduce((acc, m) => acc + m.steps.length, 0);
    expect(fullReplay.length).toBe(totalModuleSteps);
    expect(fullReplay.some((s) => s.kind === 'warning' || s.kind === 'cache-setup')).toBe(false);
  });

  it('formats action-gate disabled Next button copy accurately', () => {
    const flow = buildTutorialFlow('first-run');
    // Step 0 (ws-spaces) -> Step 1 (ws-trash-btn) is same module
    expect(getStepAdvanceRelation(flow, 0)).toBe('next-step');
    // Step 3 (ws-format) -> Step 4 (cover-pick-line) transitions to next module
    expect(getStepAdvanceRelation(flow, 3)).toBe('next-module');
    // Third-to-last step -> cache-setup; second-to-last -> warning
    expect(getStepAdvanceRelation(flow, flow.length - 3)).toBe('cache-setup');
    expect(getStepAdvanceRelation(flow, flow.length - 2)).toBe('warning');

    const replayFlow = buildTutorialFlow('replay', ['workspace']);
    expect(getStepAdvanceRelation(replayFlow, replayFlow.length - 1)).toBe('finish');

    expect(formatActionGateButtonText('确认切分并提取正文', 'next-step')).toBe(
      '点击「确认切分并提取正文」按钮进入下一步',
    );
    expect(formatActionGateButtonText('预览', 'next-module')).toBe(
      '点击「预览」按钮进入下一板块',
    );
    expect(formatActionGateButtonText('确认', 'cache-setup')).toBe(
      '点击「确认」按钮设置缓存目录',
    );
    expect(formatActionGateButtonText('确认', 'warning')).toBe(
      '点击「确认」按钮进入必读警告',
    );
    expect(formatActionGateButtonText('确认', 'finish')).toBe(
      '点击「确认」按钮完成教程',
    );
  });

  it('computes non-overlapping floating guide card placement over the mask', () => {
    const centered = computeGuideCardPlacement({
      containerWidth: 1200,
      containerHeight: 800,
      cutout: null,
      cardWidth: 380,
      cardHeight: 220,
    });
    expect(centered.placement).toBe('center');
    expect(centered.left).toBe(410);
    expect(centered.top).toBe(290);

    // Cutout at bottom (like CoverSplitModal footer) -> card should go above it
    const aboveFooter = computeGuideCardPlacement({
      containerWidth: 1200,
      containerHeight: 800,
      cutout: { top: 680, left: 260, width: 680, height: 64 },
      cardWidth: 390,
      cardHeight: 220,
      preferredPlacement: 'top',
    });
    expect(aboveFooter.placement).toBe('top');
    expect(aboveFooter.top + 220).toBeLessThanOrEqual(680);

    // Cutout on left (like Sidebar on desktop) -> card should go right of it
    const rightOfSidebar = computeGuideCardPlacement({
      containerWidth: 1280,
      containerHeight: 800,
      cutout: { top: 50, left: 0, width: 280, height: 750 },
      cardWidth: 390,
      cardHeight: 220,
      preferredPlacement: 'right',
    });
    expect(rightOfSidebar.placement).toBe('right');
    expect(rightOfSidebar.left).toBeGreaterThanOrEqual(280);

    // Compact mobile viewport keeps card clamped cleanly inside bounds
    const mobile = computeGuideCardPlacement({
      containerWidth: 390,
      containerHeight: 844,
      cutout: { top: 100, left: 10, width: 370, height: 320 },
      cardWidth: 350,
      cardHeight: 220,
      preferredPlacement: 'bottom',
    });
    expect(mobile.left).toBeGreaterThanOrEqual(10);
    expect(mobile.left + 350).toBeLessThanOrEqual(380);
    expect(mobile.top + 220).toBeLessThanOrEqual(832);

    // Forced bottom placement on phone places card at bottom even when modal cutout fills screen
    const forcedBottom = computeGuideCardPlacement({
      containerWidth: 390,
      containerHeight: 844,
      cutout: { top: 44, left: 8, width: 374, height: 760 },
      cardWidth: 350,
      cardHeight: 220,
      preferredPlacement: 'bottom',
      forcePlacement: 'bottom',
      margin: 10,
    });
    expect(forcedBottom.placement).toBe('bottom');
    expect(forcedBottom.top).toBe(844 - 220 - 10);
    expect(forcedBottom.left).toBe(20);

    // Bottom sheet cutout on compact phone constrains top-placed card maxHeight so it never overlaps the sheet
    const aboveBottomSheet = computeGuideCardPlacement({
      containerWidth: 390,
      containerHeight: 667,
      cutout: { top: 280, left: 0, width: 390, height: 387 },
      cardWidth: 350,
      cardHeight: 320,
      preferredPlacement: 'left',
      margin: 10,
      gap: 12,
    });
    expect(aboveBottomSheet.placement).toBe('top');
    expect(aboveBottomSheet.top).toBe(10);
    expect(aboveBottomSheet.maxHeight).toBe(280 - 10 - 12);

    // Re-measuring with the constrained height must keep maxHeight (prevents ResizeObserver feedback loop)
    const afterResizeMeasure = computeGuideCardPlacement({
      containerWidth: 390,
      containerHeight: 667,
      cutout: { top: 280, left: 0, width: 390, height: 387 },
      cardWidth: 350,
      cardHeight: aboveBottomSheet.maxHeight!,
      preferredPlacement: 'left',
      margin: 10,
      gap: 12,
    });
    expect(afterResizeMeasure.placement).toBe('top');
    expect(afterResizeMeasure.maxHeight).toBe(280 - 10 - 12);
    expect(afterResizeMeasure.top + afterResizeMeasure.maxHeight!).toBeLessThan(280);

    // Tablet portrait with safe-area top inset keeps card below status bar and above bottom sheet
    const tabletPortrait = computeGuideCardPlacement({
      containerWidth: 820,
      containerHeight: 1120,
      cutout: { top: 470, left: 30, width: 760, height: 650 },
      cardWidth: 360,
      cardHeight: 340,
      preferredPlacement: 'left',
      margin: 10,
      topMargin: 34,
      gap: 12,
    });
    expect(tabletPortrait.placement).toBe('top');
    expect(tabletPortrait.top).toBeGreaterThanOrEqual(34);
    expect(tabletPortrait.top + 340).toBeLessThanOrEqual(470 - 12);
  });

  it('marks designated modal/workspace steps to force bottom placement on phone', () => {
    const allSteps = TUTORIAL_MODULES.flatMap((m) => m.steps);
    const forcedIds = allSteps.filter((s) => s.phoneForceBottom).map((s) => s.id);
    expect(forcedIds).toEqual([
      'ai-paper-studio',
      'ai-context-assets',
      'ai-evolution',
      'sec-vault',
      'sec-sync',
      'settings-ai-device',
      'fmt-office-live',
    ]);
  });

  it('enforces 10-second reading countdown and exact confirmation phrase', () => {
    expect(TUTORIAL_WARNING_COUNTDOWN_SECONDS).toBe(10);
    expect(TUTORIAL_CONFIRM_PHRASE).toBe('我已了解');
    expect(TUTORIAL_WARNING_TEXT).toBe(
      '推荐使用付费模型如Claude Fable/Sonnet、GPT Astra/Sol、Gemini Carbon/Neon（国内顶尖模型也可）。注意合理消费，请勿通过第三方平台、二手平台进行充值，谨防受骗！不要过度依赖AI，理性辨别AI生成的内容，AI给出的建议可能不准确！',
    );

    for (let s = 10; s >= 1; s--) {
      expect(canUnlockWarningInput(s)).toBe(false);
      expect(canConfirmWarning(s, '我已了解')).toBe(false);
    }
    expect(canUnlockWarningInput(0)).toBe(true);
    expect(canConfirmWarning(0, '')).toBe(false);
    expect(canConfirmWarning(0, '已了解')).toBe(false);
    expect(canConfirmWarning(0, '  我已了解  ')).toBe(true);
  });

  it('enforces mandatory cache directory selection before warning step', () => {
    expect(canProceedFromCacheSetup(null, '')).toBe(false);
    expect(canProceedFromCacheSetup('custom', '   ')).toBe(false);
    expect(canProceedFromCacheSetup('custom', 'D:\\ArcVaultCache')).toBe(true);
    expect(canProceedFromCacheSetup('default', '')).toBe(true);
  });

  it('shows mobile permissions screen only on Android first-run and skips iOS/iPadOS/desktop', () => {
    expect(shouldShowMobilePermissionsStep('first-run', { os: 'android', isPhone: true, isTablet: false })).toBe(true);
    expect(shouldShowMobilePermissionsStep('first-run', { os: 'android', isPhone: false, isTablet: true })).toBe(true);
    expect(shouldShowMobilePermissionsStep('first-run', { os: 'ios', isPhone: true, isTablet: false })).toBe(false);
    expect(shouldShowMobilePermissionsStep('first-run', { os: 'ipados', isPhone: false, isTablet: true })).toBe(false);
    expect(shouldShowMobilePermissionsStep('first-run', { os: 'windows', isPhone: false, isTablet: false })).toBe(false);
    expect(shouldShowMobilePermissionsStep('replay', { os: 'android', isPhone: true, isTablet: false })).toBe(false);

    expect(areAllMobilePermissionsGranted([])).toBe(false);
    expect(areAllMobilePermissionsGranted(['storage', 'camera'])).toBe(false);
    expect(areAllMobilePermissionsGranted(MOBILE_PERMISSION_CARDS.map((c) => c.id))).toBe(true);
  });
});
