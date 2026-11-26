import 'dart:io';
import 'dart:math' as math;
import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:liquid_glass_renderer/liquid_glass_renderer.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../models/archive_models.dart';
import 'arc_theme.dart';

/// Full-bleed animated backdrop (extends behind status bar & bottom navigation bar)
/// so Liquid Glass widgets always have rich color & depth underneath to refract.
class ArcLiquidGlassBackdrop extends StatefulWidget {
  const ArcLiquidGlassBackdrop({
    super.key,
    required this.settings,
  });

  final LiquidGlassSettingsModel settings;

  @override
  State<ArcLiquidGlassBackdrop> createState() => _ArcLiquidGlassBackdropState();
}

class _ArcLiquidGlassBackdropState extends State<ArcLiquidGlassBackdrop>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(seconds: 18),
  )..repeat();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final s = widget.settings;
    final customPath = s.customWallpaperPath;

    if (customPath != null && customPath.isNotEmpty && File(customPath).existsSync()) {
      return Stack(
        fit: StackFit.expand,
        children: [
          Image.file(
            File(customPath),
            fit: BoxFit.cover,
          ),
          DecoratedBox(
            decoration: BoxDecoration(
              color: (s.isDark ? const Color(0xFF060B18) : const Color(0xFFF6F9FF))
                  .withValues(alpha: s.isDark ? 0.34 : 0.16),
            ),
          ),
        ],
      );
    }

    return AnimatedBuilder(
      animation: _controller,
      builder: (context, _) {
        return CustomPaint(
          painter: _LiquidBackdropMeshPainter(
            progress: _controller.value,
            preset: s.backdropPreset,
            isDark: s.isDark,
          ),
          size: Size.infinite,
        );
      },
    );
  }
}

class _LiquidBackdropMeshPainter extends CustomPainter {
  const _LiquidBackdropMeshPainter({
    required this.progress,
    required this.preset,
    required this.isDark,
  });

  final double progress;
  final LiquidGlassBackdropPreset preset;
  final bool isDark;

  @override
  void paint(Canvas canvas, Size size) {
    final colors = _paletteFor(preset, isDark);
    final bgPaint = Paint()
      ..shader = LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: [colors.baseTop, colors.baseBottom],
      ).createShader(Offset.zero & size);
    canvas.drawRect(Offset.zero & size, bgPaint);

    final angle = progress * math.pi * 2;
    void drawOrb(Offset baseCenter, double radius, Color color, double phaseShift) {
      final dx = math.cos(angle + phaseShift) * size.width * 0.08;
      final dy = math.sin(angle * 0.8 + phaseShift) * size.height * 0.06;
      final center = baseCenter + Offset(dx, dy);
      final paint = Paint()
        ..shader = RadialGradient(
          colors: [
            color.withValues(alpha: isDark ? 0.62 : 0.72),
            color.withValues(alpha: 0.0),
          ],
        ).createShader(Rect.fromCircle(center: center, radius: radius));
      canvas.drawCircle(center, radius, paint);
    }

