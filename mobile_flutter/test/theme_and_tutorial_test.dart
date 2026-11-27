import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:arcvault_mobile/core/phrasebank_data.dart';
import 'package:arcvault_mobile/core/tutorial_flow.dart';
import 'package:arcvault_mobile/models/archive_models.dart';
import 'package:arcvault_mobile/theme/arc_theme.dart';

void main() {
  group('Mobile Themes & Live Spotlight Tutorial Flow', () {
    test('maps deprecated desktop/removed themes to light and keeps 4 mobile themes', () {
      expect(TutorialFlow.mobileWelcomeThemes.length, 4);
      expect(MobileThemeId.fromWire('celestial-optics'), MobileThemeId.light);
      expect(MobileThemeId.fromWire('weather-live'), MobileThemeId.light);
      expect(MobileThemeId.fromWire('liquid-glass'), MobileThemeId.light);
    });

    test('immersive status bar keeps bar visible (transparent bg, contrasting icons)', () {
      final lightTokens = ArcThemeTokens.fromSettings(
        const AppSettingsModel(theme: MobileThemeId.light),
      );
      expect(lightTokens.systemUiOverlayStyle.statusBarColor, Colors.transparent);
      expect(lightTokens.systemUiOverlayStyle.statusBarIconBrightness, Brightness.dark);

      final darkTokens = ArcThemeTokens.fromSettings(
        const AppSettingsModel(theme: MobileThemeId.dark),
      );
      expect(darkTokens.systemUiOverlayStyle.statusBarColor, Colors.transparent);
      expect(darkTokens.systemUiOverlayStyle.statusBarIconBrightness, Brightness.light);
    });

    test('initial phase and Android permissions gating align with desktop', () {
      expect(TutorialFlow.getInitialPhase(TutorialMode.firstRun), TutorialPhase.welcome);
      expect(TutorialFlow.getInitialPhase(TutorialMode.replay), TutorialPhase.picker);

      expect(
        TutorialFlow.shouldShowMobilePermissionsStep(
          mode: TutorialMode.firstRun,
          isAndroid: true,
        ),
        true,
      );
      expect(
        TutorialFlow.shouldShowMobilePermissionsStep(
          mode: TutorialMode.firstRun,
          isAndroid: false,
        ),
        false,
      );
      expect(
        TutorialFlow.shouldShowMobilePermissionsStep(
          mode: TutorialMode.replay,
          isAndroid: true,
        ),
        false,
      );
    });

    test('includes all 8 modules with Cover Split 2-step flow and Workspace Trash gates', () {
      expect(
        TutorialFlow.modules.map((m) => m.id).toList(),
        [
          TutorialModuleId.workspace,
          TutorialModuleId.wordAnnotations,
          TutorialModuleId.versionDome,
          TutorialModuleId.academicAi,
          TutorialModuleId.syncSecurity,
          TutorialModuleId.themesMultidevice,
          TutorialModuleId.formatMatrix,
          TutorialModuleId.limitations,
        ],
      );

      final wsMod = TutorialFlow.moduleById(TutorialModuleId.workspace);
      expect(
        wsMod.steps.map((s) => s.id).toList(),
        ['ws-spaces', 'ws-trash-btn', 'ws-trash-modal', 'ws-format'],
      );
      expect(wsMod.steps[1].actionGate?.actionId, TutorialActionId.openTrash);
      expect(wsMod.steps[1].actionGate?.buttonLabel, '回收站');
      expect(wsMod.steps[3].actionGate?.actionId, TutorialActionId.togglePreview);
      expect(wsMod.steps[3].actionGate?.buttonLabel, '预览');

      final wordMod = TutorialFlow.moduleById(TutorialModuleId.wordAnnotations);
      expect(wordMod.steps[0].id, 'cover-pick-line');
      expect(wordMod.steps[0].scene, TutorialSceneId.coverSplit);
      expect(wordMod.steps[0].targetIds, [TutorialTargetId.coverSplitBody]);
      expect(wordMod.steps[0].actionGate, isNull);

      expect(wordMod.steps[1].id, 'cover-footer-btns');
      expect(wordMod.steps[1].scene, TutorialSceneId.coverSplit);
      expect(wordMod.steps[1].targetIds, [TutorialTargetId.coverSplitFooter]);
      expect(wordMod.steps[1].actionGate?.actionId, TutorialActionId.coverConfirm);
      expect(wordMod.steps[1].actionGate?.buttonLabel, '确认切分并提取正文');
      expect(
        wordMod.steps[1].actionGate?.fallbackActionIds,
        containsAll([TutorialActionId.coverCancel, TutorialActionId.coverImportAll]),
      );
    });

    test('first-run flow ends with cache-setup and warning at the very end; replay excludes both', () {
      final totalSpotlight = TutorialFlow.modules.fold<int>(
        0,
        (acc, m) => acc + m.steps.length,
      );
      final firstRunFlow = TutorialFlow.buildFlow(TutorialMode.firstRun);
      expect(firstRunFlow.length, totalSpotlight + 2);
      expect(firstRunFlow[firstRunFlow.length - 2].kind, TutorialFlowStepKind.cacheSetup);
      expect(firstRunFlow[firstRunFlow.length - 1].kind, TutorialFlowStepKind.warning);

      final replayPartial = TutorialFlow.buildFlow(
        TutorialMode.replay,
        selectedModules: {TutorialModuleId.limitations, TutorialModuleId.formatMatrix},
      );
      expect(replayPartial.length, 2);
      expect(replayPartial.every((s) => s.kind == TutorialFlowStepKind.spotlight), true);
      expect(
        replayPartial.map((s) => s.module!.id).toList(),
        [TutorialModuleId.formatMatrix, TutorialModuleId.limitations],
      );
    });

    test('formats action-gate disabled Next button copy accurately', () {
      final flow = TutorialFlow.buildFlow(TutorialMode.firstRun);
      expect(TutorialFlow.getStepAdvanceRelation(flow, 0), TutorialAdvanceRelation.nextStep);
      expect(TutorialFlow.getStepAdvanceRelation(flow, 3), TutorialAdvanceRelation.nextModule);
      expect(
        TutorialFlow.getStepAdvanceRelation(flow, flow.length - 3),
        TutorialAdvanceRelation.cacheSetup,
      );
      expect(
        TutorialFlow.getStepAdvanceRelation(flow, flow.length - 2),
        TutorialAdvanceRelation.warning,
      );

      final replayFlow = TutorialFlow.buildFlow(
        TutorialMode.replay,
        selectedModules: {TutorialModuleId.workspace},
      );
      expect(
        TutorialFlow.getStepAdvanceRelation(replayFlow, replayFlow.length - 1),
        TutorialAdvanceRelation.finish,
      );

      expect(
        TutorialFlow.formatActionGateButtonText(
          '确认切分并提取正文',
          TutorialAdvanceRelation.nextStep,
        ),
        '点击「确认切分并提取正文」按钮进入下一步',
      );
      expect(
        TutorialFlow.formatActionGateButtonText('预览', TutorialAdvanceRelation.nextModule),
        '点击「预览」按钮进入下一板块',
      );
      expect(
        TutorialFlow.formatActionGateButtonText('确认', TutorialAdvanceRelation.cacheSetup),
        '点击「确认」按钮设置缓存目录',
      );
      expect(
        TutorialFlow.formatActionGateButtonText('确认', TutorialAdvanceRelation.warning),
        '点击「确认」按钮进入必读警告',
      );
      expect(
        TutorialFlow.formatActionGateButtonText('确认', TutorialAdvanceRelation.finish),
        '点击「确认」按钮完成教程',
      );
    });

    test('computes non-overlapping guide card placement over dark mask', () {
      final centered = TutorialFlow.computeGuideCardPlacement(
        containerWidth: 390,
        containerHeight: 844,
        cutout: null,
        cardWidth: 350,
        cardHeight: 220,
      );
      expect(centered.placement, GuideCardPlacementKind.center);
      expect(centered.left, 20);

      final aboveFooter = TutorialFlow.computeGuideCardPlacement(
        containerWidth: 390,
        containerHeight: 844,
        cutout: const SpotlightRect(top: 640, left: 10, width: 370, height: 100),
        cardWidth: 350,
        cardHeight: 220,
        preferredPlacement: SpotlightPlacement.top,
      );
      expect(aboveFooter.placement, GuideCardPlacementKind.top);
      expect(aboveFooter.top + 220, lessThanOrEqualTo(640));

      final forcedBottom = TutorialFlow.computeGuideCardPlacement(
        containerWidth: 390,
        containerHeight: 844,
        cutout: const SpotlightRect(top: 44, left: 8, width: 374, height: 740),
        cardWidth: 350,
        cardHeight: 220,
        forcePlacementBottom: true,
        margin: 10,
      );
      expect(forcedBottom.placement, GuideCardPlacementKind.bottom);
      expect(forcedBottom.top, 844 - 220 - 10);

      final aboveBottomSheet = TutorialFlow.computeGuideCardPlacement(
        containerWidth: 390,
        containerHeight: 667,
        cutout: const SpotlightRect(top: 280, left: 0, width: 390, height: 387),
        cardWidth: 350,
        cardHeight: 320,
        preferredPlacement: SpotlightPlacement.left,
        margin: 10,
        gap: 12,
      );
      expect(aboveBottomSheet.placement, GuideCardPlacementKind.top);
      expect(aboveBottomSheet.top, 10);
      expect(aboveBottomSheet.maxHeight, 280 - 10 - 12);
    });

    test('cache setup and first-run warning gate require explicit confirmation', () {
      expect(TutorialFlow.canProceedFromCacheSetup(choice: null, customPath: ''), false);
      expect(TutorialFlow.canProceedFromCacheSetup(choice: 'custom', customPath: '  '), false);
      expect(
        TutorialFlow.canProceedFromCacheSetup(choice: 'custom', customPath: '/sdcard/ArcVault'),
        true,
      );
      expect(TutorialFlow.canProceedFromCacheSetup(choice: 'default', customPath: ''), true);

      expect(TutorialFlow.canUnlockWarningInput(1), false);
      expect(TutorialFlow.canUnlockWarningInput(0), true);
      expect(TutorialFlow.canConfirmWarning(remainingSeconds: 5, input: '我已了解'), false);
      expect(TutorialFlow.canConfirmWarning(remainingSeconds: 0, input: '了解'), false);
      expect(TutorialFlow.canConfirmWarning(remainingSeconds: 0, input: '  我已了解  '), true);
    });

    test('quickBarWidthFraction clamps and round-trips through JSON', () {
      final s = const AppSettingsModel().copyWith(quickBarWidthFraction: 0.72);
      final rt = AppSettingsModel.fromJson(s.toJson());
      expect(rt.quickBarWidthFraction, closeTo(0.72, 0.001));

      final clampedLow = s.copyWith(quickBarWidthFraction: 0.1);
      expect(clampedLow.quickBarWidthFraction, 0.55);
      final clampedHigh = s.copyWith(quickBarWidthFraction: 1.5);
      expect(clampedHigh.quickBarWidthFraction, 1.0);
    });

    test('PhrasebankData & PhrasebankAnalyzer detect sections, issues, and placeholders', () {
      final sections = PhrasebankAnalyzer.detectPaperSections(
        '# Abstract\nText\n## Introduction\nWe don\'t use a lot of data.',
      );
      expect(sections.length, 2);
      expect(sections[0].mappedSectionId, 'writing-abstracts');
      expect(sections[1].mappedSectionId, 'introducing-work');

      final issues = PhrasebankAnalyzer.analyzeAcademicIssues("We don't use a lot of data.");
      expect(issues.any((i) => i.kind == 'contraction'), true);
      expect(issues.any((i) => i.kind == 'everyday'), true);

      const ph = PlaceholderValues(x: 'ArcVault', y: 'archiving', author: 'Zhang', year: '2025');
      expect(
        ph.apply('Smith (2020) showed X improves Y.'),
        'Zhang (2025) showed ArcVault improves archiving.',
      );
    });
  });
}
