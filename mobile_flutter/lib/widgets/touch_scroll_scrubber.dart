import 'dart:math' as math;
import 'package:flutter/material.dart';
import '../models/archive_models.dart';
import '../theme/arc_theme.dart';
import '../theme/liquid_glass_surface.dart';

class ScrubberHeading {
  const ScrubberHeading({required this.title, required this.level, required this.ratio});
  final String title;
  final int level;
  final double ratio;
}

class TouchScrollScrubber extends StatefulWidget {
  const TouchScrollScrubber({
    super.key,
    required this.scrollController,
    required this.documentText,
    required this.scrubberSettings,
    required this.liquidGlassSettings,
    required this.onHaptic,
  });

  final ScrollController scrollController;
  final String documentText;
  final ScrollScrubberSettingsModel scrubberSettings;
  final LiquidGlassSettingsModel liquidGlassSettings;
  final void Function(HapticPattern) onHaptic;

  static ScrollScrubberShape resolveShape(MobileThemeId theme, ScrollScrubberShape override) {
    if (override != ScrollScrubberShape.auto) return override;
    switch (theme) {
      case MobileThemeId.m3Expressive:
        return ScrollScrubberShape.m3Burst;
      case MobileThemeId.light:
      case MobileThemeId.paper:
        return ScrollScrubberShape.squircle;
      case MobileThemeId.dark:
      case MobileThemeId.liquidGlass:
        return ScrollScrubberShape.orb;
    }
  }

  static List<ScrubberHeading> extractHeadings(String text) {
    if (text.isEmpty) return const [];
    final lines = text.split(RegExp(r'\r?\n'));
    final total = lines.length;
    final out = <ScrubberHeading>[];
    for (var i = 0; i < total; i++) {
      final line = lines[i].trim();
      final ratio = total <= 1 ? 0.0 : i / (total - 1);
      final md = RegExp(r'^(#{1,6})\s+(.+?)\s*#*$').firstMatch(line);
      if (md != null) {
        out.add(ScrubberHeading(title: md.group(2)!.trim(), level: md.group(1)!.length, ratio: ratio));
        continue;
      }
      final tex = RegExp(r'^\\(section|subsection|subsubsection)\*?\{([^}]+)\}').firstMatch(line);
      if (tex != null) {
        out.add(ScrubberHeading(title: tex.group(2)!.trim(), level: 2, ratio: ratio));
      }
    }
    return out;
  }

  @override
  State<TouchScrollScrubber> createState() => _TouchScrollScrubberState();
}

class _TouchScrollScrubberState extends State<TouchScrollScrubber> {
  double _ratio = 0.0;
  bool _dragging = false;
  bool _canScroll = false;
  String? _lastHeadingTitle;

  @override
  void initState() {
    super.initState();
    widget.scrollController.addListener(_onScroll);
    WidgetsBinding.instance.addPostFrameCallback((_) => _onScroll());
  }

