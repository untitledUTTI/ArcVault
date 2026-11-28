import 'dart:convert';
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

enum StickerCategory {
  journal('journal'),
  basic('basic'),
  custom('custom');

  const StickerCategory(this.wire);
  final String wire;

  static StickerCategory fromWire(String? v) {
    for (final c in StickerCategory.values) {
      if (c.wire == v) return c;
    }
    return StickerCategory.basic;
  }
}

enum StickerFontPreset {
  defaultSans('default'),
  serif('serif'),
  kaiti('kaiti'),
  fangsong('fangsong'),
  rounded('rounded'),
  mono('mono'),
  cursive('cursive'),
  custom('custom');

  const StickerFontPreset(this.wire);
  final String wire;

  static StickerFontPreset fromWire(String? v) {
    for (final p in StickerFontPreset.values) {
      if (p.wire == v) return p;
    }
    return StickerFontPreset.defaultSans;
  }
}

enum StickerTextShadow {
  none('none'),
  soft('soft'),
  retro('retro');

  const StickerTextShadow(this.wire);
  final String wire;

  static StickerTextShadow fromWire(String? v) {
    for (final s in StickerTextShadow.values) {
      if (s.wire == v) return s;
    }
    return StickerTextShadow.none;
  }
}

class StickerFontPresetDef {
  const StickerFontPresetDef({
    required this.id,
    required this.label,
    required this.labelEn,
    required this.fontFamily,
    this.fallback = const [],
  });

  final StickerFontPreset id;
  final String label;
  final String labelEn;
  final String? fontFamily;
  final List<String> fallback;
}

const List<StickerFontPresetDef> kStickerFontPresets = [
  StickerFontPresetDef(
    id: StickerFontPreset.defaultSans,
    label: '系统黑体',
    labelEn: 'Sans',
    fontFamily: null,
    fallback: ['PingFang SC', 'Microsoft YaHei', 'Noto Sans SC', 'sans-serif'],
  ),
  StickerFontPresetDef(
    id: StickerFontPreset.serif,
    label: '优雅宋体',
    labelEn: 'Serif',
    fontFamily: 'serif',
    fallback: ['Source Han Serif SC', 'Noto Serif SC', 'Songti SC', 'SimSun', 'Georgia'],
  ),
  StickerFontPresetDef(
    id: StickerFontPreset.kaiti,
    label: '手写楷体',
    labelEn: 'KaiTi',
    fontFamily: 'LXGW WenKai',
    fallback: ['Kaiti SC', 'KaiTi', 'STKaiti', 'serif'],
  ),
  StickerFontPresetDef(
    id: StickerFontPreset.fangsong,
    label: '复古仿宋',
    labelEn: 'FangSong',
    fontFamily: 'FangSong',
    fallback: ['STFangsong', 'Noto Serif SC', 'serif'],
  ),
  StickerFontPresetDef(
    id: StickerFontPreset.rounded,
    label: '可爱圆体',
    labelEn: 'Rounded',
    fontFamily: 'YouYuan',
    fallback: ['SF Pro Rounded', 'Nunito', 'Microsoft YaHei', 'sans-serif'],
  ),
  StickerFontPresetDef(
    id: StickerFontPreset.mono,
    label: '打字机',
    labelEn: 'Typewriter',
    fontFamily: 'monospace',
    fallback: ['JetBrains Mono', 'Cascadia Code', 'Courier New', 'Consolas'],
  ),
  StickerFontPresetDef(
    id: StickerFontPreset.cursive,
    label: '花体手帐',
    labelEn: 'Script',
    fontFamily: 'cursive',
    fallback: ['Segoe Script', 'Bradley Hand', 'KaiTi'],
  ),
  StickerFontPresetDef(
    id: StickerFontPreset.custom,
    label: '自定义字体',
    labelEn: 'Custom',
    fontFamily: null,
    fallback: ['PingFang SC', 'Microsoft YaHei', 'sans-serif'],
  ),
];

