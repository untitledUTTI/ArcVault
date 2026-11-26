import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:arcvault_mobile/core/tutorial_flow.dart';
import 'package:arcvault_mobile/models/archive_models.dart';
import 'package:arcvault_mobile/theme/arc_theme.dart';

void main() {
  group('Mobile Themes & Tutorial Flow', () {
    test('maps deprecated desktop themes to liquid-glass and keeps 5 mobile themes', () {
      expect(TutorialFlow.mobileWelcomeThemes.length, 5);
      expect(MobileThemeId.fromWire('celestial-optics'), MobileThemeId.liquidGlass);
      expect(MobileThemeId.fromWire('weather-live'), MobileThemeId.liquidGlass);
      expect(MobileThemeId.fromWire('liquid-glass'), MobileThemeId.liquidGlass);
    });

    test('LiquidGlassSettingsModel presets and serialization round-trip', () {
      final preset = LiquidGlassSettingsModel.fromPreset(
        LiquidGlassPreset.crystal,
        isDark: true,
        previewBarEnabled: true,
      );
      final roundTrip = LiquidGlassSettingsModel.fromJson(preset.toJson());
      expect(roundTrip.isDark, true);
      expect(roundTrip.previewBarEnabled, true);
      expect(roundTrip.blur, 6.0);
      expect(roundTrip.thickness, 28.0);
    });

    test('immersive status bar keeps bar visible (transparent bg, contrasting icons)', () {
      final lightTokens = ArcThemeTokens.fromSettings(
        const AppSettingsModel(theme: MobileThemeId.light),
      );
      expect(lightTokens.systemUiOverlayStyle.statusBarColor, Colors.transparent);
      expect(lightTokens.systemUiOverlayStyle.statusBarIconBrightness, Brightness.dark);

      final darkGlass = ArcThemeTokens.fromSettings(
        const AppSettingsModel(
          theme: MobileThemeId.liquidGlass,
          liquidGlass: LiquidGlassSettingsModel(isDark: true),
        ),
      );
      expect(darkGlass.systemUiOverlayStyle.statusBarColor, Colors.transparent);
      expect(darkGlass.systemUiOverlayStyle.statusBarIconBrightness, Brightness.light);
    });

    test('first-run warning gate requires 0s countdown and exact phrase', () {
      expect(TutorialFlow.canConfirmWarning(remainingSeconds: 5, input: '我已了解'), false);
      expect(TutorialFlow.canConfirmWarning(remainingSeconds: 0, input: '了解'), false);
      expect(TutorialFlow.canConfirmWarning(remainingSeconds: 0, input: '我已了解'), true);
    });
  });
}
