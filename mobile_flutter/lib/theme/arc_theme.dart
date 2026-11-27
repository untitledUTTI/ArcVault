import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../models/archive_models.dart';
import 'monet_engine.dart';

class ArcThemeTokens extends ThemeExtension<ArcThemeTokens> {
  const ArcThemeTokens({
    required this.themeId,
    required this.isDark,
    required this.bgApp,
    required this.bgSurface,
    required this.bgElevated,
    required this.bgSubtle,
    required this.bgHover,
    required this.borderSubtle,
    required this.borderStrong,
    required this.textPrimary,
    required this.textSecondary,
    required this.textMuted,
    required this.accent,
    required this.accentSoft,
    required this.accentText,
    required this.radius,
    required this.radiusSm,
    this.sidebarRadius = 22,
    this.surfaceRadius = 24,
    required this.commentColor,
    required this.revisionColor,
  });

  final MobileThemeId themeId;
  final bool isDark;
  final Color bgApp;
  final Color bgSurface;
  final Color bgElevated;
  final Color bgSubtle;
  final Color bgHover;
  final Color borderSubtle;
  final Color borderStrong;
  final Color textPrimary;
  final Color textSecondary;
  final Color textMuted;
  final Color accent;
  final Color accentSoft;
  final Color accentText;
  final double radius;
  final double radiusSm;
  final double sidebarRadius;
  final double surfaceRadius;
  final Color commentColor;
  final Color revisionColor;

  bool get isM3 => themeId == MobileThemeId.m3Expressive;