const List<String> kStickerTextColorPresets = [
  '#2c2623',
  '#4a3728',
  '#1e3a5f',
  '#7f1d1d',
  '#14532d',
  '#581c87',
  '#f8fafc',
  '#fef3c7',
];

const List<String> kStickerStrokeColorPresets = [
  '#ffffff',
  '#fefce8',
  '#1e293b',
  '#0f172a',
  '#7f1d1d',
  '#1e3a5f',
];

String sanitizeStickerFontName(String? name) {
  return (name ?? '').trim().replaceAll(RegExp(r'[;{}"\x27]'), '');
}

({String? fontFamily, List<String> fallback}) resolveStickerFont(StickerTextStyle style) {
  if (style.fontFamily == StickerFontPreset.custom) {
    final custom = sanitizeStickerFontName(style.customFontName);
    if (custom.isNotEmpty) {
      return (
        fontFamily: custom,
        fallback: const ['PingFang SC', 'Microsoft YaHei', 'sans-serif'],
      );
    }
    return (
      fontFamily: null,
      fallback: const ['PingFang SC', 'Microsoft YaHei', 'sans-serif'],
    );
  }
  final preset = kStickerFontPresets.firstWhere(
    (p) => p.id == style.fontFamily,
    orElse: () => kStickerFontPresets.first,
  );
  return (fontFamily: preset.fontFamily, fallback: preset.fallback);
}

Color parseStickerHexColor(String hex, [Color fallback = const Color(0xFF2C2623)]) {
  final clean = hex.replaceAll('#', '').trim();
  if (clean.length == 6) {
    final v = int.tryParse('FF$clean', radix: 16);
    if (v != null) return Color(v);
  } else if (clean.length == 8) {
    final v = int.tryParse(clean, radix: 16);
    if (v != null) return Color(v);
  }
  return fallback;
}

String colorToHex(Color color) {
  final argb = color.toARGB32();
  final rgb = (argb & 0x00FFFFFF).toRadixString(16).padLeft(6, '0');
  return '#$rgb';
}

class StickerTextStyle {
  const StickerTextStyle({
    this.text = '',
    this.fontFamily = StickerFontPreset.defaultSans,
    this.customFontName = '',
    this.fontSize = 12.0,
    this.bold = true,
    this.italic = false,
    this.underline = false,
    this.letterSpacing = 0.5,
    this.color = '#2c2623',
    this.strokeEnabled = false,
    this.strokeColor = '#ffffff',
    this.strokeWidth = 1.5,
    this.shadow = StickerTextShadow.none,
  });

  final String text;
  final StickerFontPreset fontFamily;
  final String customFontName;
  final double fontSize; // 9..20
  final bool bold;
  final bool italic;
  final bool underline;
  final double letterSpacing; // 0..4
  final String color;
  final bool strokeEnabled;
  final String strokeColor;
  final double strokeWidth; // 0.5..4
  final StickerTextShadow shadow;

  StickerTextStyle copyWith({
    String? text,
    StickerFontPreset? fontFamily,
    String? customFontName,
    double? fontSize,
    bool? bold,
    bool? italic,
    bool? underline,
    double? letterSpacing,
    String? color,
    bool? strokeEnabled,
    String? strokeColor,
    double? strokeWidth,
    StickerTextShadow? shadow,
  }) {
    return StickerTextStyle(
      text: text ?? this.text,
      fontFamily: fontFamily ?? this.fontFamily,
      customFontName: customFontName ?? this.customFontName,
      fontSize: (fontSize ?? this.fontSize).clamp(9.0, 20.0),
      bold: bold ?? this.bold,
      italic: italic ?? this.italic,
      underline: underline ?? this.underline,
      letterSpacing: (letterSpacing ?? this.letterSpacing).clamp(0.0, 4.0),
      color: color ?? this.color,
      strokeEnabled: strokeEnabled ?? this.strokeEnabled,
      strokeColor: strokeColor ?? this.strokeColor,
      strokeWidth: (strokeWidth ?? this.strokeWidth).clamp(0.5, 4.0),
      shadow: shadow ?? this.shadow,
    );
  }

