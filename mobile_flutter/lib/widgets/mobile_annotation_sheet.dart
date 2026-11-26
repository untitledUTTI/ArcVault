import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../core/academic_engines.dart';
import '../core/tutorial_flow.dart';
import '../i18n/dictionaries.dart';
import '../models/archive_models.dart';
import '../state/app_controller.dart';
import '../theme/arc_theme.dart';
import '../theme/liquid_glass_surface.dart';

class MobileAnnotationSheet extends StatefulWidget {
  const MobileAnnotationSheet({
    super.key,
    required this.controller,
    required this.onClose,
  });

  final AppController controller;
  final VoidCallback onClose;

  @override
  State<MobileAnnotationSheet> createState() => _MobileAnnotationSheetState();
}

class _MobileAnnotationSheetState extends State<MobileAnnotationSheet> {
  bool _expanded = false;
  bool _aiLoading = false;
  String? _aiPreviewText;
  bool _aiPreviewError = false;
  final TextEditingController _replyCtrl = TextEditingController();

  @override
  void dispose() {
    _replyCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final t = context.arcTheme;
    final c = widget.controller;
    final s = c.settings;
    final d = ArcStrings.of(s.locale);
    final doc = c.activeDoc;
    final all = doc?.annotations ?? const <AnnotationItem>[];
    final ordered = [
      ...all.where((a) => a.status == AnnotationStatus.open),
      ...all.where((a) => a.status != AnnotationStatus.open),
    ];

    final idx = ordered.isEmpty
        ? 0
        : ordered.indexWhere((a) => a.id == c.selectedAnnotationId).clamp(0, ordered.length - 1);
    final current = ordered.isNotEmpty ? ordered[idx] : null;
    final maxH = MediaQuery.sizeOf(context).height * (_expanded ? 0.78 : 0.48);

    return GestureDetector(
      onHorizontalDragEnd: (details) {
        if (ordered.length <= 1) return;
        final vx = details.primaryVelocity ?? 0;
        if (vx < -200) {
          c.triggerHaptic(HapticPattern.selection);
          c.selectAnnotation(ordered[(idx + 1) % ordered.length].id);
          c.notifyTutorialAction(TutorialActionId.selectAnnotation);
          setState(() => _aiPreviewText = null);
        } else if (vx > 200) {
          c.triggerHaptic(HapticPattern.selection);
          c.selectAnnotation(ordered[(idx - 1 + ordered.length) % ordered.length].id);
          c.notifyTutorialAction(TutorialActionId.selectAnnotation);
          setState(() => _aiPreviewText = null);
        }
      },
      child: Container(
        constraints: BoxConstraints(maxHeight: maxH),
        margin: const EdgeInsets.fromLTRB(10, 0, 10, 10),
        child: ArcLiquidGlassSurface(
          key: c.tourTargets.keyFor(TutorialTargetId.mobileAnnotationSheet),
          liquidGlassSettings: s.liquidGlass,
          borderRadius: 24,
          padding: const EdgeInsets.fromLTRB(14, 10, 14, 14),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 40,
                height: 4,
                margin: const EdgeInsets.only(bottom: 8),
                decoration: BoxDecoration(
                  color: t.textMuted.withValues(alpha: 0.4),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              Row(
                children: [
                  Icon(LucideIcons.messageSquare, size: 15, color: t.accent),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      ordered.isEmpty
                          ? d.annotationsSheet
                          : '${d.annotationsSheet} (${idx + 1}/${ordered.length})',
                      style: TextStyle(
                        fontWeight: FontWeight.w700,
                        fontSize: 13.5,
                        color: t.textPrimary,
                      ),
                    ),
                  ),
                  if (ordered.length > 1) ...[
                    IconButton(
                      onPressed: () {
                        c.selectAnnotation(ordered[(idx - 1 + ordered.length) % ordered.length].id);
                        c.notifyTutorialAction(TutorialActionId.selectAnnotation);
                        setState(() => _aiPreviewText = null);
                      },
                      icon: Icon(LucideIcons.chevronLeft, size: 16, color: t.textSecondary),
                      visualDensity: VisualDensity.compact,
                    ),
                    IconButton(
                      onPressed: () {
                        c.selectAnnotation(ordered[(idx + 1) % ordered.length].id);
                        c.notifyTutorialAction(TutorialActionId.selectAnnotation);
                        setState(() => _aiPreviewText = null);
                      },
                      icon: Icon(LucideIcons.chevronRight, size: 16, color: t.textSecondary),
                      visualDensity: VisualDensity.compact,
                    ),
                  ],
                  IconButton(
                    onPressed: () => setState(() => _expanded = !_expanded),
                    icon: Icon(
                      _expanded ? LucideIcons.minimize2 : LucideIcons.maximize2,
                      size: 15,
                      color: t.textSecondary,
                    ),
                    visualDensity: VisualDensity.compact,
                  ),
                  IconButton(
                    onPressed: widget.onClose,
                    icon: Icon(LucideIcons.x, size: 16, color: t.textSecondary),
                    visualDensity: VisualDensity.compact,
                  ),
                ],
              ),
              const SizedBox(height: 6),
              if (current == null)
                Padding(
                  padding: const EdgeInsets.all(16),
                  child: Text(
                    d.annotationsEmpty,
                    style: TextStyle(fontSize: 12.5, color: t.textMuted),
                  ),
                )
              else
                Flexible(
                  child: SingleChildScrollView(
                    child: GestureDetector(
                      behavior: HitTestBehavior.translucent,
                      onTap: () {
                        c.selectAnnotation(current.id);
                        c.notifyTutorialAction(TutorialActionId.selectAnnotation);
                      },
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                        Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                              decoration: BoxDecoration(
                                color: (current.type == AnnotationType.comment
                                        ? t.commentColor
                                        : t.revisionColor)
                                    .withValues(alpha: 0.16),
                                borderRadius: BorderRadius.circular(6),
                              ),
                              child: Text(
                                current.type == AnnotationType.comment
                                    ? (s.locale.isZh ? '批注' : 'Comment')
                                    : (s.locale.isZh ? '修订' : 'Revision'),
                                style: TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w700,
                                  color: current.type == AnnotationType.comment
                                      ? t.commentColor
                                      : t.revisionColor,
                                ),
                              ),
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                current.author,
                                style: TextStyle(
                                  fontSize: 12.5,
                                  fontWeight: FontWeight.w600,
                                  color: t.textPrimary,
                                ),
                              ),
                            ),
                            Text(
                              current.status.wire,
                              style: TextStyle(fontSize: 11, color: t.textMuted),
                            ),
                          ],
                        ),
                        const SizedBox(height: 8),
                        if (current.originalText.isNotEmpty)
                          Container(
                            width: double.infinity,
                            padding: const EdgeInsets.all(8),
                            decoration: BoxDecoration(
                              color: t.bgSubtle.withValues(alpha: 0.65),
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Text(
                              current.originalText,
                              style: TextStyle(fontSize: 12, color: t.textSecondary),
                            ),
                          ),
                        if (current.commentText?.isNotEmpty == true) ...[
                          const SizedBox(height: 8),
                          Text(
                            current.commentText!,
                            style: TextStyle(fontSize: 13, color: t.textPrimary, height: 1.45),
                          ),
                        ],
                        if (current.suggestedText?.isNotEmpty == true) ...[
                          const SizedBox(height: 6),
                          Text(
                            '${s.locale.isZh ? '建议改为：' : 'Suggested: '}${current.suggestedText}',
                            style: TextStyle(
                              fontSize: 12.5,
                              color: t.accent,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                        const SizedBox(height: 10),
                        Wrap(
                          spacing: 6,
                          runSpacing: 6,
                          children: [
                            if (current.type == AnnotationType.revision && !(doc?.isSealed ?? false)) ...[
                              FilledButton.icon(
                                onPressed: () => c.acceptRevision(current.id),
                                icon: const Icon(LucideIcons.check, size: 13),
                                label: Text(d.acceptRevision, style: const TextStyle(fontSize: 12)),
                                style: FilledButton.styleFrom(
                                  backgroundColor: t.accent,
                                  foregroundColor: t.accentText,
                                  visualDensity: VisualDensity.compact,
                                ),
                              ),
                              OutlinedButton.icon(
                                onPressed: () => c.rejectRevision(current.id),
                                icon: const Icon(LucideIcons.rotateCcw, size: 13),
                                label: Text(d.rejectRevision, style: const TextStyle(fontSize: 12)),
                                style: OutlinedButton.styleFrom(visualDensity: VisualDensity.compact),
                              ),
                            ] else
                              OutlinedButton.icon(
                                onPressed: () => c.toggleResolveComment(current.id),
                                icon: const Icon(LucideIcons.check, size: 13),
                                label: Text(
                                  current.status == AnnotationStatus.resolved
                                      ? d.reopenComment
                                      : d.resolveComment,
                                  style: const TextStyle(fontSize: 12),
                                ),
                                style: OutlinedButton.styleFrom(visualDensity: VisualDensity.compact),
                              ),
                            OutlinedButton.icon(
                              onPressed: _aiLoading ? null : () => _runAiSuggest(current),
                              icon: const Icon(LucideIcons.sparkles, size: 13),
                              label: Text(
                                _aiLoading ? '...' : d.aiSuggest,
                                style: const TextStyle(fontSize: 12),
                              ),
                              style: OutlinedButton.styleFrom(visualDensity: VisualDensity.compact),
                            ),
                          ],
                        ),
                        if (_aiPreviewText != null) ...[
                          const SizedBox(height: 8),
                          ArcFrostedCardSurface(
                            padding: const EdgeInsets.all(10),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  _aiPreviewText!,
                                  style: TextStyle(
                                    fontSize: 12.5,
                                    color: _aiPreviewError ? t.revisionColor : t.textPrimary,
                                  ),
                                ),
                                if (!_aiPreviewError && !(doc?.isSealed ?? false))
                                  Align(
                                    alignment: Alignment.centerRight,
                                    child: TextButton(
                                      onPressed: () {
                                        c.applyAiRewriteToAnnotation(current.id, _aiPreviewText!);
                                        setState(() => _aiPreviewText = null);
                                      },
                                      child: Text(d.applyAi),
                                    ),
                                  ),
                              ],
                            ),
                          ),
                        ],
                        const SizedBox(height: 8),
                        Row(
                          children: [
                            Expanded(
                              child: TextField(
                                controller: _replyCtrl,
                                style: TextStyle(fontSize: 12.5, color: t.textPrimary),
                                decoration: InputDecoration(
                                  isDense: true,
                                  hintText: s.locale.isZh ? '输入回复...' : 'Write a reply...',
                                  hintStyle: TextStyle(color: t.textMuted),
                                  border: OutlineInputBorder(
                                    borderRadius: BorderRadius.circular(10),
                                  ),
                                ),
                              ),
                            ),
                            const SizedBox(width: 6),
                            IconButton(
                              onPressed: () {
                                c.replyToComment(current.id, _replyCtrl.text);
                                _replyCtrl.clear();
                              },
                              icon: Icon(LucideIcons.send, size: 16, color: t.accent),
                            ),
                          ],
                        ),
                      ],
                    ),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _runAiSuggest(AnnotationItem ann) async {
    setState(() {
      _aiLoading = true;
      _aiPreviewError = false;
    });
    final doc = widget.controller.activeDoc;
    final text = doc?.activeText ?? '';
    final s = (ann.anchorStart - 60).clamp(0, text.length);
    final e = (ann.anchorEnd + 60).clamp(s, text.length);
    try {
      final res = await AiGateway.generateAnnotationRewrite(
        annotation: ann,
        contextSnippet: text.substring(s, e),
        settings: widget.controller.settings,
        policy: widget.controller.effectiveAiPolicy,
      );
      if (mounted) {
        setState(() {
          _aiPreviewText = res.text;
          _aiPreviewError = false;
        });
      }
    } catch (err) {
      if (mounted) {
        setState(() {
          _aiPreviewText = err.toString();
          _aiPreviewError = true;
        });
      }
    } finally {
      if (mounted) setState(() => _aiLoading = false);
    }
  }
}
