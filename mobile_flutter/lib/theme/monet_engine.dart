import 'dart:ui';
import 'package:material_color_utilities/material_color_utilities.dart';
import '../models/archive_models.dart';

class MonetStyleInfo {
  const MonetStyleInfo({
    required this.id,
    required this.nameZh,
    required this.nameEn,
    required this.descZh,
    required this.descEn,
  });

  final MonetStyle id;
  final String nameZh;
  final String nameEn;
  final String descZh;
  final String descEn;
}

class MonetColorTokens {
  const MonetColorTokens({
    required this.primary,
    required this.onPrimary,
    required this.primaryContainer,
    required this.onPrimaryContainer,
    required this.secondary,
    required this.secondaryContainer,
    required this.onSecondaryContainer,
    required this.tertiary,
    required this.tertiaryContainer,
    required this.onTertiaryContainer,
    required this.background,
    required this.surface,
    required this.surfaceContainerLowest,
    required this.surfaceContainerLow,
    required this.surfaceContainer,
    required this.surfaceContainerHigh,
    required this.surfaceContainerHighest,
    required this.onSurface,
    required this.onSurfaceVariant,
    required this.outline,
    required this.outlineVariant,
    required this.isDark,
  });

  final Color primary;
  final Color onPrimary;
  final Color primaryContainer;
  final Color onPrimaryContainer;
  final Color secondary;
  final Color secondaryContainer;
  final Color onSecondaryContainer;
  final Color tertiary;
  final Color tertiaryContainer;
  final Color onTertiaryContainer;
  final Color background;
  final Color surface;
  final Color surfaceContainerLowest;
  final Color surfaceContainerLow;
  final Color surfaceContainer;
  final Color surfaceContainerHigh;
  final Color surfaceContainerHighest;
  final Color onSurface;
  final Color onSurfaceVariant;
  final Color outline;
  final Color outlineVariant;
  final bool isDark;
}

class MonetEngine {
  MonetEngine._();

  static const List<MonetStyleInfo> styles = [
    MonetStyleInfo(id: MonetStyle.tonalSpot, nameZh: '色调点', nameEn: 'Tonal Spot', descZh: 'Android 默认经典莫奈', descEn: 'Classic balanced Material You'),
    MonetStyleInfo(id: MonetStyle.expressive, nameZh: '表达', nameEn: 'Expressive', descZh: 'M3E 官方主推，灵动撞色', descEn: 'M3 Expressive lively hue shifts'),
    MonetStyleInfo(id: MonetStyle.vibrant, nameZh: '鲜艳', nameEn: 'Vibrant', descZh: '高饱和鲜活强调色', descEn: 'High-chroma vibrant accents'),
    MonetStyleInfo(id: MonetStyle.neutral, nameZh: '自然', nameEn: 'Neutral', descZh: '低彩度微暖/微冷中性灰', descEn: 'Low-chroma calm neutrals'),
    MonetStyleInfo(id: MonetStyle.monochrome, nameZh: '单色', nameEn: 'Monochrome', descZh: '纯净极简黑白灰阶', descEn: 'Minimalist grayscale'),
    MonetStyleInfo(id: MonetStyle.fidelity, nameZh: '保真', nameEn: 'Fidelity', descZh: '忠实保留种子原色', descEn: 'Faithful to seed hue'),
    MonetStyleInfo(id: MonetStyle.content, nameZh: '内容', nameEn: 'Content', descZh: '紧扣内容/壁纸主色协调', descEn: 'Harmonized with content'),
    MonetStyleInfo(id: MonetStyle.rainbow, nameZh: '彩虹', nameEn: 'Rainbow', descZh: '多色相旋转拼接', descEn: 'Playful multi-hue rotation'),
    MonetStyleInfo(id: MonetStyle.fruitSalad, nameZh: '水果沙拉', nameEn: 'Fruit Salad', descZh: '对比鲜明的双果色混搭', descEn: 'High-contrast dual-tone'),
    MonetStyleInfo(id: MonetStyle.fantasy, nameZh: '幻想', nameEn: 'Fantasy', descZh: '梦幻天象三色相偏移', descEn: 'Dreamy tri-hue shift'),
  ];

  static const List<({String hex, String labelZh, String labelEn})> curatedSeeds = [
    (hex: '#6750a4', labelZh: 'M3 薰衣草紫', labelEn: 'M3 Lavender'),
    (hex: '#1a73e8', labelZh: 'Pixel 晴空蓝', labelEn: 'Pixel Sky Blue'),
    (hex: '#006a6a', labelZh: '松石青黛', labelEn: 'Pine Teal'),
    (hex: '#2e7d32', labelZh: '森屿苔绿', labelEn: 'Forest Moss'),
    (hex: '#d84315', labelZh: '落日赤陶', labelEn: 'Sunset Terracotta'),
    (hex: '#c2185b', labelZh: '维纳斯玫红', labelEn: 'Venus Rose'),
    (hex: '#b45309', labelZh: '琥珀金秋', labelEn: 'Autumn Amber'),
    (hex: '#455a64', labelZh: '暮色星岩', labelEn: 'Dusk Slate'),
  ];

  static int parseHexArgb(String hex) {
    final clean = hex.replaceAll('#', '').trim();
    if (clean.length == 6) {
      return int.tryParse('FF$clean', radix: 16) ?? 0xFF6750A4;
    }
    if (clean.length == 8) {
      return int.tryParse(clean, radix: 16) ?? 0xFF6750A4;
    }
    return 0xFF6750A4;
  }