    final maxDim = math.max(size.width, size.height);
    drawOrb(Offset(size.width * 0.18, size.height * 0.18), maxDim * 0.45, colors.orbA, 0.0);
    drawOrb(Offset(size.width * 0.84, size.height * 0.32), maxDim * 0.42, colors.orbB, 2.1);
    drawOrb(Offset(size.width * 0.48, size.height * 0.82), maxDim * 0.48, colors.orbC, 4.2);
  }

  ({Color baseTop, Color baseBottom, Color orbA, Color orbB, Color orbC}) _paletteFor(
    LiquidGlassBackdropPreset preset,
    bool dark,
  ) {
    switch (preset) {
      case LiquidGlassBackdropPreset.auroraMist:
        return dark
            ? (
                baseTop: const Color(0xFF071126),
                baseBottom: const Color(0xFF0E1B38),
                orbA: const Color(0xFF2563EB),
                orbB: const Color(0xFF8B5CF6),
                orbC: const Color(0xFF06B6D4),
              )
            : (
                baseTop: const Color(0xFFEAF2FF),
                baseBottom: const Color(0xFFF3ECFF),
                orbA: const Color(0xFF93C5FD),
                orbB: const Color(0xFFC4B5FD),
                orbC: const Color(0xFF67E8F9),
              );
      case LiquidGlassBackdropPreset.prismDusk:
        return dark
            ? (
                baseTop: const Color(0xFF150C26),
                baseBottom: const Color(0xFF231338),
                orbA: const Color(0xFFEC4899),
                orbB: const Color(0xFF6366F1),
                orbC: const Color(0xFFF59E0B),
              )
            : (
                baseTop: const Color(0xFFFFEEF6),
                baseBottom: const Color(0xFFEDE9FE),
                orbA: const Color(0xFFF9A8D4),
                orbB: const Color(0xFFA5B4FC),
                orbC: const Color(0xFFFDE68A),
              );
      case LiquidGlassBackdropPreset.oceanSilk:
        return dark
            ? (
                baseTop: const Color(0xFF041724),
                baseBottom: const Color(0xFF092536),
                orbA: const Color(0xFF0284C7),
                orbB: const Color(0xFF0D9488),
                orbC: const Color(0xFF38BDF8),
              )
            : (
                baseTop: const Color(0xFFE6F7FF),
                baseBottom: const Color(0xFFE6FFF8),
                orbA: const Color(0xFF7DD3FC),
                orbB: const Color(0xFF5EEAD4),
                orbC: const Color(0xFFBAE6FD),
              );
      case LiquidGlassBackdropPreset.warmAmber:
        return dark
            ? (
                baseTop: const Color(0xFF1F130B),
                baseBottom: const Color(0xFF2B1B12),
                orbA: const Color(0xFFEA580C),
                orbB: const Color(0xFFD97706),
                orbC: const Color(0xFFDB2777),
              )
            : (
                baseTop: const Color(0xFFFFF4E6),
                baseBottom: const Color(0xFFFFECEF),
                orbA: const Color(0xFFFDBA74),
                orbB: const Color(0xFFFDE047),
                orbC: const Color(0xFFFDA4AF),
              );
    }
  }

  @override
  bool shouldRepaint(covariant _LiquidBackdropMeshPainter oldDelegate) =>
      oldDelegate.progress != progress ||
      oldDelegate.preset != preset ||
      oldDelegate.isDark != isDark;
}

/// Restrained Liquid Glass wrapper for floating overlays (TopBar, QuickBar, Capsule,
/// Modals, Sheets, Drawer, Preview Dock). Uses `liquid_glass_renderer` with graceful
/// fallback to `FakeGlass` / `BackdropFilter` when compatibility mode is enabled.
class ArcLiquidGlassSurface extends StatelessWidget {
  const ArcLiquidGlassSurface({
    super.key,
    required this.child,
    this.liquidGlassSettings = const LiquidGlassSettingsModel(),
    this.enabled = true,
    this.borderRadius = 20,
    this.padding,
    this.fallbackColor,
  });

  final Widget child;
  final LiquidGlassSettingsModel liquidGlassSettings;
  final bool enabled;
  final double borderRadius;
  final EdgeInsetsGeometry? padding;
  final Color? fallbackColor;

  @override
  Widget build(BuildContext context) {
    final tokens = context.arcTheme;
    final content = padding != null ? Padding(padding: padding!, child: child) : child;

    if (!enabled || !tokens.isLiquidGlass) {
      return Container(
        decoration: BoxDecoration(
          color: fallbackColor ?? tokens.bgElevated,
          borderRadius: BorderRadius.circular(borderRadius),
          border: Border.all(color: tokens.borderSubtle),
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(borderRadius),
          child: content,
        ),
      );
    }

    final s = liquidGlassSettings;
    final tintBase = s.isDark ? const Color(0xFF0D172B) : const Color(0xFFFFFFFF);
    final glassColor = tintBase.withValues(alpha: s.tintOpacity);
    final lgSettings = LiquidGlassSettings(
      thickness: s.thickness,
      blur: s.blur,
      glassColor: glassColor,
      chromaticAberration: s.chromaticAberration,
      saturation: s.saturation,
      lightIntensity: s.lightIntensity,
      lightAngle: math.pi * 0.28,
      ambientStrength: s.isDark ? 0.35 : 0.55,
      refractiveIndex: 1.52,
    );

    final shape = LiquidRoundedSuperellipse(
      borderRadius: borderRadius,
    );

    if (s.compatibilityMode) {
      return ClipRRect(
        borderRadius: BorderRadius.circular(borderRadius),
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: s.blur, sigmaY: s.blur),
          child: Container(
            decoration: BoxDecoration(
              color: glassColor,
              borderRadius: BorderRadius.circular(borderRadius),
              border: Border.all(
                color: (s.isDark ? Colors.white : Colors.white).withValues(
                  alpha: s.isDark ? 0.22 : 0.65,
                ),
                width: 1.1,
              ),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: s.isDark ? 0.35 : 0.08),
                  blurRadius: 18,
                  offset: const Offset(0, 8),
                ),
              ],
            ),
            child: content,
          ),
        ),
      );
    }

    return LiquidGlassLayer(
      settings: lgSettings,
      child: LiquidGlass(
        shape: shape,
        child: DecoratedBox(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(borderRadius),
            border: Border.all(
              color: Colors.white.withValues(alpha: s.isDark ? 0.22 : 0.55),
              width: 0.9,
            ),
          ),
          child: content,
        ),
      ),
    );
  }
}