  Map<String, dynamic> toJson() => {
        'text': text,
        'fontFamily': fontFamily.wire,
        'customFontName': customFontName,
        'fontSize': fontSize,
        'bold': bold,
        'italic': italic,
        'underline': underline,
        'letterSpacing': letterSpacing,
        'color': color,
        'strokeEnabled': strokeEnabled,
        'strokeColor': strokeColor,
        'strokeWidth': strokeWidth,
        'shadow': shadow.wire,
      };

  factory StickerTextStyle.fromJson(Map<String, dynamic> json) {
    return StickerTextStyle(
      text: json['text']?.toString() ?? '',
      fontFamily: StickerFontPreset.fromWire(json['fontFamily']?.toString()),
      customFontName: json['customFontName']?.toString() ?? '',
      fontSize: ((json['fontSize'] as num?)?.toDouble() ?? 12.0).clamp(9.0, 20.0),
      bold: json['bold'] as bool? ?? true,
      italic: json['italic'] as bool? ?? false,
      underline: json['underline'] as bool? ?? false,
      letterSpacing: ((json['letterSpacing'] as num?)?.toDouble() ?? 0.5).clamp(0.0, 4.0),
      color: json['color']?.toString() ?? '#2c2623',
      strokeEnabled: json['strokeEnabled'] as bool? ?? false,
      strokeColor: json['strokeColor']?.toString() ?? '#ffffff',
      strokeWidth: ((json['strokeWidth'] as num?)?.toDouble() ?? 1.5).clamp(0.5, 4.0),
      shadow: StickerTextShadow.fromWire(json['shadow']?.toString()),
    );
  }
}

class ReviewStickerDef {
  const ReviewStickerDef({
    required this.id,
    required this.label,
    this.labelEn,
    this.emoji,
    required this.color,
    this.category,
    this.assetPath,
    this.pngDataUrl,
    this.isStripImage = false,
    this.isCustom = false,
    this.defaultTextColor,
    this.defaultStrokeColor,
    this.textInset,
    this.defaultTextStyle,
  });

  final String id;
  final String label;
  final String? labelEn;
  final String? emoji;
  final String color;
  final StickerCategory? category;
  final String? assetPath;
  final String? pngDataUrl;
  final bool isStripImage;
  final bool isCustom;
  final String? defaultTextColor;
  final String? defaultStrokeColor;

  /// [top%, right%, bottom%, left%] safe inner padding for overlaid text.
  final List<double>? textInset;
  final StickerTextStyle? defaultTextStyle;

  Map<String, dynamic> toJson() => {
        'id': id,
        'label': label,
        if (labelEn != null) 'labelEn': labelEn,
        if (emoji != null) 'emoji': emoji,
        'color': color,
        if (category != null) 'category': category!.wire,
        if (assetPath != null) 'assetPath': assetPath,
        if (pngDataUrl != null) 'pngDataUrl': pngDataUrl,
        'isStripImage': isStripImage,
        'isCustom': isCustom,
        if (defaultTextColor != null) 'defaultTextColor': defaultTextColor,
        if (defaultStrokeColor != null) 'defaultStrokeColor': defaultStrokeColor,
        if (textInset != null) 'textInset': textInset,
        if (defaultTextStyle != null) 'defaultTextStyle': defaultTextStyle!.toJson(),
      };