  static String colorToHex(Color c) {
    final argb = c.toARGB32() & 0x00FFFFFF;
    return '#${argb.toRadixString(16).padLeft(6, '0')}';
  }

  static MonetColorTokens generateTokens(MonetSettingsModel settings) {
    final sourceHct = Hct.fromInt(parseHexArgb(settings.seedColor));
    final isDark = settings.isDark;
    final contrast = settings.contrastLevel;

    final DynamicScheme scheme;
    switch (settings.style) {
      case MonetStyle.tonalSpot:
        scheme = SchemeTonalSpot(sourceColorHct: sourceHct, isDark: isDark, contrastLevel: contrast);
      case MonetStyle.neutral:
        scheme = SchemeNeutral(sourceColorHct: sourceHct, isDark: isDark, contrastLevel: contrast);
      case MonetStyle.monochrome:
        scheme = SchemeMonochrome(sourceColorHct: sourceHct, isDark: isDark, contrastLevel: contrast);
      case MonetStyle.vibrant:
        scheme = SchemeVibrant(sourceColorHct: sourceHct, isDark: isDark, contrastLevel: contrast);
      case MonetStyle.rainbow:
        scheme = SchemeRainbow(sourceColorHct: sourceHct, isDark: isDark, contrastLevel: contrast);
      case MonetStyle.expressive:
        scheme = SchemeExpressive(sourceColorHct: sourceHct, isDark: isDark, contrastLevel: contrast);
      case MonetStyle.content:
        scheme = SchemeContent(sourceColorHct: sourceHct, isDark: isDark, contrastLevel: contrast);
      case MonetStyle.fruitSalad:
        scheme = SchemeFruitSalad(sourceColorHct: sourceHct, isDark: isDark, contrastLevel: contrast);
      case MonetStyle.fidelity:
        scheme = SchemeFidelity(sourceColorHct: sourceHct, isDark: isDark, contrastLevel: contrast);
      case MonetStyle.fantasy:
        final h = sourceHct.hue;
        final baseC = sourceHct.chroma < 46 ? 46.0 : sourceHct.chroma;
        scheme = DynamicScheme(
          sourceColorArgb: sourceHct.toInt(),
          variant: Variant.expressive,
          contrastLevel: contrast,
          isDark: isDark,
          primaryPalette: TonalPalette.of((h + 15) % 360, baseC),
          secondaryPalette: TonalPalette.of((h + 62) % 360, 32),
          tertiaryPalette: TonalPalette.of((h + 158) % 360, 56),
          neutralPalette: TonalPalette.of((h + 24) % 360, 10),
          neutralVariantPalette: TonalPalette.of((h + 24) % 360, 16),
        );
    }

    return MonetColorTokens(
      primary: Color(MaterialDynamicColors.primary.getArgb(scheme)),
      onPrimary: Color(MaterialDynamicColors.onPrimary.getArgb(scheme)),
      primaryContainer: Color(MaterialDynamicColors.primaryContainer.getArgb(scheme)),
      onPrimaryContainer: Color(MaterialDynamicColors.onPrimaryContainer.getArgb(scheme)),
      secondary: Color(MaterialDynamicColors.secondary.getArgb(scheme)),
      secondaryContainer: Color(MaterialDynamicColors.secondaryContainer.getArgb(scheme)),
      onSecondaryContainer: Color(MaterialDynamicColors.onSecondaryContainer.getArgb(scheme)),
      tertiary: Color(MaterialDynamicColors.tertiary.getArgb(scheme)),
      tertiaryContainer: Color(MaterialDynamicColors.tertiaryContainer.getArgb(scheme)),
      onTertiaryContainer: Color(MaterialDynamicColors.onTertiaryContainer.getArgb(scheme)),
      background: Color(MaterialDynamicColors.background.getArgb(scheme)),
      surface: Color(MaterialDynamicColors.surface.getArgb(scheme)),
      surfaceContainerLowest: Color(MaterialDynamicColors.surfaceContainerLowest.getArgb(scheme)),
      surfaceContainerLow: Color(MaterialDynamicColors.surfaceContainerLow.getArgb(scheme)),
      surfaceContainer: Color(MaterialDynamicColors.surfaceContainer.getArgb(scheme)),
      surfaceContainerHigh: Color(MaterialDynamicColors.surfaceContainerHigh.getArgb(scheme)),
      surfaceContainerHighest: Color(MaterialDynamicColors.surfaceContainerHighest.getArgb(scheme)),
      onSurface: Color(MaterialDynamicColors.onSurface.getArgb(scheme)),
      onSurfaceVariant: Color(MaterialDynamicColors.onSurfaceVariant.getArgb(scheme)),
      outline: Color(MaterialDynamicColors.outline.getArgb(scheme)),
      outlineVariant: Color(MaterialDynamicColors.outlineVariant.getArgb(scheme)),
      isDark: isDark,
    );
  }

  /// Extracts top curated seed hex colors from RGBA pixel samples via QuantizerCelebi + Score.
  static Future<List<String>> extractSeedsFromRgbaPixels(List<int> argbPixels) async {
    if (argbPixels.isEmpty) return const ['#6750a4'];
    final quantizerResult = await QuantizerCelebi().quantize(argbPixels, 64);
    final scored = Score.score(quantizerResult.colorToCount, desired: 4);
    return scored.map((argb) => colorToHex(Color(argb))).toList();
  }
}