/// Light frosted card surface for list items / settings cards / annotations inside
/// Liquid Glass theme so text contrast remains effortless and distortion-free.
class ArcFrostedCardSurface extends StatelessWidget {
  const ArcFrostedCardSurface({
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
    final box = Container(
      padding: padding,
      decoration: BoxDecoration(
        color: isActive
            ? t.accentSoft
            : (t.isLiquidGlass
                ? t.bgSurface.withValues(alpha: t.isDark ? 0.62 : 0.72)
                : t.bgSurface),
        borderRadius: BorderRadius.circular(r),
        border: Border.all(
          color: isActive ? t.accent : t.borderSubtle,
          width: isActive ? 1.4 : 1.0,
        ),
      ),
      child: child,
    );

    if (!t.isLiquidGlass) return box;
    return ClipRRect(
      borderRadius: BorderRadius.circular(r),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 8, sigmaY: 8),
        child: box,
      ),
    );
  }
}

/// Custom vector preview swatch (44x32 ratio) for Settings -> Appearance & Welcome screen.
class LiquidGlassThemePreviewSwatch extends StatelessWidget {
  const LiquidGlassThemePreviewSwatch({
    super.key,
    this.width = 44,
    this.height = 32,
    this.isDark = false,
  });

  final double width;
  final double height;
  final bool isDark;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(7),
      child: SizedBox(
        width: width,
        height: height,
        child: CustomPaint(
          painter: _LiquidGlassSwatchPainter(isDark: isDark),
        ),
      ),
    );
  }
}

class _LiquidGlassSwatchPainter extends CustomPainter {
  const _LiquidGlassSwatchPainter({required this.isDark});
  final bool isDark;

  @override
  void paint(Canvas canvas, Size size) {
    final rect = Offset.zero & size;
    // 1. Vibrant refractive backdrop
    canvas.drawRect(
      rect,
      Paint()
        ..shader = LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: isDark
              ? const [Color(0xFF0A1633), Color(0xFF3B1F6E), Color(0xFF0C5B78)]
              : const [Color(0xFF7DD3FC), Color(0xFFC4B5FD), Color(0xFFF9A8D4)],
        ).createShader(rect),
    );

    // Subtle light orbs behind glass
    canvas.drawCircle(
      Offset(size.width * 0.24, size.height * 0.3),
      size.width * 0.22,
      Paint()..color = const Color(0xFF38BDF8).withValues(alpha: 0.65),
    );
    canvas.drawCircle(
      Offset(size.width * 0.78, size.height * 0.72),
      size.width * 0.24,
      Paint()..color = const Color(0xFFF472B6).withValues(alpha: 0.55),
    );