  factory ReviewStickerDef.fromJson(Map<String, dynamic> json) {
    final insetRaw = json['textInset'];
    List<double>? inset;
    if (insetRaw is List && insetRaw.length >= 4) {
      inset = insetRaw.take(4).map((e) => (e as num).toDouble()).toList();
    }
    final styleRaw = json['defaultTextStyle'];
    return ReviewStickerDef(
      id: json['id']?.toString() ?? 'stk-custom',
      label: json['label']?.toString() ?? '自定义',
      labelEn: json['labelEn']?.toString(),
      emoji: json['emoji']?.toString(),
      color: json['color']?.toString() ?? '#6366f1',
      category: json['category'] != null
          ? StickerCategory.fromWire(json['category']?.toString())
          : null,
      assetPath: json['assetPath']?.toString(),
      pngDataUrl: json['pngDataUrl']?.toString(),
      isStripImage: json['isStripImage'] as bool? ?? false,
      isCustom: json['isCustom'] as bool? ?? false,
      defaultTextColor: json['defaultTextColor']?.toString(),
      defaultStrokeColor: json['defaultStrokeColor']?.toString(),
      textInset: inset,
      defaultTextStyle: styleRaw is Map<String, dynamic>
          ? StickerTextStyle.fromJson(styleRaw)
          : (styleRaw is Map
              ? StickerTextStyle.fromJson(Map<String, dynamic>.from(styleRaw))
              : null),
    );
  }
}

class ReviewArchiveStickerItem {
  const ReviewArchiveStickerItem({
    required this.id,
    required this.annId,
    required this.stickerId,
    required this.draftText,
    required this.snippet,
    required this.savedAt,
    this.textOverlay,
  });

  final String id;
  final String annId;
  final String stickerId;
  final String draftText;
  final String snippet;
  final int savedAt;
  final StickerTextStyle? textOverlay;

  ReviewArchiveStickerItem copyWith({
    String? id,
    String? annId,
    String? stickerId,
    String? draftText,
    String? snippet,
    int? savedAt,
    StickerTextStyle? textOverlay,
  }) {
    return ReviewArchiveStickerItem(
      id: id ?? this.id,
      annId: annId ?? this.annId,
      stickerId: stickerId ?? this.stickerId,
      draftText: draftText ?? this.draftText,
      snippet: snippet ?? this.snippet,
      savedAt: savedAt ?? this.savedAt,
      textOverlay: textOverlay ?? this.textOverlay,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'annId': annId,
        'stickerId': stickerId,
        'draftText': draftText,
        'snippet': snippet,
        'savedAt': savedAt,
        if (textOverlay != null) 'textOverlay': textOverlay!.toJson(),
      };

  factory ReviewArchiveStickerItem.fromJson(Map<String, dynamic> json) {
    final overlayRaw = json['textOverlay'];
    return ReviewArchiveStickerItem(
      id: json['id']?.toString() ?? '',
      annId: json['annId']?.toString() ?? '',
      stickerId: json['stickerId']?.toString() ?? 'stk-journal-01',
      draftText: json['draftText']?.toString() ?? '',
      snippet: json['snippet']?.toString() ?? '',
      savedAt: (json['savedAt'] as num?)?.toInt() ?? 0,
      textOverlay: overlayRaw is Map<String, dynamic>
          ? StickerTextStyle.fromJson(overlayRaw)
          : (overlayRaw is Map
              ? StickerTextStyle.fromJson(Map<String, dynamic>.from(overlayRaw))
              : null),
    );
  }
}

class ReviewDraftEntry {
  const ReviewDraftEntry({
    required this.annId,
    required this.text,
    required this.updatedAt,
  });

  final String annId;
  final String text;
  final int updatedAt;

  Map<String, dynamic> toJson() => {
        'annId': annId,
        'text': text,
        'updatedAt': updatedAt,
      };