  /// Immersive status bar & gesture navigation bar overlay style (visible, never hidden).
  SystemUiOverlayStyle get systemUiOverlayStyle {
    final brightness = isDark ? Brightness.light : Brightness.dark;
    return SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: brightness,
      statusBarBrightness: isDark ? Brightness.dark : Brightness.light,
      systemNavigationBarColor: Colors.transparent,
      systemNavigationBarIconBrightness: brightness,
      systemStatusBarContrastEnforced: false,
      systemNavigationBarContrastEnforced: false,
    );
  }

  static Color parseHex(String hex, Color fallback) {
    final clean = hex.replaceAll('#', '').trim();
    if (clean.length == 6) {
      final v = int.tryParse('FF$clean', radix: 16);
      if (v != null) return Color(v);
    }
    return fallback;
  }

  factory ArcThemeTokens.fromSettings(AppSettingsModel settings) {
    final commentColor = parseHex(settings.commentColor, const Color(0xFF2563EB));
    final revisionColor = parseHex(settings.revisionColor, const Color(0xFFDC2626));

    switch (settings.theme) {
      case MobileThemeId.light:
        return ArcThemeTokens(
          themeId: MobileThemeId.light,
          isDark: false,
          bgApp: const Color(0xFFF6F7FB),
          bgSurface: const Color(0xFFFFFFFF),
          bgElevated: const Color(0xFFFFFFFF),
          bgSubtle: const Color(0xFFEEF1F7),
          bgHover: const Color(0xFFE5E9F2),
          borderSubtle: const Color(0xFFE2E7F0),
          borderStrong: const Color(0xFFC9D2E3),
          textPrimary: const Color(0xFF141824),
          textSecondary: const Color(0xFF4E596E),
          textMuted: const Color(0xFF8490A6),
          accent: const Color(0xFF3B5BDB),
          accentSoft: const Color(0x1F3B5BDB),
          accentText: const Color(0xFFFFFFFF),
          radius: 12,
          radiusSm: 8,
          sidebarRadius: settings.sidebarCornerRadius,
          surfaceRadius: settings.cardCornerRadius,
          commentColor: commentColor,
          revisionColor: revisionColor,
        );

      case MobileThemeId.dark:
        return ArcThemeTokens(
          themeId: MobileThemeId.dark,
          isDark: true,
          bgApp: const Color(0xFF0D1117),
          bgSurface: const Color(0xFF141A23),
          bgElevated: const Color(0xFF1A222E),
          bgSubtle: const Color(0xFF1E2736),
          bgHover: const Color(0xFF253042),
          borderSubtle: const Color(0xFF283344),
          borderStrong: const Color(0xFF394860),
          textPrimary: const Color(0xFFE6EDF7),
          textSecondary: const Color(0xFF9FB0C8),
          textMuted: const Color(0xFF6E7F98),
          accent: const Color(0xFF60A5FA),
          accentSoft: const Color(0x2960A5FA),
          accentText: const Color(0xFF081226),
          radius: 12,
          radiusSm: 8,
          sidebarRadius: settings.sidebarCornerRadius,
          surfaceRadius: settings.cardCornerRadius,
          commentColor: commentColor,
          revisionColor: revisionColor,
        );

      case MobileThemeId.paper:
        return ArcThemeTokens(
          themeId: MobileThemeId.paper,
          isDark: false,
          bgApp: const Color(0xFFF3EDE0),
          bgSurface: const Color(0xFFFAF6EC),
          bgElevated: const Color(0xFFFFFDF7),
          bgSubtle: const Color(0xFFEBE3D0),
          bgHover: const Color(0xFFE2D8C2),
          borderSubtle: const Color(0xFFDED4BE),
          borderStrong: const Color(0xFFC5B89D),
          textPrimary: const Color(0xFF2C251B),
          textSecondary: const Color(0xFF5D5140),
          textMuted: const Color(0xFF8A7C68),
          accent: const Color(0xFF8C5A2B),
          accentSoft: const Color(0x218C5A2B),
          accentText: const Color(0xFFFFFDF7),
          radius: 12,
          radiusSm: 8,
          sidebarRadius: settings.sidebarCornerRadius,
          surfaceRadius: settings.cardCornerRadius,
          commentColor: commentColor,
          revisionColor: revisionColor,
        );

      case MobileThemeId.m3Expressive:
        final m = MonetEngine.generateTokens(settings.monet);
        return ArcThemeTokens(
          themeId: MobileThemeId.m3Expressive,
          isDark: m.isDark,
          bgApp: m.surfaceContainer,
          bgSurface: m.surfaceContainerLow,
          bgElevated: m.surfaceContainerLowest,
          bgSubtle: m.surfaceContainerHigh,
          bgHover: m.surfaceContainerHighest,
          borderSubtle: m.outlineVariant.withValues(alpha: 0.55),
          borderStrong: m.outline,
          textPrimary: m.onSurface,
          textSecondary: m.onSurfaceVariant,
          textMuted: m.onSurfaceVariant.withValues(alpha: 0.72),
          accent: m.primary,
          accentSoft: m.primaryContainer,
          accentText: m.onPrimary,
          radius: 24,
          radiusSm: 14,
          sidebarRadius: settings.sidebarCornerRadius,
          surfaceRadius: settings.cardCornerRadius,
          commentColor: commentColor,
          revisionColor: revisionColor,
        );
    }
  }

  ThemeData toMaterialTheme() {
    final scheme = ColorScheme.fromSeed(
      seedColor: accent,
      brightness: isDark ? Brightness.dark : Brightness.light,
    ).copyWith(
      primary: accent,
      onPrimary: accentText,
      surface: bgSurface,
      onSurface: textPrimary,
    );

    return ThemeData(
      useMaterial3: true,
      brightness: isDark ? Brightness.dark : Brightness.light,
      colorScheme: scheme,
      scaffoldBackgroundColor: bgApp,
      cardColor: bgSurface,
      dividerColor: borderSubtle,
      extensions: [this],
    );
  }

  @override
  ArcThemeTokens copyWith({
    MobileThemeId? themeId,
    bool? isDark,
    Color? bgApp,
    Color? bgSurface,
    Color? bgElevated,
    Color? bgSubtle,
    Color? bgHover,
    Color? borderSubtle,
    Color? borderStrong,
    Color? textPrimary,
    Color? textSecondary,
    Color? textMuted,
    Color? accent,
    Color? accentSoft,
    Color? accentText,
    double? radius,
    double? radiusSm,
    double? sidebarRadius,
    double? surfaceRadius,
    Color? commentColor,
    Color? revisionColor,
  }) {
    return ArcThemeTokens(
      themeId: themeId ?? this.themeId,
      isDark: isDark ?? this.isDark,
      bgApp: bgApp ?? this.bgApp,
      bgSurface: bgSurface ?? this.bgSurface,
      bgElevated: bgElevated ?? this.bgElevated,
      bgSubtle: bgSubtle ?? this.bgSubtle,
      bgHover: bgHover ?? this.bgHover,
      borderSubtle: borderSubtle ?? this.borderSubtle,
      borderStrong: borderStrong ?? this.borderStrong,
      textPrimary: textPrimary ?? this.textPrimary,
      textSecondary: textSecondary ?? this.textSecondary,
      textMuted: textMuted ?? this.textMuted,
      accent: accent ?? this.accent,
      accentSoft: accentSoft ?? this.accentSoft,
      accentText: accentText ?? this.accentText,
      radius: radius ?? this.radius,
      radiusSm: radiusSm ?? this.radiusSm,
      sidebarRadius: sidebarRadius ?? this.sidebarRadius,
      surfaceRadius: surfaceRadius ?? this.surfaceRadius,
      commentColor: commentColor ?? this.commentColor,
      revisionColor: revisionColor ?? this.revisionColor,
    );
  }

  @override
  ArcThemeTokens lerp(ThemeExtension<ArcThemeTokens>? other, double t) {
    if (other is! ArcThemeTokens) return this;
    return t < 0.5 ? this : other;
  }
}

