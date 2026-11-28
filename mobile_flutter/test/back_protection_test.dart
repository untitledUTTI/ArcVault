import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:arcvault_mobile/main.dart';
import 'package:arcvault_mobile/state/app_controller.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('WorkspaceShell back protection requires two presses within window to exit',
      (tester) async {
    SharedPreferences.setMockInitialValues({
      'arcvault_tutorial_done_v1': true,
    });

    var systemPopCount = 0;
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(SystemChannels.platform, (call) async {
      if (call.method == 'SystemNavigator.pop') {
        systemPopCount += 1;
      }
      return null;
    });
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(
      const MethodChannel('plugins.flutter.io/path_provider'),
      (call) async => '.',
    );

    final controller = AppController();
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 120));

    await tester.pumpWidget(ArcVaultMobileApp(controller: controller));
    await tester.pumpAndSettle();

    // First system back press arms the themed protection banner instead of exiting
    await tester.binding.handlePopRoute();
    await tester.pump(const Duration(milliseconds: 100));

    expect(systemPopCount, 0);
    expect(find.text('再按一次返回键退出穹档'), findsOneWidget);

    // Waiting beyond 2.2s disarms the guard automatically
    await tester.pump(const Duration(milliseconds: 2300));
    await tester.pump(const Duration(milliseconds: 250));
    expect(systemPopCount, 0);

    // Pressing back once arms again; pressing back a second time immediately exits
    await tester.binding.handlePopRoute();
    await tester.pump(const Duration(milliseconds: 100));
    expect(systemPopCount, 0);

    await tester.binding.handlePopRoute();
    await tester.pump(const Duration(milliseconds: 100));
    expect(systemPopCount, 1);

    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(SystemChannels.platform, null);
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(
      const MethodChannel('plugins.flutter.io/path_provider'),
      null,
    );
  });
}
