import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../models/archive_models.dart';
import '../theme/arc_theme.dart';
import '../theme/liquid_glass_surface.dart';

class MobileQuickFormatBar extends StatelessWidget {
  const MobileQuickFormatBar({
    super.key,
    this.barKey,
    this.snapshotBtnKey,
    this.scrollController,
    required this.isZh,
    required this.readOnly,
    required this.activeFormat,
    required this.splitPreview,
    required this.canUndo,
    required this.canRedo,
    required this.openAnnotationCount,
    required this.phrasebankActive,
    required this.liquidGlassSettings,
    required this.onUndo,
    required this.onRedo,
    required this.onInsertSnippet,
    required this.onToggleFormat,
    required this.onToggleSplitPreview,
    required this.onOpenAnnotations,
    required this.onTogglePhrasebank,
    required this.onOpenCameraScan,
    required this.onSaveMilestone,
    required this.onHaptic,
  });

  final GlobalKey? barKey;
  final GlobalKey? snapshotBtnKey;
  final ScrollController? scrollController;
  final bool isZh;
  final bool readOnly;
  final EditorFormat activeFormat;
  final bool splitPreview;
  final bool canUndo;
  final bool canRedo;
  final int openAnnotationCount;
  final bool phrasebankActive;
  final LiquidGlassSettingsModel liquidGlassSettings;
  final VoidCallback onUndo;
  final VoidCallback onRedo;
  final void Function(String snippet) onInsertSnippet;
  final VoidCallback onToggleFormat;
  final VoidCallback onToggleSplitPreview;
  final VoidCallback onOpenAnnotations;
  final VoidCallback onTogglePhrasebank;
  final VoidCallback onOpenCameraScan;
  final VoidCallback onSaveMilestone;
  final void Function(HapticPattern) onHaptic;