extension ArcThemeContextExt on BuildContext {
  ArcThemeTokens get arcTheme =>
      Theme.of(this).extension<ArcThemeTokens>() ??
      ArcThemeTokens.fromSettings(const AppSettingsModel());
}

/// Clean elevated surface for floating overlays, modals, sheets, and bars.
class ArcSurface extends StatelessWidget {
  const ArcSurface({
    super.key,
    required this.child,
    this.borderRadius,
    this.padding,
    this.color,
    this.borderColor,
  });

  final Widget child;
  final double? borderRadius;
  final EdgeInsetsGeometry? padding;
  final Color? color;
  final Color? borderColor;

  @override
  Widget build(BuildContext context) {
    final tokens = context.arcTheme;
    final r = borderRadius ?? tokens.surfaceRadius;
    final content = padding != null ? Padding(padding: padding!, child: child) : child;

    return Container(
      decoration: BoxDecoration(
        color: color ?? tokens.bgElevated,
        borderRadius: BorderRadius.circular(r),
        border: Border.all(color: borderColor ?? tokens.borderSubtle),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: tokens.isDark ? 0.28 : 0.06),
            blurRadius: 14,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(r),
        child: content,
      ),
    );
  }
}

/// Clean card surface for list items, settings cards, and annotations.
class ArcCardSurface extends StatelessWidget {
  const ArcCardSurface({
    super.key,
    required this.child,
    this.borderRadius,
    this.padding,
    this.isActive = false,
  });

  final Widget child;
  final double? borderRadius;
  final EdgeInsetsGeometry? padding;
  final bool isActive;

  @override
  Widget build(BuildContext context) {
    final t = context.arcTheme;
    final r = borderRadius ?? t.radiusSm;
    return Container(
      padding: padding,
      decoration: BoxDecoration(
        color: isActive ? t.accentSoft : t.bgSurface,
        borderRadius: BorderRadius.circular(r),
        border: Border.all(
          color: isActive ? t.accent : t.borderSubtle,
          width: isActive ? 1.4 : 1.0,
        ),
      ),
      child: child,
    );
  }
}
