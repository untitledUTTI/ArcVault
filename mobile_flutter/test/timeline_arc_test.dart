import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:arcvault_mobile/state/app_controller.dart';
import 'package:arcvault_mobile/widgets/timeline_panel.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('TimelinePanel renders Arc Dome mode by default, switches snapshots, and toggles to List mode',
      (tester) async {
    final tempDir = Directory.systemTemp.createTempSync('arcvault_timeline_test_');
    SharedPreferences.setMockInitialValues({
      'arcvault_onboarding_completed': true,
    });
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(
      const MethodChannel('plugins.flutter.io/path_provider'),
      (call) async => tempDir.path,
    );

    final controller = AppController();
    for (var i = 0; i < 40 && !controller.isReady; i++) {
      await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 20)));
      await tester.pump(const Duration(milliseconds: 20));
    }

    expect(controller.isReady, isTrue);
    final doc = controller.activeDoc!;
    final snaps = controller.snapshotsForDoc(doc.id);
    expect(snaps.length, greaterThanOrEqualTo(2));
    final firstSnap = snaps.first;
    final lastSnap = snaps.last;

    // 1. Phone layout (isModalSheet: true, width: 400)
    await tester.binding.setSurfaceSize(const Size(400, 800));
    await tester.pumpWidget(
      MaterialApp(
        theme: controller.themeTokens.toMaterialTheme(),
        home: Scaffold(
          body: Align(
            alignment: Alignment.bottomCenter,
            child: TimelinePanel(
              controller: controller,
              isModalSheet: true,
              onOpenDiff: (_, __, {openDarlingsTab = false}) {},
              onClose: () {},
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.byKey(const ValueKey('timeline_mode_arc')), findsOneWidget);
    expect(find.byKey(const ValueKey('timeline_mode_list')), findsOneWidget);
    expect(find.byKey(ValueKey('arc_node_${firstSnap.id}')), findsOneWidget);
    expect(find.byKey(ValueKey('arc_node_${lastSnap.id}')), findsOneWidget);
    expect(find.text(lastSnap.aiSummary), findsOneWidget);

    // Tap first snapshot node on the Dome Arc -> updates detail card to firstSnap
    await tester.tap(find.byKey(ValueKey('arc_node_${firstSnap.id}')));
    await tester.pumpAndSettle();
    expect(find.text(firstSnap.aiSummary), findsOneWidget);

    // Toggle diff selection on detail card
    await tester.tap(find.byKey(ValueKey('arc_detail_toggle_diff_${firstSnap.id}')));
    await tester.pumpAndSettle();
    expect(find.text('取消对比勾选'), findsOneWidget);

    // Switch to List & Fragment Search mode
    await tester.tap(find.byKey(const ValueKey('timeline_mode_list')));
    await tester.pumpAndSettle();
    expect(find.byType(ListView), findsWidgets);

    // 2. Tablet / Wide layout (isModalSheet: false, width: 960)
    await tester.binding.setSurfaceSize(const Size(960, 800));
    await tester.pumpWidget(
      MaterialApp(
        theme: controller.themeTokens.toMaterialTheme(),
        home: Scaffold(
          body: Align(
            alignment: Alignment.bottomCenter,
            child: TimelinePanel(
              controller: controller,
              isModalSheet: false,
              onOpenDiff: (_, __, {openDarlingsTab = false}) {},
              onClose: () {},
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    // Switch back to Arc Dome mode and verify side-by-side rendering without overflow
    await tester.tap(find.byKey(const ValueKey('timeline_mode_arc')));
    await tester.pumpAndSettle();
    expect(find.byKey(ValueKey('arc_node_${lastSnap.id}')), findsOneWidget);

    await tester.binding.setSurfaceSize(null);
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(
      const MethodChannel('plugins.flutter.io/path_provider'),
      null,
    );
    if (tempDir.existsSync()) {
      tempDir.deleteSync(recursive: true);
    }
  });
}