  factory ReviewDraftEntry.fromJson(Map<String, dynamic> json) {
    return ReviewDraftEntry(
      annId: json['annId']?.toString() ?? '',
      text: json['text']?.toString() ?? '',
      updatedAt: (json['updatedAt'] as num?)?.toInt() ?? 0,
    );
  }
}

const List<ReviewStickerDef> kDefaultBasicStickers = [
  ReviewStickerDef(
    id: 'stk-star',
    label: '核心论点',
    labelEn: 'Key Claim',
    emoji: '⭐',
    color: '#f59e0b',
    category: StickerCategory.basic,
  ),
  ReviewStickerDef(
    id: 'stk-check',
    label: '待核实',
    labelEn: 'Verify',
    emoji: '🔍',
    color: '#3b82f6',
    category: StickerCategory.basic,
  ),
  ReviewStickerDef(
    id: 'stk-spark',
    label: '润色灵感',
    labelEn: 'Polish',
    emoji: '✨',
    color: '#8b5cf6',
    category: StickerCategory.basic,
  ),
  ReviewStickerDef(
    id: 'stk-alert',
    label: '数据存疑',
    labelEn: 'Check Data',
    emoji: '📌',
    color: '#ef4444',
    category: StickerCategory.basic,
  ),
  ReviewStickerDef(
    id: 'stk-done',
    label: '已定稿',
    labelEn: 'Finalized',
    emoji: '🌿',
    color: '#10b981',
    category: StickerCategory.basic,
  ),
  ReviewStickerDef(
    id: 'stk-kraft',
    label: '牛皮手帐',
    labelEn: 'Kraft Tag',
    emoji: '🏷️',
    color: '#b45309',
    category: StickerCategory.basic,
  ),
  ReviewStickerDef(
    id: 'stk-washi-sakura',
    label: '樱花胶带',
    labelEn: 'Sakura Tape',
    emoji: '🌸',
    color: '#ec4899',
    category: StickerCategory.basic,
  ),
  ReviewStickerDef(
    id: 'stk-washi-grid',
    label: '格纹纸条',
    labelEn: 'Grid Strip',
    emoji: '📎',
    color: '#0d9488',
    category: StickerCategory.basic,
  ),
  ReviewStickerDef(
    id: 'stk-wax',
    label: '火漆印章',
    labelEn: 'Wax Seal',
    emoji: '🕯️',
    color: '#b91c1c',
    category: StickerCategory.basic,
  ),
  ReviewStickerDef(
    id: 'stk-stamp',
    label: '复古邮票',
    labelEn: 'Vintage Stamp',
    emoji: '📮',
    color: '#6366f1',
    category: StickerCategory.basic,
  ),
];

class _JournalSpec {
  const _JournalSpec(
    this.num,
    this.label,
    this.labelEn,
    this.color, {
    this.textColor = '#2c2623',
    this.strokeColor = '#ffffff',
    this.textInset = const [16, 14, 16, 14],
  });

