import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:arcvault_mobile/core/diff_engine.dart';
import 'package:arcvault_mobile/models/archive_models.dart';
import 'package:arcvault_mobile/state/app_controller.dart';
import 'package:arcvault_mobile/widgets/modals/diff_viewer_modal.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('Structured Diff & Chapter Quick-Jump', () {
    test('extracts Markdown, LaTeX, and Chinese headings while ignoring code fences', () {
      const oldText = '''
导言说明文字。

# 1 引言
本文探讨跨平台版本控制。
```markdown
# 代码块中的伪标题
```
## 1.1 研究背景
已有方法准确率达到 91.6%。
\\section{方法设计}
采用两阶段索引。
第3章 实验评估
实验结果良好。
# 旧附录
待删除附录内容。''';

      const newText = '''
导言说明文字。

# 1 引言
本文探讨跨平台版本控制。
```markdown
# 代码块中的伪标题
```
## 1.1 研究背景与动机
已有方法准确率达到 94.2%。
\\section{方法设计}
采用两阶段索引。
第3章 实验评估
实验结果良好。
# 4 结论
总结全文贡献。''';

      final structured = computeStructuredDocumentDiff(oldText, newText);
      final titles = structured.chapters.map((c) => c.title).toList();

      expect(titles, contains('文首导言'));
      expect(titles, contains('1 引言'));
      expect(titles, contains('1.1 研究背景与动机'));
      expect(titles, contains('方法设计'));
      expect(titles, contains('第3章 实验评估'));
      expect(titles, contains('旧附录'));
      expect(titles, contains('4 结论'));
      expect(titles, isNot(contains('代码块中的伪标题')));

      final intro = structured.chapters.firstWhere((c) => c.title == '1 引言');
      expect(intro.hasChanges, isFalse);

      final bg = structured.chapters.firstWhere((c) => c.title == '1.1 研究背景与动机');
      expect(bg.headingStatus, DiffHeadingStatus.modified);
      expect(bg.hasChanges, isTrue);
      expect(bg.addedChars, greaterThan(0));

      final oldApp = structured.chapters.firstWhere((c) => c.title == '旧附录');
      expect(oldApp.headingStatus, DiffHeadingStatus.removed);

      final concl = structured.chapters.firstWhere((c) => c.title == '4 结论');
      expect(concl.headingStatus, DiffHeadingStatus.added);

      expect(parseDiffHeadingLine(r'\begin{abstract}')?.title, 'Abstract');
      expect(
        computeStructuredDocumentDiff('纯文本第一行', '纯文本第二行').chapters,
        isEmpty,
      );
    });

    testWidgets('DiffViewerModal displays chapter quick-jump on phone and tablet and scrolls on tap',
        (tester) async {
      SharedPreferences.setMockInitialValues({
        'arcvault_tutorial_done_v1': true,
      });
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(
        const MethodChannel('plugins.flutter.io/path_provider'),
        (call) async => '.',
      );

      final controller = AppController();
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 120));

      final longFiller = List.generate(16, (i) => '第${i + 1}条实验分析记录。').join('\n');
      final leftContent = '# 1 引言\n$longFiller\n# 2 方法\n旧方法准确率 91.6%。\n# 3 结论\n旧结论。';
      final rightContent = '# 1 引言\n$longFiller\n# 2 方法\n新方法准确率 94.2%。\n# 3 结论\n新结论。';

      final leftHash = controller.cas.put(leftContent).hash;
      final rightHash = controller.cas.put(rightContent).hash;

      final leftSnap = Snapshot(
        id: 'snap_1',
        documentId: 'doc_test',
        branchId: 'br_1',
        createdAt: '2026-11-28T00:00:00Z',
        label: 'v1',
        isMilestone: true,
        contentHash: leftHash,
        markdownHash: leftHash,
        latexHash: leftHash,
        wordCount: 100,
        deltaChars: 0,
        aiSummary: 'v1',
      );
      final rightSnap = Snapshot(
        id: 'snap_2',
        documentId: 'doc_test',
        branchId: 'br_1',
        parentId: 'snap_1',
        createdAt: '2026-11-28T01:00:00Z',
        label: 'v2',
        isMilestone: false,
        contentHash: rightHash,
        markdownHash: rightHash,
        latexHash: rightHash,
        wordCount: 105,
        deltaChars: 5,
        aiSummary: 'v2',
      );

      // Phone layout (< 720px)
      await tester.binding.setSurfaceSize(const Size(400, 800));
      await tester.pumpWidget(
        MaterialApp(
          theme: controller.themeTokens.toMaterialTheme(),
          home: Scaffold(
            body: DiffViewerModal(
              controller: controller,
              leftSnap: leftSnap,
              rightSnap: rightSnap,
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.byKey(const ValueKey('diff_mobile_toc_toggle')), findsOneWidget);
      expect(find.byKey(const ValueKey('diff_chip_diff_ch_0_0')), findsOneWidget);

      // Expand mobile chapter dropdown to jump to the last chapter cleanly
      await tester.tap(find.byKey(const ValueKey('diff_mobile_toc_toggle')));
      await tester.pumpAndSettle();

      await tester.tap(find.text('3 结论').last);
      await tester.pump();
      await tester.pump(const Duration(seconds: 1));

      // Tablet / Wide layout (>= 720px)
      await tester.binding.setSurfaceSize(const Size(960, 800));
      await tester.pumpAndSettle();

      expect(find.text('章节快捷跳转'), findsOneWidget);
      await tester.tap(find.text('2 方法').first);
      await tester.pump();
      await tester.pump(const Duration(seconds: 1));

      await tester.binding.setSurfaceSize(null);
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(
        const MethodChannel('plugins.flutter.io/path_provider'),
        null,
      );
    });
  });
}
