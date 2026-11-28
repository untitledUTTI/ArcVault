import 'package:arcvault_mobile/core/command_history.dart';
import 'package:arcvault_mobile/core/review_stickers.dart';
import 'package:arcvault_mobile/main.dart';
import 'package:arcvault_mobile/models/archive_models.dart';
import 'package:arcvault_mobile/state/app_controller.dart';
import 'package:arcvault_mobile/widgets/review_split_workspace.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('Review Stickers & Paragraph Helpers', () {
    test('defines 40 unique journal strip stickers and 10 basic stickers', () {
      expect(kJournalStripStickers.length, 40);
      expect(kDefaultBasicStickers.length, 10);

      final ids = <String>{};
      for (final stk in kJournalStripStickers) {
        expect(ids.add(stk.id), true);
        expect(getStickerCategory(stk), StickerCategory.journal);
        expect(isStripImageSticker(stk), true);
        expect(
          stk.assetPath,
          matches(RegExp(r'^assets/stickers/journal/journal-\d{2}\.png$')),
        );
        expect(stk.textInset?.length, 4);
        expect(stk.label.isNotEmpty, true);
      }

      for (final stk in kDefaultBasicStickers) {
        expect(ids.add(stk.id), true);
        expect(getStickerCategory(stk), StickerCategory.basic);
        expect(isStripImageSticker(stk), false);
      }
    });

    test('resolves font presets, sanitizes custom font names, and creates contrast defaults', () {
      final serif = resolveStickerFont(
        const StickerTextStyle(fontFamily: StickerFontPreset.serif),
      );
      expect(serif.fontFamily, 'serif');

      final customSanitized = resolveStickerFont(
        const StickerTextStyle(
          fontFamily: StickerFontPreset.custom,
          customFontName: 'LXGW; color: red{}',
        ),
      );
      expect(customSanitized.fontFamily, 'LXGW color: red');

      final blackBarcode = kJournalStripStickers.firstWhere(
        (s) => s.id == 'stk-journal-03',
      );
      final creamTag = kJournalStripStickers.firstWhere(
        (s) => s.id == 'stk-journal-01',
      );
      final blackStyle = createDefaultStickerTextStyle(blackBarcode, '关键证据');
      final creamStyle = createDefaultStickerTextStyle(creamTag, '待补充');

      expect(blackStyle.color, '#f8fafc');
      expect(creamStyle.color, '#3a332c');
      expect(creamStyle.text, '待补充');
      expect(creamStyle.strokeEnabled, false);
    });

    test('round-trips custom stickers, archive stickers, and per-note drafts via SharedPreferences', () async {
      SharedPreferences.setMockInitialValues({});

      final custom = [
        const ReviewStickerDef(
          id: 'stk-custom-1',
          label: '我的手帐条',
          color: '#10b981',
          category: StickerCategory.custom,
          isCustom: true,
          isStripImage: true,
          assetPath: 'assets/stickers/journal/journal-04.png',
          defaultTextStyle: StickerTextStyle(
            text: '实验组核对',
            fontFamily: StickerFontPreset.kaiti,
            fontSize: 13,
            strokeEnabled: true,
            strokeColor: '#0f172a',
            strokeWidth: 2,
            shadow: StickerTextShadow.retro,
          ),
        ),
      ];
      await ReviewStickerStore.saveCustomStickers(custom);
      final loadedCustom = await ReviewStickerStore.loadCustomStickers();
      expect(loadedCustom.length, 1);
      expect(loadedCustom.first.defaultTextStyle?.text, '实验组核对');
      expect(getStickerCategory(loadedCustom.first), StickerCategory.custom);

      final archives = [
        const ReviewArchiveStickerItem(
          id: 'arc-1',
          annId: 'ann-1',
          stickerId: 'stk-journal-04',
          draftText: '旧版无样式归档',
          snippet: '摘要',
          savedAt: 1700000000000,
        ),
        const ReviewArchiveStickerItem(
          id: 'arc-2',
          annId: 'ann-2',
          stickerId: 'stk-journal-08',
          draftText: '新版带样式归档',
          snippet: '摘要2',
          savedAt: 1700000005000,
          textOverlay: StickerTextStyle(
            text: '关键回复',
            fontFamily: StickerFontPreset.mono,
            color: '#fef3c7',
            strokeEnabled: true,
            strokeWidth: 2.0,
          ),
        ),
      ];
      await ReviewStickerStore.saveDocArchiveStickers('doc-test', archives);
      final loadedArc = await ReviewStickerStore.loadDocArchiveStickers('doc-test');
      expect(loadedArc.length, 2);
      expect(loadedArc[0].textOverlay, isNull);
      expect(loadedArc[1].textOverlay?.fontFamily, StickerFontPreset.mono);

      final fallback = getEffectiveStickerTextStyle(
        kJournalStripStickers[3],
        loadedArc[0],
      );
      expect(fallback.text, '旧版无样式归档');

      await ReviewStickerStore.saveDocReviewDrafts('doc-test', {
        'ann-1': const ReviewDraftEntry(
          annId: 'ann-1',
          text: '待核实的数据草稿',
          updatedAt: 1700000010000,
        ),
      });
      final loadedDrafts = await ReviewStickerStore.loadDocReviewDrafts('doc-test');
      expect(loadedDrafts['ann-1']?.text, '待核实的数据草稿');
    });

    test('extractParagraphAtOffset and extractAnnotatedParagraphs isolate annotated paragraphs', () {
      const text = '第一段普通内容。\n\n第二段包含批注目标文本。\n\n第三段也是普通内容。';
      final targetIdx = text.indexOf('批注目标');
      final slice = extractParagraphAtOffset(text, targetIdx);
      expect(slice.text, '第二段包含批注目标文本。');

      final anns = [
        AnnotationItem(
          id: 'a1',
          type: AnnotationType.comment,
          author: '导师',
          date: '2026-11-28',
          commentText: '请补充来源',
          originalText: '批注目标',
          anchorStart: targetIdx,
          anchorEnd: targetIdx + 4,
          status: AnnotationStatus.open,
        ),
      ];
      final blocks = extractAnnotatedParagraphs(text, anns);
      expect(blocks.length, 1);
      expect(blocks.first.text, '第二段包含批注目标文本。');
      expect(blocks.first.annotations.first.id, 'a1');
    });
  });

  group('ReviewSplitWorkspace & Review Mode Back Flow', () {
    testWidgets('enters Review Board, archives draft on note switch, and handles Sticker Library',
        (tester) async {
      SharedPreferences.setMockInitialValues({});
      var selectedId = 'a1';
      final archived = <ReviewArchiveStickerItem>[];

      final anns = [
        const AnnotationItem(
          id: 'a1',
          type: AnnotationType.comment,
          author: '张教授',
          date: '2026-11-28',
          commentText: '建议补充对照组数据',
          originalText: '实验结果',
          anchorStart: 2,
          anchorEnd: 6,
          status: AnnotationStatus.open,
        ),
        const AnnotationItem(
          id: 'a2',
          type: AnnotationType.revision,
          revisionKind: RevisionKind.replace,
          author: '李审稿',
          date: '2026-11-28',
          originalText: '提升显著',
          suggestedText: '提升 12.4%',
          anchorStart: 10,
          anchorEnd: 14,
          status: AnnotationStatus.open,
        ),
      ];

      bool Function()? backFn;

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: StatefulBuilder(
              builder: (context, setState) {
                return ReviewSplitWorkspace(
                  docId: 'doc_1',
                  annotations: anns,
                  selectedId: selectedId,
                  documentText: '# 引言\n\n实验结果如下，提升显著。',
                  settings: const AppSettingsModel(),
                  effectiveAiPolicy: AiPrivacyPolicy.cloudOrLocal,
                  readOnly: false,
                  allStickers: [...kJournalStripStickers, ...kDefaultBasicStickers],
                  archiveStickers: archived,
                  onAddCustomSticker: (_) {},
                  onAddArchiveSticker: (item) => setState(() => archived.add(item)),
                  onUpdateArchiveSticker: (_, {stickerId, textOverlay}) {},
                  onSelect: (id) => setState(() => selectedId = id),
                  onLocate: (_) {},
                  onJumpToPosition: (_) {},
                  onAcceptRevision: (_) {},
                  onRejectRevision: (_) {},
                  onToggleResolveComment: (_) {},
                  onReplyComment: (_, __) {},
                  onApplyAiSuggestion: (_, __) {},
                  onHaptic: (_) {},
                  onRegisterBackHandler: (fn) => backFn = fn,
                );
              },
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Write an unsaved draft on note a1, then step to next note a2
      await tester.enterText(find.byType(TextField).last, '补充两组消融实验');
      await tester.pump();

      await tester.tap(find.byIcon(LucideIcons.chevronRight));
      await tester.pumpAndSettle();

      expect(selectedId, 'a2');
      expect(archived.length, 1);
      expect(archived.first.annId, 'a1');
      expect(archived.first.draftText, '补充两组消融实验');

      // Open Blackboard view
      await tester.tap(find.text('黑板'));
      await tester.pumpAndSettle();

      expect(find.text('审阅黑板'), findsOneWidget);
      expect(find.text('ROW 01 · 批注便签'), findsOneWidget);
      expect(find.text('ROW 02 · 修订便签'), findsOneWidget);

      // Open Sticker Library
      await tester.tap(find.text('贴纸库'));
      await tester.pumpAndSettle();
      expect(find.text('贴纸库（手帐贴纸 & 文字叠加）'), findsOneWidget);

      // Back closes Sticker Library first, then closes Blackboard
      expect(backFn?.call(), true);
      await tester.pumpAndSettle();
      expect(find.text('审阅黑板'), findsOneWidget);

      expect(backFn?.call(), true);
      await tester.pumpAndSettle();
      expect(find.text('审阅黑板'), findsNothing);
    });

    testWidgets('WorkspaceShell enters 审阅模式 without deprecated 修订模式 strings and respects Back order',
        (tester) async {
      tester.view.physicalSize = const Size(390, 844);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      SharedPreferences.setMockInitialValues({
        'arcvault_onboarding_completed': true,
      });

      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(
        const MethodChannel('plugins.flutter.io/path_provider'),
        (call) async => '.',
      );

      final controller = AppController();
      await tester.runAsync(() async {
        for (var i = 0; i < 40 && !controller.isReady; i++) {
          await Future<void>.delayed(const Duration(milliseconds: 25));
        }
      });

      await tester.pumpWidget(ArcVaultMobileApp(controller: controller));
      await tester.pumpAndSettle();

      // Enter Review Mode from TopBar annotation button
      await tester.tap(find.byTooltip('批注与修订'));
      await tester.pumpAndSettle();

      // Verify orb menu contains "退出审阅模式" and zero "修订模式"
      expect(find.textContaining('修订模式'), findsNothing);
      await tester.tap(find.bySemanticsLabel('审阅模式菜单'));
      await tester.pumpAndSettle();
      expect(find.text('退出审阅模式'), findsOneWidget);

      // First back press closes orb menu, second back press exits Review Mode
      await tester.binding.handlePopRoute();
      await tester.pumpAndSettle();
      expect(find.text('退出审阅模式'), findsNothing);

      await tester.binding.handlePopRoute();
      await tester.pumpAndSettle();
      expect(find.bySemanticsLabel('审阅模式菜单'), findsNothing);

      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(
        const MethodChannel('plugins.flutter.io/path_provider'),
        null,
      );
    });
  });
}
