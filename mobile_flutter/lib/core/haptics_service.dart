import 'package:flutter/services.dart';
import '../models/archive_models.dart';

class HapticsService {
  HapticsService._();

  static Future<void> trigger(
    HapticPattern pattern,
    HapticsSettingsModel settings,
  ) async {
    if (!settings.enabled || settings.intensity == HapticIntensity.off) return;
    final gentle = settings.intensity == HapticIntensity.gentle;

    switch (pattern) {
      case HapticPattern.selection:
        await HapticFeedback.selectionClick();
      case HapticPattern.light:
        await HapticFeedback.lightImpact();
      case HapticPattern.medium:
        await (gentle ? HapticFeedback.lightImpact() : HapticFeedback.mediumImpact());
      case HapticPattern.heavy:
      case HapticPattern.error:
        await (gentle ? HapticFeedback.mediumImpact() : HapticFeedback.heavyImpact());
      case HapticPattern.success:
      case HapticPattern.warning:
        await HapticFeedback.mediumImpact();
    }
  }
}
