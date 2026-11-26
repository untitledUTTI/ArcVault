import 'dart:io';

import 'package:flutter/material.dart';
import 'package:image/image.dart' as img;
import 'package:image_picker/image_picker.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/academic_engines.dart';
import '../../core/open_source_licenses.dart';
import '../../i18n/dictionaries.dart';
import '../../models/archive_models.dart';
import '../../state/app_controller.dart';
import '../../theme/arc_theme.dart';
import '../../theme/liquid_glass_surface.dart';
import '../../theme/monet_engine.dart';
import '../arc_vault_logo.dart';

enum SettingsTab { appearance, typography, archive, device, ai, about }

class SettingsModal extends StatefulWidget {
  const SettingsModal({
    super.key,
    required this.controller,
    this.initialTab = SettingsTab.appearance,
    required this.onOpenSync,
  });

  final AppController controller;
  final SettingsTab initialTab;
  final VoidCallback onOpenSync;

  @override
  State<SettingsModal> createState() => _SettingsModalState();
}

class _SettingsModalState extends State<SettingsModal> {
  late SettingsTab _tab = widget.initialTab;
  bool _testingAi = false;
  String? _aiTestResult;

  @override
  Widget build(BuildContext context) {
    final t = context.arcTheme;
    final c = widget.controller;
    final s = c.settings;
    final d = ArcStrings.of(s.locale);
    final isZh = s.locale.isZh;
    final mq = MediaQuery.of(context);

    // STRICT SCOPE: Only show preview dock inside Settings -> Appearance when Liquid Glass
    // is active and the preview switch is enabled.
    final showLiquidPreviewDock = _tab == SettingsTab.appearance &&
        s.theme == MobileThemeId.liquidGlass &&
        s.liquidGlass.previewBarEnabled;

    return Scaffold(
      backgroundColor: Colors.transparent,
      body: Stack(
        children: [
          if (t.isLiquidGlass)
            Positioned.fill(
              child: ArcLiquidGlassBackdrop(settings: s.liquidGlass),
            )
          else
            Positioned.fill(child: Container(color: t.bgApp)),
          Column(
            children: [
              // Immersive Top Header
              Container(
                padding: EdgeInsets.fromLTRB(12, mq.padding.top + 8, 8, 10),
                decoration: BoxDecoration(
                  color: t.isLiquidGlass ? t.bgSurface.withValues(alpha: 0.45) : t.bgSurface,
                  border: Border(bottom: BorderSide(color: t.borderSubtle)),
                ),
                child: Row(
                  children: [
                    ArcVaultLogo(size: 24, themeId: s.theme),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        d.settingsTitle,
                        style: TextStyle(
                            fontSize: 15, fontWeight: FontWeight.w700, color: t.textPrimary),
                      ),
                    ),
                    TextButton(
                      onPressed: () => Navigator.of(context).pop(),
                      child: Text(d.done, style: TextStyle(color: t.accent, fontWeight: FontWeight.w700)),
                    ),
                  ],
                ),
              ),

              // Horizontal Tab Bar
              Container(
                height: 46,
                decoration: BoxDecoration(
                  color: t.isLiquidGlass ? t.bgSurface.withValues(alpha: 0.32) : t.bgSurface,
                  border: Border(bottom: BorderSide(color: t.borderSubtle)),
                ),
                child: ListView(
                  scrollDirection: Axis.horizontal,
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  children: [
                    _tabChip(SettingsTab.appearance, LucideIcons.palette, isZh ? '外观与主题' : 'Themes'),
                    _tabChip(SettingsTab.typography, LucideIcons.type, isZh ? '字体排版' : 'Typography'),
                    _tabChip(SettingsTab.archive, LucideIcons.folderCog, isZh ? '目录与归档' : 'Archive'),
                    _tabChip(SettingsTab.device, LucideIcons.smartphone, isZh ? '触控与多端' : 'Touch & Sync'),
                    _tabChip(SettingsTab.ai, LucideIcons.cpu, isZh ? 'AI 与 Skills' : 'AI & Skills'),
                    _tabChip(SettingsTab.about, LucideIcons.info, isZh ? '关于穹档' : 'About'),
                  ],
                ),
              ),

              // Body Content
              Expanded(
                child: ListView(
                  padding: EdgeInsets.fromLTRB(
                    14,
                    14,
                    14,
                    (showLiquidPreviewDock ? 96 : 24) + mq.padding.bottom,
                  ),
                  children: [
                    if (_tab == SettingsTab.appearance) ..._buildAppearanceTab(c, s, d, t, isZh),
                    if (_tab == SettingsTab.typography) ..._buildTypographyTab(c, s, t, isZh),
                    if (_tab == SettingsTab.archive) ..._buildArchiveTab(c, s, t, isZh),
                    if (_tab == SettingsTab.device) ..._buildDeviceTab(c, s, t, isZh),
                    if (_tab == SettingsTab.ai) ..._buildAiTab(c, s, t, isZh),
                    if (_tab == SettingsTab.about) ..._buildAboutTab(t, isZh),
                  ],
                ),
              ),
            ],
          ),

          // Preview Liquid Glass Bottom Dock (ONLY inside Settings -> Appearance!)
          if (showLiquidPreviewDock)
            Positioned(
              left: 16,
              right: 16,
              bottom: mq.padding.bottom + 12,
              child: LiquidGlassPreviewDock(
                settings: s.liquidGlass,
                isZh: isZh,
                onTapTab: () => c.triggerHaptic(HapticPattern.selection),
              ),
            ),
        ],
      ),
    );
  }

  Widget _tabChip(SettingsTab tab, IconData icon, String label) {
    final t = context.arcTheme;
    final active = _tab == tab;
    return Padding(
      padding: const EdgeInsets.only(right: 6),
      child: InkWell(
        onTap: () {
          widget.controller.triggerHaptic(HapticPattern.selection);
          setState(() => _tab = tab);
        },
        borderRadius: BorderRadius.circular(14),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 5),
          decoration: BoxDecoration(
            color: active ? t.accentSoft : Colors.transparent,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: active ? t.accent : t.borderSubtle),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, size: 13.5, color: active ? t.accent : t.textSecondary),
              const SizedBox(width: 5),
              Text(
                label,
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: active ? FontWeight.w700 : FontWeight.w500,
                  color: active ? t.accent : t.textPrimary,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  List<Widget> _buildAppearanceTab(
    AppController c,
    AppSettingsModel s,
    ArcStrings d,
    ArcThemeTokens t,
    bool isZh,
  ) {
    const themes = [
      MobileThemeId.light,
      MobileThemeId.dark,
      MobileThemeId.paper,
      MobileThemeId.m3Expressive,
      MobileThemeId.liquidGlass,
    ];

    return [
      ArcFrostedCardSurface(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    isZh ? '预设界面主题（5 套移动引擎）' : 'Mobile Interface Themes (5)',
                    style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14, color: t.textPrimary),
                  ),
                ),
                Text(
                  isZh ? '实时沉浸状态栏' : 'Immersive Status Bar',
                  style: TextStyle(fontSize: 11, color: t.accent, fontWeight: FontWeight.w600),
                ),
              ],
            ),
            const SizedBox(height: 10),
            ...themes.map((id) {
              final active = s.theme == id;
              return Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: InkWell(
                  onTap: () {
                    c.triggerHaptic(HapticPattern.selection);
                    c.updateSettings(s.copyWith(theme: id));
                  },
                  borderRadius: BorderRadius.circular(12),
                  child: Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: active ? t.accentSoft : t.bgSubtle.withValues(alpha: 0.45),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                        color: active ? t.accent : t.borderSubtle,
                        width: active ? 1.5 : 1.0,
                      ),
                    ),
                    child: Row(
                      children: [
                        _ThemeSwatchWidget(
                          themeId: id,
                          isLiquidDark: s.liquidGlass.isDark,
                          monetSeed: MonetEngine.parseHexArgb(s.monet.seedColor),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                d.themeName(id),
                                style: TextStyle(
                                  fontWeight: FontWeight.w700,
                                  fontSize: 13,
                                  color: t.textPrimary,
                                ),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                d.themeDesc(id),
                                style: TextStyle(fontSize: 11.5, color: t.textMuted),
                              ),
                            ],
                          ),
                        ),
                        if (active) Icon(LucideIcons.check, size: 17, color: t.accent),
                      ],
                    ),
                  ),
                ),
              );
            }),
          ],
        ),
      ),

      // Liquid Glass Theme Console
      if (s.theme == MobileThemeId.liquidGlass) ...[
        const SizedBox(height: 12),
        ArcFrostedCardSurface(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(LucideIcons.droplets, size: 16, color: t.accent),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      isZh ? '液态玻璃光学引擎控制台' : 'Liquid Glass Optical Console',
                      style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14, color: t.textPrimary),
                    ),
                  ),
                  Switch(
                    value: s.liquidGlass.isDark,
                    onChanged: (v) => c.updateSettings(
                      s.copyWith(liquidGlass: s.liquidGlass.copyWith(isDark: v)),
                    ),
                  ),
                  Text(s.liquidGlass.isDark ? (isZh ? '深色' : 'Dark') : (isZh ? '浅色' : 'Light'),
                      style: TextStyle(fontSize: 11.5, color: t.textSecondary)),
                ],
              ),
              const SizedBox(height: 8),
              // Preview Bottom Bar Toggle
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(
                  color: t.accentSoft,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: t.accent.withValues(alpha: 0.35)),
                ),
                child: Row(
                  children: [
                    Icon(LucideIcons.panelBottom, size: 15, color: t.accent),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            isZh ? '液态玻璃预览底栏开关' : 'Preview Floating Dock',
                            style: TextStyle(
                                fontWeight: FontWeight.w700, fontSize: 12.5, color: t.textPrimary),
                          ),
                          Text(
                            isZh
                                ? '开启后仅在当前「外观与主题」下方悬浮绘制，实时观察调参折射'
                                : 'Shown only below this Appearance page to inspect glass tuning live',
                            style: TextStyle(fontSize: 11, color: t.textSecondary),
                          ),
                        ],
                      ),
                    ),
                    Switch(
                      value: s.liquidGlass.previewBarEnabled,
                      onChanged: (v) {
                        c.triggerHaptic(HapticPattern.selection);
                        c.updateSettings(
                          s.copyWith(liquidGlass: s.liquidGlass.copyWith(previewBarEnabled: v)),
                        );
                      },
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 10),
              // Presets
              Text(isZh ? '一键质感预设' : 'Quick Optical Presets',
                  style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: t.textSecondary)),
              const SizedBox(height: 6),
              Wrap(
                spacing: 8,
                children: [
                  _presetBtn(c, s, LiquidGlassPreset.crystal, isZh ? '通透水晶' : 'Crystal'),
                  _presetBtn(c, s, LiquidGlassPreset.frosted, isZh ? '细沙磨砂' : 'Frosted'),
                  _presetBtn(c, s, LiquidGlassPreset.soft, isZh ? '柔和清透' : 'Soft'),
                ],
              ),
              const SizedBox(height: 12),
              // Backdrop & Custom Wallpaper
              Text(isZh ? '流动渐变底景 / 自定义壁纸' : 'Flowing Backdrop & Wallpaper',
                  style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: t.textSecondary)),
              const SizedBox(height: 6),
              Wrap(
                spacing: 8,
                runSpacing: 6,
                children: [
                  for (final bp in LiquidGlassBackdropPreset.values)
                    ChoiceChip(
                      label: Text(_backdropLabel(bp, isZh), style: const TextStyle(fontSize: 11.5)),
                      selected: s.liquidGlass.customWallpaperPath == null &&
                          s.liquidGlass.backdropPreset == bp,
                      onSelected: (_) => c.updateSettings(s.copyWith(
                        liquidGlass:
                            s.liquidGlass.copyWith(backdropPreset: bp, clearWallpaper: true),
                      )),
                    ),
                  ActionChip(
                    avatar: const Icon(LucideIcons.imagePlus, size: 14),
                    label: Text(isZh ? '导入自定义壁纸' : 'Custom Wallpaper',
                        style: const TextStyle(fontSize: 11.5)),
                    onPressed: c.pickLiquidGlassWallpaper,
                  ),
                  if (s.liquidGlass.customWallpaperPath != null)
                    ActionChip(
                      avatar: const Icon(LucideIcons.x, size: 14),
                      label: Text(isZh ? '清除壁纸' : 'Clear', style: const TextStyle(fontSize: 11.5)),
                      onPressed: () => c.updateSettings(s.copyWith(
                        liquidGlass: s.liquidGlass.copyWith(clearWallpaper: true),
                      )),
                    ),
                ],
              ),
              const SizedBox(height: 12),
              // Parameter Sliders
              _sliderRow(
                label: isZh ? '背景模糊度 (Blur)' : 'Blur',
                valueLabel: s.liquidGlass.blur.toStringAsFixed(1),
                value: s.liquidGlass.blur,
                min: 0,
                max: 28,
                onChanged: (v) => c.updateSettings(
                  s.copyWith(liquidGlass: s.liquidGlass.copyWith(blur: v)),
                ),
              ),
              _sliderRow(
                label: isZh ? '折射厚度 (Thickness)' : 'Refraction Thickness',
                valueLabel: s.liquidGlass.thickness.toStringAsFixed(1),
                value: s.liquidGlass.thickness,
                min: 6,
                max: 45,
                onChanged: (v) => c.updateSettings(
                  s.copyWith(liquidGlass: s.liquidGlass.copyWith(thickness: v)),
                ),
              ),
              _sliderRow(
                label: isZh ? '边缘色散强度 (Dispersion)' : 'Chromatic Dispersion',
                valueLabel: s.liquidGlass.chromaticAberration.toStringAsFixed(3),
                value: s.liquidGlass.chromaticAberration,
                min: 0,
                max: 0.04,
                onChanged: (v) => c.updateSettings(
                  s.copyWith(liquidGlass: s.liquidGlass.copyWith(chromaticAberration: v)),
                ),
              ),
              _sliderRow(
                label: isZh ? '玻璃着色透明度 (Tint Opacity)' : 'Tint Opacity',
                valueLabel: '${(s.liquidGlass.tintOpacity * 100).round()}%',
                value: s.liquidGlass.tintOpacity,
                min: 0.04,
                max: 0.55,
                onChanged: (v) => c.updateSettings(
                  s.copyWith(liquidGlass: s.liquidGlass.copyWith(tintOpacity: v)),
                ),
              ),
              _sliderRow(
                label: isZh ? '色彩饱和度 (Saturation)' : 'Saturation',
                valueLabel: '${(s.liquidGlass.saturation * 100).round()}%',
                value: s.liquidGlass.saturation,
                min: 0.6,
                max: 1.8,
                onChanged: (v) => c.updateSettings(
                  s.copyWith(liquidGlass: s.liquidGlass.copyWith(saturation: v)),
                ),
              ),
              _sliderRow(
                label: isZh ? '高光反射强度 (Light Intensity)' : 'Highlight Intensity',
                valueLabel: s.liquidGlass.lightIntensity.toStringAsFixed(2),
                value: s.liquidGlass.lightIntensity,
                min: 0,
                max: 1.5,
                onChanged: (v) => c.updateSettings(
                  s.copyWith(liquidGlass: s.liquidGlass.copyWith(lightIntensity: v)),
                ),
              ),
              SwitchListTile(
                dense: true,
                contentPadding: EdgeInsets.zero,
                title: Text(
                  isZh ? '兼容 / 省电降级渲染模式' : 'Compatibility / Eco Fallback Mode',
                  style: TextStyle(fontSize: 12.5, color: t.textPrimary),
                ),
                subtitle: Text(
                  isZh ? '低端机型或非 Impeller 环境可开启以降低 GPU 开销' : 'Lower GPU load on older devices',
                  style: TextStyle(fontSize: 11, color: t.textMuted),
                ),
                value: s.liquidGlass.compatibilityMode,
                onChanged: (v) => c.updateSettings(
                  s.copyWith(liquidGlass: s.liquidGlass.copyWith(compatibilityMode: v)),
                ),
              ),
            ],
          ),
        ),
      ],

      // Monet Console for M3 Expressive
      if (s.theme == MobileThemeId.m3Expressive) ...[
        const SizedBox(height: 12),
        ArcFrostedCardSurface(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(LucideIcons.wand2, size: 16, color: t.accent),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      isZh ? 'M3 Expressive · 莫奈动态取色引擎' : 'Monet Dynamic Color Engine',
                      style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14, color: t.textPrimary),
                    ),
                  ),
                  Switch(
                    value: s.monet.isDark,
                    onChanged: (v) => c.updateSettings(
                      s.copyWith(monet: s.monet.copyWith(isDark: v)),
                    ),
                  ),
                  Text(s.monet.isDark ? (isZh ? '深色' : 'Dark') : (isZh ? '浅色' : 'Light'),
                      style: TextStyle(fontSize: 11.5, color: t.textSecondary)),
                ],
              ),
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  for (final seed in MonetEngine.curatedSeeds)
                    InkWell(
                      onTap: () => c.updateSettings(
                        s.copyWith(monet: s.monet.copyWith(seedColor: seed.hex)),
                      ),
                      child: Container(
                        width: 28,
                        height: 28,
                        decoration: BoxDecoration(
                          color: Color(MonetEngine.parseHexArgb(seed.hex)),
                          shape: BoxShape.circle,
                          border: Border.all(
                            color: s.monet.seedColor.toLowerCase() == seed.hex.toLowerCase()
                                ? t.textPrimary
                                : Colors.white,
                            width: 2,
                          ),
                        ),
                      ),
                    ),
                  ActionChip(
                    avatar: const Icon(LucideIcons.imagePlus, size: 14),
                    label: Text(isZh ? '从图片提取取色' : 'Extract from Image',
                        style: const TextStyle(fontSize: 11.5)),
                    onPressed: () => _pickWallpaperSeedForMonet(c, s),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              Wrap(
                spacing: 6,
                runSpacing: 6,
                children: MonetEngine.styles
                    .map((st) => ChoiceChip(
                          label: Text(isZh ? st.nameZh : st.nameEn, style: const TextStyle(fontSize: 11.5)),
                          selected: s.monet.style == st.id,
                          onSelected: (_) => c.updateSettings(
                            s.copyWith(monet: s.monet.copyWith(style: st.id)),
                          ),
                        ))
                    .toList(),
              ),
            ],
          ),
        ),
      ],
    ];
  }

  Widget _presetBtn(AppController c, AppSettingsModel s, LiquidGlassPreset preset, String label) {
    return OutlinedButton(
      onPressed: () {
        c.triggerHaptic(HapticPattern.selection);
        c.updateSettings(s.copyWith(
          liquidGlass: LiquidGlassSettingsModel.fromPreset(
            preset,
            isDark: s.liquidGlass.isDark,
            backdropPreset: s.liquidGlass.backdropPreset,
            customWallpaperPath: s.liquidGlass.customWallpaperPath,
            compatibilityMode: s.liquidGlass.compatibilityMode,
            previewBarEnabled: s.liquidGlass.previewBarEnabled,
          ),
        ));
      },
      style: OutlinedButton.styleFrom(visualDensity: VisualDensity.compact),
      child: Text(label, style: const TextStyle(fontSize: 12)),
    );
  }

  String _backdropLabel(LiquidGlassBackdropPreset bp, bool isZh) {
    switch (bp) {
      case LiquidGlassBackdropPreset.auroraMist:
        return isZh ? '极光蓝紫' : 'Aurora Mist';
      case LiquidGlassBackdropPreset.prismDusk:
        return isZh ? '暮色棱镜' : 'Prism Dusk';
      case LiquidGlassBackdropPreset.oceanSilk:
        return isZh ? '碧海流光' : 'Ocean Silk';
      case LiquidGlassBackdropPreset.warmAmber:
        return isZh ? '暖阳琥珀' : 'Warm Amber';
    }
  }

  Future<void> _pickWallpaperSeedForMonet(AppController c, AppSettingsModel s) async {
    final xfile = await ImagePicker().pickImage(source: ImageSource.gallery, maxWidth: 256);
    if (xfile == null) return;
    final bytes = await File(xfile.path).readAsBytes();
    final decoded = img.decodeImage(bytes);
    if (decoded == null) return;
    final argbPixels = <int>[];
    for (var y = 0; y < decoded.height; y += 2) {
      for (var x = 0; x < decoded.width; x += 2) {
        final p = decoded.getPixel(x, y);
        final a = p.a.toInt();
        final r = p.r.toInt();
        final g = p.g.toInt();
        final b = p.b.toInt();
        argbPixels.add((a << 24) | (r << 16) | (g << 8) | b);
      }
    }
    final seeds = await MonetEngine.extractSeedsFromRgbaPixels(argbPixels);
    if (seeds.isNotEmpty) {
      await c.updateSettings(s.copyWith(
        monet: s.monet.copyWith(seedColor: seeds.first, extractedSeeds: seeds),
      ));
      c.showToast('已从壁纸提取莫奈主题色 ${seeds.first}');
    }
  }

  List<Widget> _buildTypographyTab(AppController c, AppSettingsModel s, ArcThemeTokens t, bool isZh) {
    return [
      ArcFrostedCardSurface(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(isZh ? '正文编辑器排版' : 'Editor Typography',
                style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14, color: t.textPrimary)),
            const SizedBox(height: 10),
            Wrap(
              spacing: 8,
              children: [
                for (final fp in EditorFontPreset.values)
                  ChoiceChip(
                    label: Text(fp.wire, style: const TextStyle(fontSize: 12)),
                    selected: s.typography.editorFontPreset == fp,
                    onSelected: (_) => c.updateSettings(
                      s.copyWith(typography: s.typography.copyWith(editorFontPreset: fp)),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 10),
            _sliderRow(
              label: isZh ? '正文字号 (px)' : 'Font Size',
              valueLabel: s.typography.editorFontSize.toStringAsFixed(1),
              value: s.typography.editorFontSize,
              min: 12,
              max: 22,
              onChanged: (v) => c.updateSettings(
                s.copyWith(typography: s.typography.copyWith(editorFontSize: v)),
              ),
            ),
            _sliderRow(
              label: isZh ? '行高 (Line Height)' : 'Line Height',
              valueLabel: s.typography.editorLineHeight.toStringAsFixed(2),
              value: s.typography.editorLineHeight,
              min: 1.3,
              max: 2.3,
              onChanged: (v) => c.updateSettings(
                s.copyWith(typography: s.typography.copyWith(editorLineHeight: v)),
              ),
            ),
          ],
        ),
      ),
    ];
  }

  List<Widget> _buildArchiveTab(AppController c, AppSettingsModel s, ArcThemeTokens t, bool isZh) {
    return [
      ArcFrostedCardSurface(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(isZh ? '自定义缓存目录与备份目录' : 'Custom Cache & Backup Directories',
                style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14, color: t.textPrimary)),
            const SizedBox(height: 8),
            Text('${isZh ? '当前缓存库目录：' : 'Vault Dir: '}${c.resolvedVaultDir}',
                style: TextStyle(fontSize: 12, color: t.textSecondary)),
            const SizedBox(height: 6),
            Text('${isZh ? '当前备份目录：' : 'Backup Dir: '}${c.resolvedBackupDir}',
                style: TextStyle(fontSize: 12, color: t.textSecondary)),
            if (c.lastBackupAt != null) ...[
              const SizedBox(height: 4),
              Text('${isZh ? '最近备份时间：' : 'Last Backup: '}${c.lastBackupAt}',
                  style: TextStyle(fontSize: 11, color: t.textMuted)),
            ],
            const SizedBox(height: 10),
            Wrap(
              spacing: 8,
              runSpacing: 6,
              children: [
                OutlinedButton.icon(
                  onPressed: () => c.pickCustomDirectory(forBackup: false),
                  icon: const Icon(LucideIcons.folderOpen, size: 14),
                  label: Text(isZh ? '更换缓存目录' : 'Change Vault Dir'),
                ),
                OutlinedButton.icon(
                  onPressed: () => c.pickCustomDirectory(forBackup: true),
                  icon: const Icon(LucideIcons.folderOpen, size: 14),
                  label: Text(isZh ? '更换备份目录' : 'Change Backup Dir'),
                ),
                FilledButton.icon(
                  onPressed: c.runManualBackup,
                  icon: const Icon(LucideIcons.save, size: 14),
                  label: Text(isZh ? '立即备份一次' : 'Backup Now'),
                  style: FilledButton.styleFrom(backgroundColor: t.accent, foregroundColor: t.accentText),
                ),
              ],
            ),
          ],
        ),
      ),
    ];
  }

  List<Widget> _buildDeviceTab(AppController c, AppSettingsModel s, ArcThemeTokens t, bool isZh) {
    return [
      ArcFrostedCardSurface(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(isZh ? 'TouchScrollScrubber 触控滚动手柄' : 'TouchScrollScrubber Handle',
                style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14, color: t.textPrimary)),
            _sliderRow(
              label: isZh ? '手柄尺寸 (px)' : 'Handle Size',
              valueLabel: '${s.scrollScrubber.size}px',
              value: s.scrollScrubber.size.toDouble(),
              min: 28,
              max: 60,
              onChanged: (v) => c.updateSettings(
                s.copyWith(scrollScrubber: s.scrollScrubber.copyWith(size: v.round())),
              ),
            ),
            Wrap(
              spacing: 6,
              children: [
                for (final sh in ScrollScrubberShape.values)
                  ChoiceChip(
                    label: Text(sh.wire, style: const TextStyle(fontSize: 11.5)),
                    selected: s.scrollScrubber.shape == sh,
                    onSelected: (_) => c.updateSettings(
                      s.copyWith(scrollScrubber: s.scrollScrubber.copyWith(shape: sh)),
                    ),
                  ),
              ],
            ),
            const Divider(height: 22),
            Text(isZh ? '触感震动反馈' : 'Haptic Feedback',
                style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14, color: t.textPrimary)),
            const SizedBox(height: 6),
            Wrap(
              spacing: 8,
              children: [
                for (final hi in HapticIntensity.values)
                  ChoiceChip(
                    label: Text(hi.wire, style: const TextStyle(fontSize: 12)),
                    selected: s.haptics.intensity == hi,
                    onSelected: (_) {
                      c.updateSettings(s.copyWith(
                        haptics: s.haptics.copyWith(intensity: hi, enabled: hi != HapticIntensity.off),
                      ));
                      c.triggerHaptic(HapticPattern.selection);
                    },
                  ),
              ],
            ),
            const Divider(height: 22),
            Wrap(
              spacing: 8,
              children: [
                OutlinedButton.icon(
                  onPressed: () {
                    Navigator.of(context).pop();
                    widget.onOpenSync();
                  },
                  icon: const Icon(LucideIcons.wifi, size: 14),
                  label: Text(isZh ? '打开 E2EE 多端同步' : 'Open E2EE Sync'),
                ),
                OutlinedButton.icon(
                  onPressed: () {
                    Navigator.of(context).pop();
                    c.openTutorialReplay();
                  },
                  icon: const Icon(LucideIcons.bookOpen, size: 14),
                  label: Text(isZh ? '重播互动使用教程' : 'Replay Tutorial'),
                ),
              ],
            ),
          ],
        ),
      ),
    ];
  }

  List<Widget> _buildAiTab(AppController c, AppSettingsModel s, ArcThemeTokens t, bool isZh) {
    return [
      ArcFrostedCardSurface(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(isZh ? 'AI 模型接入与网关' : 'AI Provider & Gateway',
                style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14, color: t.textPrimary)),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              children: [
                ChoiceChip(
                  label: Text(isZh ? '离线智能规则' : 'Offline Smart'),
                  selected: s.aiProvider == 'offline-smart',
                  onSelected: (_) => c.updateSettings(s.copyWith(aiProvider: 'offline-smart')),
                ),
                ChoiceChip(
                  label: const Text('Ollama (Local)'),
                  selected: s.aiProvider == 'ollama',
                  onSelected: (_) => c.updateSettings(s.copyWith(aiProvider: 'ollama')),
                ),
                ChoiceChip(
                  label: const Text('OpenAI Compatible'),
                  selected: s.aiProvider == 'openai-compatible',
                  onSelected: (_) => c.updateSettings(s.copyWith(aiProvider: 'openai-compatible')),
                ),
              ],
            ),
            if (s.aiProvider != 'offline-smart') ...[
              const SizedBox(height: 10),
              TextFormField(
                initialValue: s.aiEndpoint,
                onChanged: (v) => c.updateSettings(s.copyWith(aiEndpoint: v)),
                decoration: InputDecoration(
                  isDense: true,
                  labelText: 'Endpoint URL',
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                ),
              ),
              const SizedBox(height: 8),
              TextFormField(
                initialValue: s.aiModel,
                onChanged: (v) => c.updateSettings(s.copyWith(aiModel: v)),
                decoration: InputDecoration(
                  isDense: true,
                  labelText: 'Model Name',
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                ),
              ),
              if (s.aiProvider == 'openai-compatible') ...[
                const SizedBox(height: 8),
                TextFormField(
                  initialValue: s.aiApiKey,
                  obscureText: true,
                  onChanged: (v) => c.updateSettings(s.copyWith(aiApiKey: v)),
                  decoration: InputDecoration(
                    isDense: true,
                    labelText: 'API Key',
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                ),
              ],
            ],
            const SizedBox(height: 10),
            Row(
              children: [
                ElevatedButton.icon(
                  onPressed: _testingAi
                      ? null
                      : () async {
                          setState(() => _testingAi = true);
                          final res = await AiGateway.testConnection(c.settings);
                          if (mounted) {
                            setState(() {
                              _testingAi = false;
                              _aiTestResult = res.message;
                            });
                          }
                        },
                  icon: const Icon(LucideIcons.plugZap, size: 14),
                  label: Text(_testingAi ? '...' : (isZh ? '测试连接' : 'Test Connection')),
                ),
                if (_aiTestResult != null) ...[
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(_aiTestResult!, style: TextStyle(fontSize: 12, color: t.accent)),
                  ),
                ],
              ],
            ),
          ],
        ),
      ),
      const SizedBox(height: 12),
      ArcFrostedCardSurface(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(isZh ? '内置学术与降 AI Skills' : 'Built-in Academic & De-AI Skills',
                style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14, color: t.textPrimary)),
            const SizedBox(height: 6),
            ...s.skills.map((sk) => SwitchListTile(
                  dense: true,
                  contentPadding: EdgeInsets.zero,
                  title: Text(sk.name, style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, color: t.textPrimary)),
                  subtitle: Text(sk.description, style: TextStyle(fontSize: 11, color: t.textMuted)),
                  value: sk.enabled,
                  onChanged: (v) {
                    final next = s.skills
                        .map((item) => item.id == sk.id ? item.copyWith(enabled: v) : item)
                        .toList();
                    c.updateSettings(s.copyWith(skills: next));
                  },
                )),
          ],
        ),
      ),
    ];
  }

  List<Widget> _buildAboutTab(ArcThemeTokens t, bool isZh) {
    return [
      ArcFrostedCardSurface(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                ArcVaultLogo(size: 36, themeId: t.themeId),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('ArcVault · 穹档 Mobile v0.4.0',
                          style: TextStyle(fontWeight: FontWeight.w800, fontSize: 15, color: t.textPrimary)),
                      Text(isZh ? 'Flutter 手机 & 平板原生端 · MIT 开源协议' : 'Flutter Mobile & Tablet · MIT License',
                          style: TextStyle(fontSize: 12, color: t.textMuted)),
                    ],
                  ),
                ),
              ],
            ),
            const Divider(height: 20),
            Text(isZh ? '第三方开源项目致谢与许可清单' : 'Open Source Acknowledgments',
                style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5, color: t.textPrimary)),
            const SizedBox(height: 8),
            ...kOpenSourceProjects.map((p) => Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Text(p.name,
                                style: TextStyle(
                                    fontSize: 12.5, fontWeight: FontWeight.w700, color: t.textPrimary)),
                          ),
                          Text(p.license, style: TextStyle(fontSize: 11, color: t.accent)),
                        ],
                      ),
                      Text(isZh ? p.descriptionZh : p.descriptionEn,
                          style: TextStyle(fontSize: 11.5, color: t.textSecondary)),
                    ],
                  ),
                )),
          ],
        ),
      ),
    ];
  }

  Widget _sliderRow({
    required String label,
    required String valueLabel,
    required double value,
    required double min,
    required double max,
    required void Function(double) onChanged,
  }) {
    final t = context.arcTheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(label, style: TextStyle(fontSize: 12, color: t.textSecondary)),
            Text(valueLabel, style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: t.accent)),
          ],
        ),
        Slider(
          value: value.clamp(min, max),
          min: min,
          max: max,
          onChanged: onChanged,
        ),
      ],
    );
  }
}