  final int num;
  final String label;
  final String labelEn;
  final String color;
  final String textColor;
  final String strokeColor;
  final List<double> textInset;
}

const List<_JournalSpec> _kJournalSpecs = [
  _JournalSpec(1, '绳结米白吊牌', 'Twine Cream Tag', '#d6cfc2', textColor: '#3a332c', textInset: [16, 8, 16, 28]),
  _JournalSpec(2, '淡紫锯齿票券', 'Lilac Ticket', '#b8a3d1', textColor: '#36274a', textInset: [16, 22, 16, 12]),
  _JournalSpec(3, '黑底条码票签', 'Black Barcode Tag', '#27272a', textColor: '#f8fafc', strokeColor: '#09090b', textInset: [16, 24, 16, 12]),
  _JournalSpec(4, '灰绿胶囊长条', 'Sage Pill Label', '#9ab0a1', textColor: '#24352a', textInset: [16, 18, 16, 18]),
  _JournalSpec(5, '米白波浪异形条', 'Wavy Cream Strip', '#d8d4ce', textColor: '#33312e', textInset: [20, 16, 20, 16]),
  _JournalSpec(6, '光影米白票券', 'Shadow Cream Ticket', '#d1ccc4', textColor: '#34302b', textInset: [14, 22, 14, 12]),
  _JournalSpec(7, '云朵撕边长条', 'Cloud Torn Strip', '#8fa0b0', textColor: '#1e293b', textInset: [16, 10, 16, 44]),
  _JournalSpec(8, '黑底挂绳细条', 'Black Cord Tag', '#1f2937', textColor: '#f8fafc', strokeColor: '#0f172a', textInset: [10, 22, 44, 10]),
  _JournalSpec(9, '米白条码票签', 'Cream Barcode Ticket', '#d9d2c5', textColor: '#332d26', textInset: [14, 10, 14, 26]),
  _JournalSpec(10, '复古邮戳信笺条', 'Vintage Postal Card', '#6b8299', textColor: '#253240', textInset: [24, 14, 16, 12]),
  _JournalSpec(11, '复古粉雕花长条', 'Vintage Rose Strip', '#c98e89', textColor: '#4a2320', textInset: [18, 16, 18, 16]),
  _JournalSpec(12, '雾蓝鸢尾长条', 'Misty Blue Iris', '#8ea6b8', textColor: '#213442', textInset: [18, 16, 18, 16]),
  _JournalSpec(13, '复古黄包裹票券', 'Parcel Cream Ticket', '#d9be82', textColor: '#453414', textInset: [22, 22, 14, 12]),
  _JournalSpec(14, '灰绿复古细胶囊', 'Vintage Sage Pill', '#9ca894', textColor: '#293324', textInset: [18, 18, 18, 18]),
  _JournalSpec(15, '砖红燕尾丝带条', 'Terracotta Ribbon', '#be8376', textColor: '#3f1e18', textInset: [18, 22, 18, 22]),
  _JournalSpec(16, '雾蓝切角长条', 'Slate Chamfer Tag', '#849ca6', textColor: '#1f3038', textInset: [16, 14, 16, 14]),
  _JournalSpec(17, '米白红框邮波条', 'Crimson Wave Frame', '#b87676', textColor: '#3f2222', textInset: [18, 16, 18, 16]),
  _JournalSpec(18, '蜜桃虚线胶囊条', 'Peach Stitch Pill', '#d9a491', textColor: '#4a291e', textInset: [18, 18, 18, 18]),
  _JournalSpec(19, '米白双线长条', 'Double-Line Cream', '#d6cfc4', textColor: '#2e2923', textInset: [16, 12, 16, 12]),
  _JournalSpec(20, '樱粉细长雕花条', 'Sakura Ornate Bar', '#cfa0ae', textColor: '#47222d', textInset: [18, 16, 18, 16]),
  _JournalSpec(21, '奶茶内切角长条', 'Milk Tea Bracket', '#c9b79c', textColor: '#3d301e', textInset: [18, 16, 18, 16]),
  _JournalSpec(22, '米白电影票券', 'Cream Cinema Ticket', '#d8d0c1', textColor: '#332d22', textInset: [16, 18, 16, 18]),
  _JournalSpec(23, '酒红雕花票签', 'Burgundy Ornate Tag', '#8a3c48', textColor: '#fdf2f4', strokeColor: '#45121b', textInset: [18, 16, 18, 16]),
  _JournalSpec(24, '抹茶双联票券', 'Matcha Stub Ticket', '#9ca691', textColor: '#252e1e', textInset: [16, 26, 16, 12]),
  _JournalSpec(25, '米白齿边徽章票', 'Stamp Edge Ticket', '#d4c8b4', textColor: '#382e1e', textInset: [16, 14, 16, 18]),
  _JournalSpec(26, '灰蓝切角标签', 'Steel Blue Frame', '#8e9ca8', textColor: '#1f2933', textInset: [16, 14, 16, 14]),
  _JournalSpec(27, '米白花角标签', 'Floral Corner Tag', '#d6ccb8', textColor: '#362d1e', textInset: [18, 14, 18, 14]),
  _JournalSpec(28, '浅绿花卉标签', 'Botanical Sage Tag', '#a5b09c', textColor: '#263020', textInset: [16, 12, 16, 22]),
  _JournalSpec(29, '牛皮焦糖花框条', 'Caramel Kraft Tag', '#a67c52', textColor: '#fffbeb', strokeColor: '#45270e', textInset: [16, 14, 16, 14]),
  _JournalSpec(30, '极简米灰细线条', 'Minimal Greige Strip', '#c9c6c0', textColor: '#2e2c29', textInset: [16, 12, 16, 12]),
  _JournalSpec(31, '蓝边水波纹长条', 'Blue Wave Label', '#6b88a8', textColor: '#1e324a', textInset: [18, 14, 18, 14]),
  _JournalSpec(32, '粉红爱心细长条', 'Blush Heart Bar', '#d6a3a6', textColor: '#4a2124', textInset: [18, 22, 18, 12]),
  _JournalSpec(33, '淡紫便签横条', 'Lavender Ruled Strip', '#b9acc7', textColor: '#31263d', textInset: [16, 24, 16, 12]),
  _JournalSpec(34, '淡紫胶囊长条', 'Lavender Pill Strip', '#c4b8cc', textColor: '#352a3d', textInset: [18, 18, 18, 18]),
  _JournalSpec(35, '雾蓝方点长条', 'Powder Blue Dots', '#a3b5c4', textColor: '#1f3140', textInset: [18, 16, 18, 16]),
  _JournalSpec(36, '米白蓝框细条', 'Blue-Trimmed Strip', '#7a95b0', textColor: '#1e3247', textInset: [18, 20, 18, 12]),
  _JournalSpec(37, '雾蓝双边水波条', 'Sky Border Wave', '#9ab0c4', textColor: '#1e3245', textInset: [18, 14, 18, 14]),
  _JournalSpec(38, '蜜桃锯齿票券', 'Peach Ticket Stub', '#d4a39e', textColor: '#45221e', textInset: [16, 18, 16, 18]),
  _JournalSpec(39, '浅蓝虚线胶囊条', 'Ice Blue Stitch Pill', '#b2c0c9', textColor: '#22313b', textInset: [18, 18, 18, 18]),
  _JournalSpec(40, '粉红叠层长条', 'Layered Rose Ticket', '#c98c96', textColor: '#421e25', textInset: [18, 18, 18, 16]),
];

final List<ReviewStickerDef> kJournalStripStickers = _kJournalSpecs.map((spec) {
  final numStr = spec.num.toString().padLeft(2, '0');
  return ReviewStickerDef(
    id: 'stk-journal-$numStr',
    label: spec.label,
    labelEn: spec.labelEn,
    color: spec.color,
    category: StickerCategory.journal,
    assetPath: 'assets/stickers/journal/journal-$numStr.png',
    isStripImage: true,
    defaultTextColor: spec.textColor,
    defaultStrokeColor: spec.strokeColor,
    textInset: spec.textInset,
  );
}).toList(growable: false);

StickerCategory getStickerCategory(ReviewStickerDef sticker) {
  if (sticker.category != null) return sticker.category!;
  if (sticker.isCustom) return StickerCategory.custom;
  if (sticker.id.startsWith('stk-journal-')) return StickerCategory.journal;
  return StickerCategory.basic;
}

bool isStripImageSticker(ReviewStickerDef? sticker) {
  if (sticker == null) return false;
  return sticker.isStripImage ||
      (sticker.assetPath != null && sticker.assetPath!.isNotEmpty) ||
      (sticker.pngDataUrl != null && sticker.pngDataUrl!.isNotEmpty);
}

StickerTextStyle createDefaultStickerTextStyle(
  ReviewStickerDef? sticker, [
  String initialText = '',
]) {
  if (sticker?.defaultTextStyle != null) {
    final base = sticker!.defaultTextStyle!;
    return base.copyWith(text: initialText.isNotEmpty ? initialText : base.text);
  }
  return StickerTextStyle(
    text: initialText,
    fontFamily: StickerFontPreset.defaultSans,
    customFontName: '',
    fontSize: 12.0,
    bold: true,
    italic: false,
    underline: false,
    letterSpacing: 0.5,
    color: sticker?.defaultTextColor ?? '#2c2623',
    strokeEnabled: false,
    strokeColor: sticker?.defaultStrokeColor ?? '#ffffff',
    strokeWidth: 1.5,
    shadow: StickerTextShadow.none,
  );
}

StickerTextStyle getEffectiveStickerTextStyle(
  ReviewStickerDef? sticker,
  ReviewArchiveStickerItem? archiveItem,
) {
  if (archiveItem?.textOverlay != null) {
    return archiveItem!.textOverlay!;
  }
  if (sticker?.defaultTextStyle != null) {
    return sticker!.defaultTextStyle!;
  }
  final fallback = archiveItem?.draftText ?? '';
  final clipped = fallback.length > 18 ? fallback.substring(0, 18) : fallback;
  return createDefaultStickerTextStyle(sticker, clipped);
}

final Map<String, Uint8List> _decodedStickerPngCache = <String, Uint8List>{};

Uint8List? decodeStickerPngBytes(String? pngDataUrl) {
  if (pngDataUrl == null || pngDataUrl.isEmpty) return null;
  final cached = _decodedStickerPngCache[pngDataUrl];
  if (cached != null) return cached;
  try {
    final commaIdx = pngDataUrl.indexOf(',');
    final b64 = commaIdx >= 0 ? pngDataUrl.substring(commaIdx + 1) : pngDataUrl;
    final bytes = base64Decode(b64.trim());
    if (_decodedStickerPngCache.length > 64) {
      _decodedStickerPngCache.clear();
    }
    _decodedStickerPngCache[pngDataUrl] = bytes;
    return bytes;
  } catch (_) {
    return null;
  }
}

class ReviewStickerStore {
  ReviewStickerStore._();