  @override
  void didUpdateWidget(covariant TouchScrollScrubber oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.scrollController != widget.scrollController) {
      oldWidget.scrollController.removeListener(_onScroll);
      widget.scrollController.addListener(_onScroll);
    }
  }

  @override
  void dispose() {
    widget.scrollController.removeListener(_onScroll);
    super.dispose();
  }

  void _onScroll() {
    if (!widget.scrollController.hasClients) return;
    final pos = widget.scrollController.position;
    final max = pos.maxScrollExtent;
    final scrollable = max > 4;
    final nextRatio = scrollable ? (pos.pixels / max).clamp(0.0, 1.0) : 0.0;
    if (mounted && (scrollable != _canScroll || (nextRatio - _ratio).abs() > 0.005)) {
      setState(() {
        _canScroll = scrollable;
        _ratio = nextRatio;
      });
    }
  }

  void _scrubToLocalY(double dy, double trackHeight, double handleSize) {
    if (!widget.scrollController.hasClients) return;
    final usable = math.max(1.0, trackHeight - handleSize);
    final nextRatio = ((dy - handleSize / 2) / usable).clamp(0.0, 1.0);
    final max = widget.scrollController.position.maxScrollExtent;
    widget.scrollController.jumpTo(nextRatio * max);

    final headings = TouchScrollScrubber.extractHeadings(widget.documentText);
    ScrubberHeading? active;
    for (final h in headings) {
      if (h.ratio <= nextRatio + 0.02) active = h;
    }
    if (active != null && active.title != _lastHeadingTitle) {
      _lastHeadingTitle = active.title;
      widget.onHaptic(HapticPattern.selection);
    }
    setState(() => _ratio = nextRatio);
  }

  @override
  Widget build(BuildContext context) {
    if (!_canScroll && !_dragging) return const SizedBox.shrink();

    final t = context.arcTheme;
    final handleSize = widget.scrubberSettings.size.toDouble();
    final shape = TouchScrollScrubber.resolveShape(t.themeId, widget.scrubberSettings.shape);
    final headings = TouchScrollScrubber.extractHeadings(widget.documentText);
    ScrubberHeading? activeHeading;
    for (final h in headings) {
      if (h.ratio <= _ratio + 0.02) activeHeading = h;
    }

    return LayoutBuilder(
      builder: (context, constraints) {
        final trackH = constraints.maxHeight;
        final top = (trackH - handleSize).clamp(0.0, double.infinity) * _ratio;

        return SizedBox(
          width: handleSize + 10,
          height: trackH,
          child: Stack(
            clipBehavior: Clip.none,
            children: [
              // Subtle vertical track
              Positioned(
                right: handleSize / 2 + 2,
                top: 10,
                bottom: 10,
                child: Container(
                  width: 3,
                  decoration: BoxDecoration(
                    color: t.borderSubtle.withValues(alpha: 0.45),
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              if (_dragging)
                Positioned(
                  right: handleSize + 14,
                  top: (top - 4).clamp(8.0, math.max(8.0, trackH - 44)),
                  child: ArcLiquidGlassSurface(
                    liquidGlassSettings: widget.liquidGlassSettings,
                    borderRadius: 12,
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          '${(_ratio * 100).round()}%',
                          style: TextStyle(
                            color: t.accent,
                            fontWeight: FontWeight.w700,
                            fontSize: 11.5,
                          ),
                        ),
                        if (activeHeading != null) ...[
                          const SizedBox(width: 6),
                          ConstrainedBox(
                            constraints: const BoxConstraints(maxWidth: 160),
                            child: Text(
                              activeHeading.title,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(color: t.textPrimary, fontSize: 11.5),
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                ),
              Positioned(
                right: 4,
                top: top,
                child: GestureDetector(
                  onVerticalDragStart: (d) {
                    setState(() => _dragging = true);
                    widget.onHaptic(HapticPattern.light);
                    _scrubToLocalY(d.localPosition.dy + top, trackH, handleSize);
                  },
                  onVerticalDragUpdate: (d) {
                    _scrubToLocalY(d.localPosition.dy + top, trackH, handleSize);
                  },
                  onVerticalDragEnd: (_) => setState(() => _dragging = false),
                  child: SizedBox(
                    width: handleSize,
                    height: handleSize,
                    child: CustomPaint(
                      painter: _ScrubberGlyphPainter(
                        shape: shape,
                        color: t.accent,
                        fill: t.bgElevated.withValues(alpha: 0.92),
                        active: _dragging,
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

class _ScrubberGlyphPainter extends CustomPainter {
  const _ScrubberGlyphPainter({
    required this.shape,
    required this.color,
    required this.fill,
    required this.active,
  });

  final ScrollScrubberShape shape;
  final Color color;
  final Color fill;
  final bool active;

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final r = size.width * 0.42;
    final fillPaint = Paint()..color = active ? color.withValues(alpha: 0.22) : fill;
    final strokePaint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = active ? 2.0 : 1.4
      ..color = color;

    if (shape == ScrollScrubberShape.squircle) {
      final rr = RRect.fromRectAndRadius(
        Rect.fromCenter(center: center, width: r * 1.9, height: r * 1.9),
        Radius.circular(r * 0.6),
      );
      canvas.drawRRect(rr, fillPaint);
      canvas.drawRRect(rr, strokePaint);
    } else if (shape == ScrollScrubberShape.m3Clover || shape == ScrollScrubberShape.m3Burst) {
      final lobes = shape == ScrollScrubberShape.m3Clover ? 4 : 8;
      final amp = shape == ScrollScrubberShape.m3Clover ? r * 0.18 : r * 0.13;
      final path = Path();
      for (var i = 0; i <= 72; i++) {
        final theta = (i / 72) * math.pi * 2;
        final rad = r * 0.88 + amp * math.cos(lobes * theta);
        final x = center.dx + rad * math.cos(theta);
        final y = center.dy + rad * math.sin(theta);
        if (i == 0) {
          path.moveTo(x, y);
        } else {
          path.lineTo(x, y);
        }
      }
      path.close();
      canvas.drawPath(path, fillPaint);
      canvas.drawPath(path, strokePaint);
    } else {
      canvas.drawCircle(center, r, fillPaint);
      canvas.drawCircle(center, r, strokePaint);
    }

    // Up/Down grip dots
    canvas.drawCircle(center.translate(0, -3), 1.6, Paint()..color = color);
    canvas.drawCircle(center.translate(0, 3), 1.6, Paint()..color = color);
  }

  @override
  bool shouldRepaint(covariant _ScrubberGlyphPainter oldDelegate) =>
      oldDelegate.shape != shape || oldDelegate.active != active || oldDelegate.color != color;
}
