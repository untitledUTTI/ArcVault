import 'package:flutter/material.dart';

import '../core/review_stickers.dart';

enum StickerVisualMode { tile, board, preview }

class StickerOverlayText extends StatelessWidget {
  const StickerOverlayText({
    super.key,
    required this.style,
    this.fallbackText = '',
    this.maxLines = 2,
    this.scale = 1.0,
  });

  final StickerTextStyle style;
  final String fallbackText;
  final int maxLines;
  final double scale;

  @override
  Widget build(BuildContext context) {
    final displayText =
        style.text.trim().isNotEmpty ? style.text : fallbackText.trim();
    if (displayText.isEmpty) return const SizedBox.shrink();

    final fontSpec = resolveStickerFont(style);
    final fontSize = (style.fontSize * scale).clamp(8.0, 28.0);
    final letterSpacing = style.letterSpacing * scale;
    final shadows = switch (style.shadow) {
      StickerTextShadow.soft => const [
          Shadow(
            offset: Offset(0, 1),
            blurRadius: 3,
            color: Color(0x61000000),
          ),
        ],
      StickerTextShadow.retro => const [
          Shadow(
            offset: Offset(1.5, 1.5),
            blurRadius: 0,
            color: Color(0x59000000),
          ),
        ],
      StickerTextShadow.none => null,
    };

    final fillStyle = TextStyle(
      fontFamily: fontSpec.fontFamily,
      fontFamilyFallback: fontSpec.fallback,
      fontSize: fontSize,
      fontWeight: style.bold ? FontWeight.w700 : FontWeight.w500,
      fontStyle: style.italic ? FontStyle.italic : FontStyle.normal,
      decoration: style.underline ? TextDecoration.underline : TextDecoration.none,
      decorationColor: parseStickerHexColor(style.color),
      letterSpacing: letterSpacing,
      height: 1.25,
      color: parseStickerHexColor(style.color),
      shadows: (!style.strokeEnabled && shadows != null) ? shadows : null,
    );

    if (!style.strokeEnabled || style.strokeWidth <= 0) {
      return Text(
        displayText,
        maxLines: maxLines,
        overflow: TextOverflow.ellipsis,
        textAlign: TextAlign.center,
        style: fillStyle,
      );
    }

    final strokeColor = parseStickerHexColor(style.strokeColor, Colors.white);
    final strokeStyle = fillStyle.copyWith(
      color: null,
      shadows: shadows,
      decorationColor: strokeColor,
      foreground: Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = (style.strokeWidth * 2 * scale).clamp(0.5, 10.0)
        ..strokeJoin = StrokeJoin.round
        ..color = strokeColor,
    );

    return Stack(
      alignment: Alignment.center,
      children: [
        Text(
          displayText,
          maxLines: maxLines,
          overflow: TextOverflow.ellipsis,
          textAlign: TextAlign.center,
          style: strokeStyle,
        ),
        Text(
          displayText,
          maxLines: maxLines,
          overflow: TextOverflow.ellipsis,
          textAlign: TextAlign.center,
          style: fillStyle,
        ),
      ],
    );
  }
}

class StickerVisual extends StatelessWidget {
  const StickerVisual({
    super.key,
    required this.sticker,
    this.textStyle,
    this.fallbackText = '',
    required this.mode,
    required this.isZh,
  });

  final ReviewStickerDef sticker;
  final StickerTextStyle? textStyle;
  final String fallbackText;
  final StickerVisualMode mode;
  final bool isZh;