  @override
  Widget build(BuildContext context) {
    final t = context.arcTheme;

    return Padding(
      padding: const EdgeInsets.fromLTRB(10, 4, 10, 8),
      child: ArcLiquidGlassSurface(
        key: barKey,
        liquidGlassSettings: liquidGlassSettings,
        borderRadius: 24,
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
        child: SingleChildScrollView(
          controller: scrollController,
          scrollDirection: Axis.horizontal,
          child: Row(
            children: [
              _IconQuickBtn(
                icon: LucideIcons.undo2,
                enabled: canUndo && !readOnly,
                onTap: () {
                  onHaptic(HapticPattern.light);
                  onUndo();
                },
              ),
              _IconQuickBtn(
                icon: LucideIcons.redo2,
                enabled: canRedo && !readOnly,
                onTap: () {
                  onHaptic(HapticPattern.light);
                  onRedo();
                },
              ),
              _Sep(color: t.borderSubtle),
              _MonoQuickBtn(
                label: 'B',
                enabled: !readOnly,
                onTap: () {
                  onHaptic(HapticPattern.selection);
                  onInsertSnippet(isZh ? '**粗体**' : '**bold**');
                },
              ),
              _MonoQuickBtn(
                label: r'$',
                enabled: !readOnly,
                onTap: () {
                  onHaptic(HapticPattern.selection);
                  onInsertSnippet(r'$x$');
                },
              ),
              _MonoQuickBtn(
                label: r'$$',
                enabled: !readOnly,
                onTap: () {
                  onHaptic(HapticPattern.selection);
                  onInsertSnippet('\n\$\$\nE = mc^2\n\$\$\n');
                },
              ),
              _MonoQuickBtn(
                label: '#',
                enabled: !readOnly,
                onTap: () {
                  onHaptic(HapticPattern.selection);
                  onInsertSnippet(activeFormat == EditorFormat.latex ? r'\section{}' : '## ');
                },
              ),
              _MonoQuickBtn(
                label: '>',
                enabled: !readOnly,
                onTap: () {
                  onHaptic(HapticPattern.selection);
                  onInsertSnippet('> ');
                },
              ),
              _Sep(color: t.borderSubtle),
              _PillBtn(
                label: activeFormat == EditorFormat.markdown ? 'MD' : 'LaTeX',
                onTap: () {
                  onHaptic(HapticPattern.selection);
                  onToggleFormat();
                },
              ),
              const SizedBox(width: 6),
              _PillBtn(
                icon: splitPreview ? LucideIcons.eyeOff : LucideIcons.eye,
                label: splitPreview ? (isZh ? '编辑' : 'Edit') : (isZh ? '预览' : 'Preview'),
                active: splitPreview,
                onTap: () {
                  onHaptic(HapticPattern.selection);
                  onToggleSplitPreview();
                },
              ),
              const SizedBox(width: 6),
              _PillBtn(
                icon: LucideIcons.messageSquare,
                label: isZh ? '批注' : 'Notes',
                badgeCount: openAnnotationCount,
                onTap: () {
                  onHaptic(HapticPattern.light);
                  onOpenAnnotations();
                },
              ),
              const SizedBox(width: 6),
              _PillBtn(
                icon: LucideIcons.graduationCap,
                label: isZh ? '句库' : 'Phrases',
                active: phrasebankActive,
                onTap: () {
                  onHaptic(HapticPattern.light);
                  onTogglePhrasebank();
                },
              ),
              const SizedBox(width: 6),
              _PillBtn(
                icon: LucideIcons.camera,
                label: isZh ? '扫描' : 'Scan',
                onTap: () {
                  onHaptic(HapticPattern.light);
                  onOpenCameraScan();
                },
              ),
              const SizedBox(width: 6),
              KeyedSubtree(
                key: snapshotBtnKey,
                child: _PillBtn(
                  icon: LucideIcons.bookmarkPlus,
                  label: isZh ? '快照' : 'Snap',
                  primary: true,
                  onTap: () {
                    onHaptic(HapticPattern.success);
                    onSaveMilestone();
                  },
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Sep extends StatelessWidget {
  const _Sep({required this.color});
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 1,
      height: 18,
      margin: const EdgeInsets.symmetric(horizontal: 6),
      color: color,
    );
  }
}

class _IconQuickBtn extends StatelessWidget {
  const _IconQuickBtn({required this.icon, required this.enabled, required this.onTap});
  final IconData icon;
  final bool enabled;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final t = context.arcTheme;
    return IconButton(
      onPressed: enabled ? onTap : null,
      icon: Icon(icon, size: 16, color: enabled ? t.textPrimary : t.textMuted.withValues(alpha: 0.45)),
      visualDensity: VisualDensity.compact,
      constraints: const BoxConstraints(minWidth: 34, minHeight: 34),
      padding: EdgeInsets.zero,
    );
  }
}

class _MonoQuickBtn extends StatelessWidget {
  const _MonoQuickBtn({required this.label, required this.enabled, required this.onTap});
  final String label;
  final bool enabled;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final t = context.arcTheme;
    return InkWell(
      onTap: enabled ? onTap : null,
      borderRadius: BorderRadius.circular(10),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 6),
        child: Text(
          label,
          style: TextStyle(
            fontFamily: 'monospace',
            fontWeight: FontWeight.w700,
            fontSize: 13,
            color: enabled ? t.textPrimary : t.textMuted,
          ),
        ),
      ),
    );
  }
}

class _PillBtn extends StatelessWidget {
  const _PillBtn({
    this.icon,
    required this.label,
    this.active = false,
    this.primary = false,
    this.badgeCount = 0,
    required this.onTap,
  });

  final IconData? icon;
  final String label;
  final bool active;
  final bool primary;
  final int badgeCount;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final t = context.arcTheme;
    final bg = primary
        ? t.accent
        : active
            ? t.accentSoft
            : t.bgSubtle.withValues(alpha: t.isLiquidGlass ? 0.55 : 0.9);
    final fg = primary
        ? t.accentText
        : active
            ? t.accent
            : t.textPrimary;

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
          color: bg,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: active ? t.accent : t.borderSubtle,
            width: 0.9,
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (icon != null) ...[
              Icon(icon, size: 13.5, color: fg),
              const SizedBox(width: 4),
            ],
            Text(
              label,
              style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: fg),
            ),
            if (badgeCount > 0) ...[
              const SizedBox(width: 4),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                decoration: BoxDecoration(
                  color: t.revisionColor,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Text(
                  '$badgeCount',
                  style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.w700),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
