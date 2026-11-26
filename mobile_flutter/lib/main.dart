import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_localizations/flutter_localizations.dart';

import 'screens/workspace_shell.dart';
import 'state/app_controller.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  // Edge-to-Edge immersive mode: status bar & navigation bar remain visible (never hidden)
  // while the app theme and Liquid Glass backdrop draw cleanly underneath them.
  await SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);

  final controller = AppController();
  runApp(ArcVaultMobileApp(controller: controller));
}

class ArcVaultMobileApp extends StatelessWidget {
  const ArcVaultMobileApp({super.key, required this.controller});

  final AppController controller;

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: controller,
      builder: (context, _) {
        final tokens = controller.themeTokens;
        final isZh = controller.settings.locale.isZh;

        return MaterialApp(
          title: 'ArcVault · 穹档',
          debugShowCheckedModeBanner: false,
          theme: tokens.toMaterialTheme(),
          locale: isZh ? const Locale('zh', 'CN') : const Locale('en', 'US'),
          supportedLocales: const [
            Locale('zh', 'CN'),
            Locale('en', 'US'),
          ],
          localizationsDelegates: const [
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
            GlobalCupertinoLocalizations.delegate,
          ],
          home: WorkspaceShell(controller: controller),
        );
      },
    );
  }
}
