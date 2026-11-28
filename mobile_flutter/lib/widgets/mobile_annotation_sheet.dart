import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../core/academic_engines.dart';
import '../core/annotation_filter.dart';
import '../core/tutorial_flow.dart';
import '../i18n/dictionaries.dart';
import '../models/archive_models.dart';
import '../state/app_controller.dart';
import '../theme/arc_theme.dart';

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
  bool _aiLoading = false;
  bool _listOverviewMode = false;
  AnnotationFilterState _filter = const AnnotationFilterState();
  String? _aiPreviewText;
  bool _aiPreviewError = false;
  String? _lastDocId;
  final TextEditingController _replyCtrl = TextEditingController();
  final TextEditingController _searchCtrl = TextEditingController();

  @override
  void dispose() {
    _replyCtrl.dispose();
    _searchCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final t = context.arcTheme;
    final c = widget.controller;
    final s = c.settings;
    final d = ArcStrings.of(s.locale);
    final doc = c.activeDoc;
    if (doc?.id != _lastDocId) {
      _lastDocId = doc?.id;
      _filter = const AnnotationFilterState();
      if (_searchCtrl.text.isNotEmpty) {
        _searchCtrl.clear();
      }
      _listOverviewMode = false;
      _aiPreviewText = null;
    }

    final all = doc?.annotations ?? const <AnnotationItem>[];
    final allStats = countAnnotationStats(all);
    final filtered = filterAnnotations(all, _filter);
    final filteredStats = countAnnotationStats(filtered);
    final ordered = [
      ...filtered.where((a) => a.status == AnnotationStatus.open),
      ...filtered.where((a) => a.status != AnnotationStatus.open),
    ];

    final idx = ordered.isEmpty
        ? 0
        : ordered.indexWhere((a) => a.id == c.selectedAnnotationId).clamp(0, ordered.length - 1);
    final current = ordered.isNotEmpty ? ordered[idx] : null;
    final maxH = MediaQuery.sizeOf(context).height * (_listOverviewMode ? 0.64 : 0.58);
    final isSealed = doc?.isSealed ?? false;

    return GestureDetector(
      onHorizontalDragEnd: (details) {
        if (_listOverviewMode || ordered.length <= 1) return;
        final vx = details.primaryVelocity ?? 0;
        if (vx < -200) {
          c.triggerHaptic(HapticPattern.selection);
          c.locateAnnotation(ordered[(idx + 1) % ordered.length]);
          c.notifyTutorialAction(TutorialActionId.selectAnnotation);
          setState(() => _aiPreviewText = null);
        } else if (vx > 200) {
          c.triggerHaptic(HapticPattern.selection);
          c.locateAnnotation(ordered[(idx - 1 + ordered.length) % ordered.length]);
          c.notifyTutorialAction(TutorialActionId.selectAnnotation);
          setState(() => _aiPreviewText = null);
        }
      },
      child: Container(
        constraints: BoxConstraints(maxHeight: maxH),
        margin: const EdgeInsets.fromLTRB(10, 0, 10, 10),
        child: ArcSurface(
          key: c.tourTargets.keyFor(TutorialTargetId.mobileAnnotationSheet),
          padding: const EdgeInsets.fromLTRB(14, 10, 14, 12),
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
                      all.isEmpty
                          ? d.annotationsSheet
                          : _listOverviewMode
                              ? '${d.annotationsSheet} (${ordered.length}/${all.length})'
                              : ordered.isEmpty
                                  ? '${d.annotationsSheet} (0/${all.length})'
                                  : '${d.annotationsSheet} (${idx + 1}/${ordered.length})',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontWeight: FontWeight.w700,
                        fontSize: 13.5,
                        color: t.textPrimary,
                      ),
                    ),
                  ),
                  if (all.isNotEmpty)
                    InkWell(
                      onTap: () {
                        c.triggerHaptic(HapticPattern.selection);
                        setState(() => _listOverviewMode = !_listOverviewMode);
                      },
                      borderRadius: BorderRadius.circular(8),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: _listOverviewMode ? t.accent : t.bgSubtle,
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(
                            color: _listOverviewMode ? t.accent : t.borderSubtle,
                          ),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(
                              _listOverviewMode ? LucideIcons.layoutGrid : LucideIcons.list,
                              size: 12,
                              color: _listOverviewMode ? t.accentText : t.textPrimary,
                            ),
                            const SizedBox(width: 4),
                            Text(
                              _listOverviewMode ? d.cardView : d.listOverview,
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w600,
                                color: _listOverviewMode ? t.accentText : t.textPrimary,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  if (!_listOverviewMode && ordered.length > 1) ...[
                    IconButton(
                      onPressed: () {
                        c.locateAnnotation(ordered[(idx - 1 + ordered.length) % ordered.length]);
                        c.notifyTutorialAction(TutorialActionId.selectAnnotation);
                        setState(() => _aiPreviewText = null);
                      },
                      icon: Icon(LucideIcons.chevronLeft, size: 16, color: t.textSecondary),
                      visualDensity: VisualDensity.compact,
                    ),
                    IconButton(
                      onPressed: () {
                        c.locateAnnotation(ordered[(idx + 1) % ordered.length]);
                        c.notifyTutorialAction(TutorialActionId.selectAnnotation);
                        setState(() => _aiPreviewText = null);
                      },
                      icon: Icon(LucideIcons.chevronRight, size: 16, color: t.textSecondary),
                      visualDensity: VisualDensity.compact,
                    ),
                  ],
                  IconButton(
                    onPressed: widget.onClose,
                    icon: Icon(LucideIcons.x, size: 16, color: t.textSecondary),
                    visualDensity: VisualDensity.compact,
                  ),
                ],
              ),
              if (all.isNotEmpty) ...[
                const SizedBox(height: 6),
                SizedBox(
                  height: 32,
                  child: TextField(
                    controller: _searchCtrl,
                    onChanged: (val) =>
                        setState(() => _filter = _filter.copyWith(query: val)),
                    style: TextStyle(fontSize: 12, color: t.textPrimary),
                    decoration: InputDecoration(
                      isDense: true,
                      contentPadding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                      prefixIcon: Icon(LucideIcons.search, size: 13, color: t.textMuted),
                      prefixIconConstraints: const BoxConstraints(minWidth: 28, minHeight: 28),
                      suffixIcon: _filter.query.isNotEmpty
                          ? IconButton(
                              onPressed: () {
                                _searchCtrl.clear();
                                setState(() => _filter = _filter.copyWith(query: ''));
                              },
                              icon: Icon(LucideIcons.x, size: 12, color: t.textMuted),
                              padding: EdgeInsets.zero,
                              constraints: const BoxConstraints(minWidth: 24, minHeight: 24),
                            )
                          : null,
                      hintText: d.searchAnnotationsHint,
                      hintStyle: TextStyle(fontSize: 11.5, color: t.textMuted),
                      filled: true,
                      fillColor: t.bgApp,
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(8),
                        borderSide: BorderSide(color: t.borderSubtle),
                      ),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(8),
                        borderSide: BorderSide(color: t.borderSubtle),
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 6),
                SizedBox(
                  height: 26,
                  child: ListView(
                    scrollDirection: Axis.horizontal,
                    children: [
                      _SheetFilterChip(
                        label: '${d.filterAll} (${allStats.total})',
                        selected: _filter.status == AnnotationStatusFilter.all,
                        onTap: () => setState(() =>
                            _filter = _filter.copyWith(status: AnnotationStatusFilter.all)),
                      ),
                      const SizedBox(width: 5),
                      _SheetFilterChip(
                        label: '${d.filterOpen} (${allStats.open})',
                        selected: _filter.status == AnnotationStatusFilter.open,
                        onTap: () => setState(() =>
                            _filter = _filter.copyWith(status: AnnotationStatusFilter.open)),
                      ),
                      const SizedBox(width: 5),
                      _SheetFilterChip(
                        label: '${d.filterHandled} (${allStats.handled})',
                        selected: _filter.status == AnnotationStatusFilter.handled,
                        onTap: () => setState(() =>
                            _filter = _filter.copyWith(status: AnnotationStatusFilter.handled)),
                      ),
                      const SizedBox(width: 8),
                      _SheetFilterChip(
                        label: '${d.filterComment} (${allStats.comments})',
                        selected: _filter.type == AnnotationTypeFilter.comment,
                        onTap: () => setState(() => _filter = _filter.copyWith(
                              type: _filter.type == AnnotationTypeFilter.comment
                                  ? AnnotationTypeFilter.all
                                  : AnnotationTypeFilter.comment,
                            )),
                      ),
                      const SizedBox(width: 5),
                      _SheetFilterChip(
                        label: '${d.filterRevision} (${allStats.revisions})',
                        selected: _filter.type == AnnotationTypeFilter.revision,
                        onTap: () => setState(() => _filter = _filter.copyWith(
                              type: _filter.type == AnnotationTypeFilter.revision
                                  ? AnnotationTypeFilter.all
                                  : AnnotationTypeFilter.revision,
                            )),
                      ),
                    ],
                  ),
                ),
                if (!isSealed &&
                    (filteredStats.openRevisions > 0 || filteredStats.openComments > 0)) ...[
                  const SizedBox(height: 6),
                  SizedBox(
                    height: 26,
                    child: ListView(
                      scrollDirection: Axis.horizontal,
                      children: [
                        if (filteredStats.openRevisions > 0) ...[
                          _SheetBatchChip(
                            icon: LucideIcons.check,
                            label: '${d.batchAcceptRevisions} (${filteredStats.openRevisions})',
                            primary: true,
                            onTap: () {
                              final ids = filtered
                                  .where((a) =>
                                      a.type == AnnotationType.revision &&
                                      a.status == AnnotationStatus.open)
                                  .map((a) => a.id)
                                  .toSet();
                              c.batchAcceptRevisions(targetIds: ids);
                            },
                          ),
                          const SizedBox(width: 6),
                          _SheetBatchChip(
                            icon: LucideIcons.x,
                            label: '${d.batchRejectRevisions} (${filteredStats.openRevisions})',
                            onTap: () {
                              final ids = filtered
                                  .where((a) =>
                                      a.type == AnnotationType.revision &&
                                      a.status == AnnotationStatus.open)
                                  .map((a) => a.id)
                                  .toSet();
                              c.batchRejectRevisions(targetIds: ids);
                            },
                          ),
                          const SizedBox(width: 6),
                        ],
                        if (filteredStats.openComments > 0)
                          _SheetBatchChip(
                            icon: LucideIcons.check,
                            label: '${d.batchResolveComments} (${filteredStats.openComments})',
                            onTap: () {
                              final ids = filtered
                                  .where((a) =>
                                      a.type == AnnotationType.comment &&
                                      a.status == AnnotationStatus.open)
                                  .map((a) => a.id)
                                  .toSet();
                              c.batchResolveComments(targetIds: ids);
                            },
                          ),
                      ],
                    ),
                  ),
                ],
              ],
              const SizedBox(height: 6),
              if (current == null)
                Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        all.isNotEmpty && _filter.isActive
                            ? d.noMatchingAnnotations
                            : d.annotationsEmpty,
                        textAlign: TextAlign.center,
                        style: TextStyle(fontSize: 12.5, color: t.textMuted),
                      ),
                      if (all.isNotEmpty && _filter.isActive) ...[
                        const SizedBox(height: 8),
                        OutlinedButton(
                          onPressed: () {
                            _searchCtrl.clear();
                            setState(() => _filter = const AnnotationFilterState());
                          },
                          child: Text(d.resetFilters, style: const TextStyle(fontSize: 12)),
                        ),
                      ],
                    ],
                  ),
                )
              else if (_listOverviewMode)
                Flexible(
                  child: ListView.separated(
                    shrinkWrap: true,
                    itemCount: ordered.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 6),
                    itemBuilder: (context, listIdx) {
                      final ann = ordered[listIdx];
                      final isComment = ann.type == AnnotationType.comment;
                      final badgeColor = isComment ? t.commentColor : t.revisionColor;
                      final active = ann.id == current.id;
                      final summary = isComment
                          ? (ann.commentText?.isNotEmpty == true
                              ? ann.commentText!
                              : ann.originalText)
                          : '${ann.originalText} → ${ann.suggestedText ?? (s.locale.isZh ? "(删除)" : "(delete)")}';

                      return InkWell(
                        onTap: () {
                          c.triggerHaptic(HapticPattern.light);
                          c.locateAnnotation(ann);
                          c.notifyTutorialAction(TutorialActionId.selectAnnotation);
                          setState(() {
                            _listOverviewMode = false;
                            _aiPreviewText = null;
                          });
                        },
                        borderRadius: BorderRadius.circular(10),
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                          decoration: BoxDecoration(
                            color: active ? t.accentSoft : t.bgApp,
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(
                              color: active ? t.accent : t.borderSubtle,
                            ),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Text(
                                    '#${listIdx + 1}',
                                    style: TextStyle(
                                      fontSize: 10.5,
                                      fontWeight: FontWeight.w700,
                                      color: t.textMuted,
                                    ),
                                  ),
                                  const SizedBox(width: 6),
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                                    decoration: BoxDecoration(
                                      color: badgeColor.withValues(alpha: 0.15),
                                      borderRadius: BorderRadius.circular(4),
                                    ),
                                    child: Text(
                                      isComment
                                          ? (s.locale.isZh ? '批注' : 'Note')
                                          : (s.locale.isZh ? '修订' : 'Rev'),
                                      style: TextStyle(
                                        fontSize: 10,
                                        fontWeight: FontWeight.w700,
                                        color: badgeColor,
                                      ),
                                    ),
                                  ),
                                  const SizedBox(width: 6),
                                  Expanded(
                                    child: Text(
                                      ann.author,
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: TextStyle(
                                        fontSize: 12,
                                        fontWeight: FontWeight.w600,
                                        color: t.textPrimary,
                                      ),
                                    ),
                                  ),
                                  Text(
                                    ann.status.wire,
                                    style: TextStyle(fontSize: 10.5, color: t.textMuted),
                                  ),
                                  const SizedBox(width: 4),
                                  Icon(LucideIcons.crosshair, size: 12, color: t.accent),
                                ],
                              ),
                              if (ann.originalText.isNotEmpty) ...[
                                const SizedBox(height: 3),
                                Text(
                                  ann.originalText,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: TextStyle(fontSize: 11, color: t.textMuted),
                                ),
                              ],
                              const SizedBox(height: 2),
                              Text(
                                summary,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(fontSize: 12, color: t.textPrimary),
                              ),
                            ],
                          ),
                        ),
                      );
                    },
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
                              InkWell(
                                onTap: () {
                                  c.triggerHaptic(HapticPattern.selection);
                                  c.locateAnnotation(current);
                                },
                                borderRadius: BorderRadius.circular(6),
                                child: Padding(
                                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                  child: Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      Icon(LucideIcons.crosshair, size: 12, color: t.accent),
                                      const SizedBox(width: 3),
                                      Text(
                                        d.locateAnchor,
                                        style: TextStyle(
                                          fontSize: 11,
                                          fontWeight: FontWeight.w600,
                                          color: t.accent,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                              const SizedBox(width: 6),
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
                              if (current.type == AnnotationType.revision && !isSealed) ...[
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
                            ArcCardSurface(
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
                                  if (!_aiPreviewError && !isSealed)
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

class _SheetFilterChip extends StatelessWidget {
  const _SheetFilterChip({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final t = context.arcTheme;
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(999),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: selected ? t.accentSoft : t.bgApp,
          borderRadius: BorderRadius.circular(999),
          border: Border.all(color: selected ? t.accent : t.borderSubtle),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 10.5,
            fontWeight: FontWeight.w600,
            color: selected ? t.accent : t.textSecondary,
          ),
        ),
      ),
    );
  }
}

class _SheetBatchChip extends StatelessWidget {
  const _SheetBatchChip({
    required this.icon,
    required this.label,
    required this.onTap,
    this.primary = false,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final bool primary;

  @override
  Widget build(BuildContext context) {
    final t = context.arcTheme;
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(8),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: primary ? t.accent : t.bgApp,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: primary ? t.accent : t.borderSubtle),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 11, color: primary ? t.accentText : t.textPrimary),
            const SizedBox(width: 4),
            Text(
              label,
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w600,
                color: primary ? t.accentText : t.textPrimary,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