class _ThemeSwatchWidget extends StatelessWidget {
  const _ThemeSwatchWidget({
    required this.themeId,
    required this.isLiquidDark,
    required this.monetSeed,
  });

  final MobileThemeId themeId;
  final bool isLiquidDark;
  final int monetSeed;

  @override
  Widget build(BuildContext context) {
    if (themeId == MobileThemeId.liquidGlass) {
      return LiquidGlassThemePreviewSwatch(isDark: isLiquidDark);
    }

    final Color bg;
    final Color side;
    final Color accent;
    switch (themeId) {
      case MobileThemeId.light:
        bg = const Color(0xFFF6F7FB);
        side = const Color(0xFFFFFFFF);
        accent = const Color(0xFF3B5BDB);
      case MobileThemeId.dark:
        bg = const Color(0xFF0D1117);
        side = const Color(0xFF141A23);
        accent = const Color(0xFF60A5FA);
      case MobileThemeId.paper:
        bg = const Color(0xFFF3EDE0);
        side = const Color(0xFFFAF6EC);
        accent = const Color(0xFF8C5A2B);
      case MobileThemeId.m3Expressive:
        bg = const Color(0xFFF4EFFA);
        side = const Color(0xFFFDFBFF);
        accent = Color(monetSeed);
      case MobileThemeId.liquidGlass:
        bg = Colors.transparent;
        side = Colors.transparent;
        accent = Colors.blue;
    }

    return Container(
      width: 44,
      height: 32,
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(7),
        border: Border.all(color: Colors.grey.withValues(alpha: 0.3)),
      ),
      child: Row(
        children: [
          Container(
            width: 14,
            decoration: BoxDecoration(
              color: side,
              borderRadius: const BorderRadius.horizontal(left: Radius.circular(6)),
            ),
          ),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.all(5),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Container(
                    height: 5,
                    width: 16,
                    decoration: BoxDecoration(color: accent, borderRadius: BorderRadius.circular(3)),
                  ),
                  const SizedBox(height: 4),
                  Container(
                    height: 4,
                    width: 20,
                    decoration: BoxDecoration(
                      color: Colors.grey.withValues(alpha: 0.35),
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