  @override
  Widget build(BuildContext context) {
    final label = isZh ? sticker.label : (sticker.labelEn ?? sticker.label);
    final effectiveStyle = textStyle ?? sticker.defaultTextStyle;

    if (isStripImageSticker(sticker)) {
      final inset = sticker.textInset ?? const [16.0, 14.0, 16.0, 14.0];
      final topPct = (inset.isNotEmpty ? inset[0] : 16.0) / 100.0;
      final rightPct = (inset.length > 1 ? inset[1] : 14.0) / 100.0;
      final bottomPct = (inset.length > 2 ? inset[2] : 16.0) / 100.0;
      final leftPct = (inset.length > 3 ? inset[3] : 14.0) / 100.0;

      final scale = mode == StickerVisualMode.tile
          ? 0.78
          : (mode == StickerVisualMode.preview ? 1.1 : 1.0);
      final maxLines = mode == StickerVisualMode.tile ? 1 : 2;
      final showOverlay = mode != StickerVisualMode.tile ||
          (effectiveStyle?.text.trim().isNotEmpty ?? false);

      final bytes = decodeStickerPngBytes(sticker.pngDataUrl);
      Widget imageWidget;
      if (bytes != null) {
        imageWidget = Image.memory(
          bytes,
          fit: BoxFit.contain,
          filterQuality: FilterQuality.medium,
          errorBuilder: (_, __, ___) => _FallbackStripBox(color: sticker.color, label: label),
        );
      } else if (sticker.assetPath != null && sticker.assetPath!.isNotEmpty) {
        imageWidget = Image.asset(
          sticker.assetPath!,
          fit: BoxFit.contain,
          filterQuality: FilterQuality.medium,
          errorBuilder: (_, __, ___) => _FallbackStripBox(color: sticker.color, label: label),
        );
      } else {
        imageWidget = _FallbackStripBox(color: sticker.color, label: label);
      }

      final height = switch (mode) {
        StickerVisualMode.tile => 46.0,
        StickerVisualMode.board => 56.0,
        StickerVisualMode.preview => 74.0,
      };
      final width = switch (mode) {
        StickerVisualMode.tile => 130.0,
        StickerVisualMode.board => 186.0,
        StickerVisualMode.preview => 256.0,
      };

      return SizedBox(
        width: width,
        height: height,
        child: LayoutBuilder(
          builder: (context, box) {
            return Stack(
              fit: StackFit.expand,
              children: [
                imageWidget,
                if (showOverlay && effectiveStyle != null)
                  Positioned(
                    top: box.maxHeight * topPct,
                    right: box.maxWidth * rightPct,
                    bottom: box.maxHeight * bottomPct,
                    left: box.maxWidth * leftPct,
                    child: Center(
                      child: StickerOverlayText(
                        style: effectiveStyle,
                        fallbackText:
                            mode == StickerVisualMode.board ? fallbackText : '',
                        maxLines: maxLines,
                        scale: scale,
                      ),
                    ),
                  ),
              ],
            );
          },
        ),
      );
    }

    // Basic emoji sticker preview
    final accentColor = parseStickerHexColor(sticker.color, const Color(0xFF6366F1));
    final hasOverlay = effectiveStyle != null &&
        (effectiveStyle.text.trim().isNotEmpty || fallbackText.trim().isNotEmpty);

    return Container(
      constraints: BoxConstraints(
        minWidth: mode == StickerVisualMode.preview ? 180 : 120,
        maxWidth: mode == StickerVisualMode.preview ? 260 : 186,
      ),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.92),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: accentColor, width: 1.6),
        boxShadow: const [
          BoxShadow(
            color: Color(0x28000000),
            blurRadius: 8,
            offset: Offset(0, 3),
          ),
        ],
      ),
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          Positioned(
            top: -5,
            left: 24,
            right: 24,
            child: Center(
              child: Container(
                width: 44,
                height: 9,
                decoration: BoxDecoration(
                  color: accentColor.withValues(alpha: 0.85),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 12, 12, 10),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  sticker.emoji ?? '🏷️',
                  style: TextStyle(
                    fontSize: mode == StickerVisualMode.preview ? 22 : 18,
                  ),
                ),
                const SizedBox(width: 8),
                Flexible(
                  child: hasOverlay
                      ? StickerOverlayText(
                          style: effectiveStyle,
                          fallbackText: fallbackText,
                          maxLines: 2,
                          scale: mode == StickerVisualMode.preview ? 1.05 : 0.95,
                        )
                      : Text(
                          label,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                            color: Color(0xFF1E293B),
                          ),
                        ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _FallbackStripBox extends StatelessWidget {
  const _FallbackStripBox({required this.color, required this.label});

  final String color;
  final String label;

  @override
  Widget build(BuildContext context) {
    final c = parseStickerHexColor(color, const Color(0xFF94A3B8));
    return Container(
      decoration: BoxDecoration(
        color: c.withValues(alpha: 0.28),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: c.withValues(alpha: 0.7)),
      ),
      alignment: Alignment.center,
      padding: const EdgeInsets.symmetric(horizontal: 8),
      child: Text(
        label,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: const TextStyle(fontSize: 10.5, fontWeight: FontWeight.w600),
      ),
    );
  }
}