  static const String customStickersStorageKey = 'arcvault_rev_custom_stickers_v1';
  static String archiveStickersKey(String docId) => 'arcvault_rev_archive_stickers_v1_$docId';
  static String draftsKey(String docId) => 'arcvault_rev_drafts_v1_$docId';

  static Future<List<ReviewStickerDef>> loadCustomStickers() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getString(customStickersStorageKey);
      if (raw == null || raw.isEmpty) return [];
      final decoded = jsonDecode(raw);
      if (decoded is! List) return [];
      return decoded
          .whereType<Map>()
          .map((e) => ReviewStickerDef.fromJson(Map<String, dynamic>.from(e)))
          .toList();
    } catch (_) {
      return [];
    }
  }

  static Future<void> saveCustomStickers(List<ReviewStickerDef> stickers) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final raw = jsonEncode(stickers.map((s) => s.toJson()).toList());
      await prefs.setString(customStickersStorageKey, raw);
    } catch (_) {
      // ignore storage quota errors
    }
  }

  static Future<List<ReviewArchiveStickerItem>> loadDocArchiveStickers(String docId) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getString(archiveStickersKey(docId));
      if (raw == null || raw.isEmpty) return [];
      final decoded = jsonDecode(raw);
      if (decoded is! List) return [];
      return decoded
          .whereType<Map>()
          .map((e) => ReviewArchiveStickerItem.fromJson(Map<String, dynamic>.from(e)))
          .toList();
    } catch (_) {
      return [];
    }
  }

  static Future<void> saveDocArchiveStickers(
    String docId,
    List<ReviewArchiveStickerItem> items,
  ) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final raw = jsonEncode(items.map((s) => s.toJson()).toList());
      await prefs.setString(archiveStickersKey(docId), raw);
    } catch (_) {
      // ignore storage quota errors
    }
  }

  static Future<Map<String, ReviewDraftEntry>> loadDocReviewDrafts(String docId) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getString(draftsKey(docId));
      if (raw == null || raw.isEmpty) return {};
      final decoded = jsonDecode(raw);
      if (decoded is! Map) return {};
      final out = <String, ReviewDraftEntry>{};
      decoded.forEach((k, v) {
        if (v is Map) {
          out[k.toString()] = ReviewDraftEntry.fromJson(Map<String, dynamic>.from(v));
        }
      });
      return out;
    } catch (_) {
      return {};
    }
  }

  static Future<void> saveDocReviewDrafts(
    String docId,
    Map<String, ReviewDraftEntry> drafts,
  ) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final mapped = drafts.map((k, v) => MapEntry(k, v.toJson()));
      await prefs.setString(draftsKey(docId), jsonEncode(mapped));
    } catch (_) {
      // ignore storage quota errors
    }
  }
}
