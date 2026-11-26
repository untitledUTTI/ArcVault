import 'package:flutter/material.dart';
import '../models/archive_models.dart';
import '../theme/arc_theme.dart';

class ArcVaultLogo extends StatelessWidget {
  const ArcVaultLogo({
    super.key,
    this.size = 28,
    this.themeId,
  });

  final double size;
  final MobileThemeId? themeId;

  @override
  Widget build(BuildContext context) {
    final t = context.arcTheme;
    final activeTheme = themeId ?? t.themeId;
    return SizedBox(
      width: size,
      height: size,
      child: CustomPaint(
        painter: _ArcVaultLogoPainter(themeId: activeTheme, tokens: t),
      ),
    );
  }
}

class _ArcVaultLogoPainter extends CustomPainter {
  const _ArcVaultLogoPainter({required this.themeId, required this.tokens});

  final MobileThemeId themeId;
  final ArcThemeTokens tokens;

  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width;
    final h = size.height;
    final rect = Rect.fromLTWH(w * 0.06, h * 0.06, w * 0.88, h * 0.88);
    final rrect = RRect.fromRectAndRadius(rect, Radius.circular(w * 0.28));

    if (themeId == MobileThemeId.liquidGlass) {
      canvas.drawRRect(
        rrect,
        Paint()
          ..shader = LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: tokens.isDark
                ? const [Color(0x5538BDF8), Color(0x448B5CF6)]
                : const [Color(0x9993C5FD), Color(0x88F9A8D4)],
          ).createShader(rect),
      );
      canvas.drawRRect(
        rrect,
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 1.4
          ..shader = const LinearGradient(
            colors: [Color(0xCC67E8F9), Color(0xEEFFFFFF), Color(0xCCF472B6)],
          ).createShader(rect),
      );
    } else if (themeId == MobileThemeId.m3Expressive) {
      canvas.drawRRect(
        rrect,
        Paint()..color = tokens.accentSoft,
      );
      canvas.drawRRect(
        rrect,
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 1.4
          ..color = tokens.accent,
      );
    } else if (themeId == MobileThemeId.paper) {
      canvas.drawRRect(rrect, Paint()..color = const Color(0xFFF3E9D2));
      canvas.drawRRect(
        rrect,
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 1.4
          ..color = const Color(0xFFB89464),
      );
    } else {
      canvas.drawRRect(rrect, Paint()..color = tokens.accent.withValues(alpha: 0.16));
      canvas.drawRRect(
        rrect,
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 1.4
          ..color = tokens.accent,
      );
    }

    // Outer Vault Dome Arch
    final archPaint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = w * 0.085
      ..strokeCap = StrokeCap.round
      ..color = themeId == MobileThemeId.liquidGlass ? Colors.white : tokens.accent;
    final outerPath = Path()
      ..moveTo(w * 0.22, h * 0.68)
      ..quadraticBezierTo(w * 0.5, h * 0.16, w * 0.78, h * 0.68);
    canvas.drawPath(outerPath, archPaint);

    // Inner Arch
    final innerPaint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = w * 0.055
      ..strokeCap = StrokeCap.round
      ..color = (themeId == MobileThemeId.liquidGlass ? Colors.white : tokens.accent)
          .withValues(alpha: 0.65);
    final innerPath = Path()
      ..moveTo(w * 0.34, h * 0.72)
      ..quadraticBezierTo(w * 0.5, h * 0.36, w * 0.66, h * 0.72);
    canvas.drawPath(innerPath, innerPaint);

    // Zenith Beacon Dot
    canvas.drawCircle(
      Offset(w * 0.5, h * 0.32),
      w * 0.065,
      Paint()..color = themeId == MobileThemeId.paper ? const Color(0xFFB8432E) : tokens.accent,
    );
  }

  @override
  bool shouldRepaint(covariant _ArcVaultLogoPainter oldDelegate) =>
      oldDelegate.themeId != themeId || oldDelegate.tokens != tokens;
}
