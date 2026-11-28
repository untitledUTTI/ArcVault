import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../models/archive_models.dart';
import '../theme/arc_theme.dart';

class MobileQuickFormatBar extends StatefulWidget {
  const MobileQuickFormatBar({
    super.key,
    this.barKey,
    this.snapshotBtnKey,
    this.scrollController,
    required this.isZh,
    this.inReviewMode = false,
    required this.readOnly,
    required this.activeFormat,
    required this.splitPreview,
    required this.canUndo,
    required this.canRedo,
    required this.openAnnotationCount,
    required this.phrasebankActive,
    this.widthFraction = 1.0,
    this.onWidthFractionChanged,
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
  final bool inReviewMode;
  final bool readOnly;
  final EditorFormat activeFormat;
  final bool splitPreview;
  final bool canUndo;
  final bool canRedo;
  final int openAnnotationCount;
  final bool phrasebankActive;
  final double widthFraction;
  final ValueChanged<double>? onWidthFractionChanged;
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
  State<MobileQuickFormatBar> createState() => _MobileQuickFormatBarState();
}

class _MobileQuickFormatBarState extends State<MobileQuickFormatBar> {
  double? _dragFraction;
  bool _dragging = false;

  @override
  Widget build(BuildContext context) {
    final t = context.arcTheme;
    final activeFraction = (_dragFraction ?? widget.widthFraction).clamp(0.55, 1.0);

    return LayoutBuilder(
      builder: (context, constraints) {
        final maxAvailable = (constraints.maxWidth - 20).clamp(200.0, double.infinity);
        final barWidth = widget.inReviewMode
            ? maxAvailable.clamp(200.0, 440.0)
            : (maxAvailable * activeFraction).clamp(220.0, maxAvailable);

        void handleEdgeDrag(double deltaPx) {
          final next = ((_dragFraction ?? widget.widthFraction) + deltaPx / maxAvailable)
              .clamp(0.55, 1.0);
          setState(() => _dragFraction = next);
        }

        void finishDrag() {
          final finalVal = (_dragFraction ?? widget.widthFraction).clamp(0.55, 1.0);
          setState(() {
            _dragging = false;
            _dragFraction = null;
          });
          widget.onWidthFractionChanged?.call(finalVal);
        }

        return Padding(
          padding: EdgeInsets.fromLTRB(
            10,
            widget.inReviewMode ? 2 : 4,
            10,
            widget.inReviewMode ? 6 : 8,
          ),
          child: Center(
            child: SizedBox(
              width: barWidth,
              child: ArcSurface(
                key: widget.barKey,
                borderRadius: widget.inReviewMode ? 999 : 24,
                borderColor: _dragging
                    ? t.accent
                    : (widget.inReviewMode ? t.borderStrong : null),
                padding: EdgeInsets.symmetric(
                  horizontal: widget.inReviewMode ? 8 : 4,
                  vertical: widget.inReviewMode ? 4 : 6,
                ),
                child: Row(
                  children: [
                    if (!widget.inReviewMode)
                      _WidthDragHandle(
                        color: _dragging ? t.accent : t.textMuted.withValues(alpha: 0.45),
                        tooltip: widget.isZh ? '拖拽调节底栏宽度（双击恢复）' : 'Drag to resize (double-tap reset)',
                        onDragStart: () {
                          widget.onHaptic(HapticPattern.selection);
                          setState(() => _dragging = true);
                        },
                        onDragDelta: (dx) => handleEdgeDrag(-dx * 2),
                        onDragEnd: finishDrag,
                        onDoubleTap: () {
                          widget.onHaptic(HapticPattern.selection);
                          widget.onWidthFractionChanged?.call(1.0);
                        },
                      ),
                    Expanded(
                      child: SingleChildScrollView(
                        controller: widget.scrollController,
                        scrollDirection: Axis.horizontal,
                        child: Row(
                          children: [
                            _IconQuickBtn(
                              icon: LucideIcons.undo2,
                              enabled: widget.canUndo && !widget.readOnly,
                              onTap: () {
                                widget.onHaptic(HapticPattern.light);
                                widget.onUndo();
                              },
                            ),
                            _IconQuickBtn(
                              icon: LucideIcons.redo2,
                              enabled: widget.canRedo && !widget.readOnly,
                              onTap: () {
                                widget.onHaptic(HapticPattern.light);
                                widget.onRedo();
                              },
                            ),
                            _Sep(color: t.borderSubtle),
                            _MonoQuickBtn(
                              label: 'B',
                              enabled: !widget.readOnly,
                              onTap: () {
                                widget.onHaptic(HapticPattern.selection);
                                widget.onInsertSnippet(widget.isZh ? '**粗体**' : '**bold**');
                              },
                            ),
                            _MonoQuickBtn(
                              label: r'$',
                              enabled: !widget.readOnly,
                              onTap: () {
                                widget.onHaptic(HapticPattern.selection);
                                widget.onInsertSnippet(r'$x$');
                              },
                            ),
                            _MonoQuickBtn(
                              label: r'$$',
                              enabled: !widget.readOnly,
                              onTap: () {
                                widget.onHaptic(HapticPattern.selection);
                                widget.onInsertSnippet('\n\$\$\nE = mc^2\n\$\$\n');
                              },
                            ),
                            _MonoQuickBtn(
                              label: '#',
                              enabled: !widget.readOnly,
                              onTap: () {
                                widget.onHaptic(HapticPattern.selection);
                                widget.onInsertSnippet(
                                    widget.activeFormat == EditorFormat.latex ? r'\section{}' : '## ');
                              },
                            ),
                            _MonoQuickBtn(
                              label: '>',
                              enabled: !widget.readOnly,
                              onTap: () {
                                widget.onHaptic(HapticPattern.selection);
                                widget.onInsertSnippet('> ');
                              },
                            ),
                            _Sep(color: t.borderSubtle),
                            _PillBtn(
                              label: widget.activeFormat == EditorFormat.markdown ? 'MD' : 'LaTeX',
                              onTap: () {
                                widget.onHaptic(HapticPattern.selection);
                                widget.onToggleFormat();
                              },
                            ),
                            const SizedBox(width: 6),
                            _PillBtn(
                              icon: widget.splitPreview ? LucideIcons.eyeOff : LucideIcons.eye,
                              label: widget.splitPreview
                                  ? (widget.isZh ? '编辑' : 'Edit')
                                  : (widget.isZh ? '预览' : 'Preview'),
                              active: widget.splitPreview,
                              onTap: () {
                                widget.onHaptic(HapticPattern.selection);
                                widget.onToggleSplitPreview();
                              },
                            ),
                            const SizedBox(width: 6),
                            _PillBtn(
                              icon: LucideIcons.messageSquare,
                              label: widget.inReviewMode
                                  ? (widget.isZh ? '退出审阅' : 'Exit Review')
                                  : (widget.isZh ? '审阅' : 'Review'),
                              active: widget.inReviewMode,
                              badgeCount: widget.openAnnotationCount,
                              onTap: () {
                                widget.onHaptic(HapticPattern.light);
                                widget.onOpenAnnotations();
                              },
                            ),
                            const SizedBox(width: 6),
                            _PillBtn(
                              icon: LucideIcons.graduationCap,
                              label: widget.isZh ? '句库' : 'Phrases',
                              active: widget.phrasebankActive,
                              onTap: () {
                                widget.onHaptic(HapticPattern.light);
                                widget.onTogglePhrasebank();
                              },
                            ),
                            const SizedBox(width: 6),
                            _PillBtn(
                              icon: LucideIcons.camera,
                              label: widget.isZh ? '扫描' : 'Scan',
                              onTap: () {
                                widget.onHaptic(HapticPattern.light);
                                widget.onOpenCameraScan();
                              },
                            ),
                            const SizedBox(width: 6),
                            KeyedSubtree(
                              key: widget.snapshotBtnKey,
                              child: _PillBtn(
                                icon: LucideIcons.bookmarkPlus,
                                label: widget.isZh ? '快照' : 'Snap',
                                primary: true,
                                onTap: () {
                                  widget.onHaptic(HapticPattern.success);
                                  widget.onSaveMilestone();
                                },
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                    if (!widget.inReviewMode)
                      _WidthDragHandle(
                        color: _dragging ? t.accent : t.textMuted.withValues(alpha: 0.45),
                        tooltip: widget.isZh ? '拖拽调节底栏宽度（双击恢复）' : 'Drag to resize (double-tap reset)',
                        onDragStart: () {
                          widget.onHaptic(HapticPattern.selection);
                          setState(() => _dragging = true);
                        },
                        onDragDelta: (dx) => handleEdgeDrag(dx * 2),
                        onDragEnd: finishDrag,
                        onDoubleTap: () {
                          widget.onHaptic(HapticPattern.selection);
                          widget.onWidthFractionChanged?.call(1.0);
                        },
                      ),
                  ],
                ),
              ),
            ),
          ),
        );
      },
    );
  }
}

class _WidthDragHandle extends StatelessWidget {
  const _WidthDragHandle({
    required this.color,
    required this.tooltip,
    required this.onDragStart,
    required this.onDragDelta,
    required this.onDragEnd,
    required this.onDoubleTap,
  });

  final Color color;
  final String tooltip;
  final VoidCallback onDragStart;
  final ValueChanged<double> onDragDelta;
  final VoidCallback onDragEnd;
  final VoidCallback onDoubleTap;

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: tooltip,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onHorizontalDragStart: (_) => onDragStart(),
        onHorizontalDragUpdate: (d) => onDragDelta(d.delta.dx),
        onHorizontalDragEnd: (_) => onDragEnd(),
        onDoubleTap: onDoubleTap,
        child: SizedBox(
          width: 14,
          height: 34,
          child: Center(
            child: Container(
              width: 3,
              height: 16,
              decoration: BoxDecoration(
                color: color,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
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
            : t.bgSubtle.withValues(alpha: 0.9);
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