    // 2. Superellipse liquid glass lens in center
    final lensRect = Rect.fromLTWH(
      size.width * 0.14,
      size.height * 0.16,
      size.width * 0.72,
      size.height * 0.68,
    );
    final lensRRect = RRect.fromRectAndRadius(lensRect, Radius.circular(size.height * 0.22));
    canvas.drawRRect(
      lensRRect,
      Paint()
        ..shader = LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            Colors.white.withValues(alpha: isDark ? 0.28 : 0.62),
            Colors.white.withValues(alpha: isDark ? 0.08 : 0.24),
          ],
        ).createShader(lensRect),
    );

    // 3. Diagonal specular reflection
    final highlightPath = Path()
      ..moveTo(lensRect.left + 2, lensRect.top + 3)
      ..lineTo(lensRect.right - 6, lensRect.top + 1)
      ..lineTo(lensRect.left + lensRect.width * 0.35, lensRect.bottom - 2)
      ..close();
    canvas.drawPath(
      highlightPath,
      Paint()..color = Colors.white.withValues(alpha: isDark ? 0.16 : 0.34),
    );

    // 4. Chromatic dispersion rim stroke (cyan -> white -> violet)
    canvas.drawRRect(
      lensRRect,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.2
        ..shader = const LinearGradient(
          colors: [Color(0xCC67E8F9), Color(0xEEFFFFFF), Color(0xCCF472B6)],
        ).createShader(lensRect),
    );

    // 5. Inner pill indicator inside the glass lens
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromLTWH(
          lensRect.left + 5,
          lensRect.top + lensRect.height * 0.42,
          lensRect.width - 10,
          lensRect.height * 0.22,
        ),
        const Radius.circular(3),
      ),
      Paint()..color = Colors.white.withValues(alpha: isDark ? 0.38 : 0.72),
    );
  }

  @override
  bool shouldRepaint(covariant _LiquidGlassSwatchPainter oldDelegate) =>
      oldDelegate.isDark != isDark;
}

/// Interactive floating Liquid Glass bottom bar shown ONLY inside Settings -> Appearance
/// when Liquid Glass theme is active and `previewBarEnabled` is toggled ON.
class LiquidGlassPreviewDock extends StatefulWidget {
  const LiquidGlassPreviewDock({
    super.key,
    required this.settings,
    required this.isZh,
    required this.onTapTab,
  });

  final LiquidGlassSettingsModel settings;
  final bool isZh;
  final VoidCallback onTapTab;

  @override
  State<LiquidGlassPreviewDock> createState() => _LiquidGlassPreviewDockState();
}

class _LiquidGlassPreviewDockState extends State<LiquidGlassPreviewDock> {
  int _selected = 0;

  @override
  Widget build(BuildContext context) {
    final t = context.arcTheme;
    final items = widget.isZh
        ? const [
            (icon: LucideIcons.bookOpen, label: '文稿'),
            (icon: LucideIcons.gitBranch, label: '分支'),
            (icon: LucideIcons.sparkles, label: '句库'),
            (icon: LucideIcons.slidersHorizontal, label: '调参'),
          ]
        : const [
            (icon: LucideIcons.bookOpen, label: 'Docs'),
            (icon: LucideIcons.gitBranch, label: 'Branch'),
            (icon: LucideIcons.sparkles, label: 'Phrases'),
            (icon: LucideIcons.slidersHorizontal, label: 'Tune'),
          ];

    return ArcLiquidGlassSurface(
      liquidGlassSettings: widget.settings,
      borderRadius: 28,
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
      child: SizedBox(
        height: 52,
        child: LayoutBuilder(
          builder: (context, constraints) {
            final tabW = constraints.maxWidth / items.length;
            return Stack(
              children: [
                AnimatedPositioned(
                  duration: const Duration(milliseconds: 280),
                  curve: Curves.easeOutBack,
                  left: _selected * tabW + 2,
                  top: 2,
                  width: tabW - 4,
                  height: 48,
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(22),
                      color: t.accent.withValues(alpha: widget.settings.isDark ? 0.28 : 0.16),
                      border: Border.all(
                        color: Colors.white.withValues(alpha: widget.settings.isDark ? 0.28 : 0.72),
                        width: 0.9,
                      ),
                    ),
                  ),
                ),
                Row(
                  children: List.generate(items.length, (idx) {
                    final item = items[idx];
                    final active = idx == _selected;
                    return Expanded(
                      child: GestureDetector(
                        behavior: HitTestBehavior.opaque,
                        onTap: () {
                          setState(() => _selected = idx);
                          widget.onTapTab();
                        },
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(
                              item.icon,
                              size: 18,
                              color: active ? t.accent : t.textSecondary,
                            ),
                            const SizedBox(height: 2),
                            Text(
                              item.label,
                              style: TextStyle(
                                fontSize: 10.5,
                                fontWeight: active ? FontWeight.w700 : FontWeight.w500,
                                color: active ? t.accent : t.textSecondary,
                              ),
                            ),
                          ],
                        ),
                      ),
                    );
                  }),
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}
