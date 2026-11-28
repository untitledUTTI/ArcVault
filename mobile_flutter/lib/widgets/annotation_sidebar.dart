import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../core/annotation_filter.dart';
import '../core/tutorial_flow.dart';
import '../i18n/dictionaries.dart';
import '../models/archive_models.dart';
import '../state/app_controller.dart';
import '../theme/arc_theme.dart';

class AnnotationSidebar extends StatefulWidget {
  const AnnotationSidebar({super.key, required this.controller});

  final AppController controller;

  @override
  State<AnnotationSidebar> createState() => _AnnotationSidebarState();
}

class _AnnotationSidebarState extends State<AnnotationSidebar> {
  AnnotationFilterState _filter = const AnnotationFilterState();
  final TextEditingController _searchCtrl = TextEditingController();
  String? _lastDocId;

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final t = context.arcTheme;
    final c = widget.controller;
    final d = ArcStrings.of(c.settings.locale);
    final doc = c.activeDoc;
    if (doc?.id != _lastDocId) {
      _lastDocId = doc?.id;
      _filter = const AnnotationFilterState();
      if (_searchCtrl.text.isNotEmpty) {
        _searchCtrl.clear();
      }
    }

    final allAnns = doc?.annotations ?? const <AnnotationItem>[];
    final allStats = countAnnotationStats(allAnns);
    final anns = filterAnnotations(allAnns, _filter);
    final filteredStats = countAnnotationStats(anns);
    final isSealed = doc?.isSealed ?? false;

    return Container(
      key: c.tourTargets.keyFor(TutorialTargetId.annotationSidebar),
      decoration: BoxDecoration(
        color: t.bgSurface,
        border: Border(left: BorderSide(color: t.borderSubtle)),
      ),
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 10, 12, 8),
            child: Row(
              children: [
                Icon(LucideIcons.messageSquare, size: 15, color: t.accent),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    _filter.isActive
                        ? '${d.annotationsSheet} (${anns.length}/${allAnns.length})'
                        : '${d.annotationsSheet} (${allAnns.length})',
                    style: TextStyle(
                      fontWeight: FontWeight.w700,
                      fontSize: 13,
                      color: t.textPrimary,
                    ),
                  ),
                ),
              ],
            ),
          ),
          if (allAnns.isNotEmpty) ...[
            Padding(
              padding: const EdgeInsets.fromLTRB(10, 0, 10, 6),
              child: SizedBox(
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
            ),
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.fromLTRB(10, 0, 10, 6),
              child: Row(
                children: [
                  _FilterChipBtn(
                    label: '${d.filterAll} (${allStats.total})',
                    selected: _filter.status == AnnotationStatusFilter.all,
                    onTap: () => setState(() =>
                        _filter = _filter.copyWith(status: AnnotationStatusFilter.all)),
                  ),
                  const SizedBox(width: 4),
                  _FilterChipBtn(
                    label: '${d.filterOpen} (${allStats.open})',
                    selected: _filter.status == AnnotationStatusFilter.open,
                    onTap: () => setState(() =>
                        _filter = _filter.copyWith(status: AnnotationStatusFilter.open)),
                  ),
                  const SizedBox(width: 4),
                  _FilterChipBtn(
                    label: '${d.filterHandled} (${allStats.handled})',
                    selected: _filter.status == AnnotationStatusFilter.handled,
                    onTap: () => setState(() =>
                        _filter = _filter.copyWith(status: AnnotationStatusFilter.handled)),
                  ),
                  const SizedBox(width: 6),
                  Container(width: 1, height: 14, color: t.borderSubtle),
                  const SizedBox(width: 6),
                  _FilterChipBtn(
                    label: '${d.filterComment} (${allStats.comments})',
                    selected: _filter.type == AnnotationTypeFilter.comment,
                    onTap: () => setState(() => _filter = _filter.copyWith(
                          type: _filter.type == AnnotationTypeFilter.comment
                              ? AnnotationTypeFilter.all
                              : AnnotationTypeFilter.comment,
                        )),
                  ),
                  const SizedBox(width: 4),
                  _FilterChipBtn(
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
                (filteredStats.openRevisions > 0 || filteredStats.openComments > 0))
              Padding(
                padding: const EdgeInsets.fromLTRB(10, 0, 10, 6),
                child: Wrap(
                  spacing: 6,
                  runSpacing: 4,
                  children: [
                    if (filteredStats.openRevisions > 0) ...[
                      _BatchActionBtn(
                        icon: LucideIcons.check,
                        label: '${d.batchAcceptRevisions} (${filteredStats.openRevisions})',
                        primary: true,
                        onTap: () {
                          final ids = anns
                              .where((a) =>
                                  a.type == AnnotationType.revision &&
                                  a.status == AnnotationStatus.open)
                              .map((a) => a.id)
                              .toSet();
                          c.batchAcceptRevisions(targetIds: ids);
                        },
                      ),
                      _BatchActionBtn(
                        icon: LucideIcons.x,
                        label: '${d.batchRejectRevisions} (${filteredStats.openRevisions})',
                        onTap: () {
                          final ids = anns
                              .where((a) =>
                                  a.type == AnnotationType.revision &&
                                  a.status == AnnotationStatus.open)
                              .map((a) => a.id)
                              .toSet();
                          c.batchRejectRevisions(targetIds: ids);
                        },
                      ),
                    ],
                    if (filteredStats.openComments > 0)
                      _BatchActionBtn(
                        icon: LucideIcons.check,
                        label: '${d.batchResolveComments} (${filteredStats.openComments})',
                        onTap: () {
                          final ids = anns
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
          Divider(height: 1, color: t.borderSubtle),
          Expanded(
            child: anns.isEmpty
                ? Center(
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            allAnns.isNotEmpty && _filter.isActive
                                ? d.noMatchingAnnotations
                                : d.annotationsEmpty,
                            textAlign: TextAlign.center,
                            style: TextStyle(fontSize: 12, color: t.textMuted),
                          ),
                          if (allAnns.isNotEmpty && _filter.isActive) ...[
                            const SizedBox(height: 8),
                            OutlinedButton(
                              onPressed: () {
                                _searchCtrl.clear();
                                setState(() => _filter = const AnnotationFilterState());
                              },
                              child: Text(d.resetFilters, style: const TextStyle(fontSize: 11.5)),
                            ),
                          ],
                        ],
                      ),
                    ),
                  )
                : ListView.separated(
                    padding: const EdgeInsets.all(10),
                    itemCount: anns.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 8),
                    itemBuilder: (context, index) {
                      final ann = anns[index];
                      final selected = ann.id == c.selectedAnnotationId;
                      final badgeColor =
                          ann.type == AnnotationType.comment ? t.commentColor : t.revisionColor;
                      return InkWell(
                        onTap: () {
                          c.locateAnnotation(ann);
                          c.notifyTutorialAction(TutorialActionId.selectAnnotation);
                        },
                        borderRadius: BorderRadius.circular(t.radiusSm),
                        child: ArcCardSurface(
                          isActive: selected,
                          padding: const EdgeInsets.all(10),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                    decoration: BoxDecoration(
                                      color: badgeColor.withValues(alpha: 0.14),
                                      borderRadius: BorderRadius.circular(5),
                                    ),
                                    child: Text(
                                      ann.type == AnnotationType.comment
                                          ? (c.settings.locale.isZh ? '批注' : 'Note')
                                          : (c.settings.locale.isZh ? '修订' : 'Rev'),
                                      style: TextStyle(
                                          fontSize: 10.5, fontWeight: FontWeight.w700, color: badgeColor),
                                    ),
                                  ),
                                  const SizedBox(width: 6),
                                  Expanded(
                                    child: Text(
                                      ann.author,
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: TextStyle(
                                          fontSize: 12, fontWeight: FontWeight.w600, color: t.textPrimary),
                                    ),
                                  ),
                                  Text(ann.status.wire, style: TextStyle(fontSize: 10.5, color: t.textMuted)),
                                ],
                              ),
                              if (ann.originalText.isNotEmpty) ...[
                                const SizedBox(height: 6),
                                Text(
                                  ann.originalText,
                                  maxLines: 2,
                                  overflow: TextOverflow.ellipsis,
                                  style: TextStyle(fontSize: 11.5, color: t.textSecondary),
                                ),
                              ],
                              if (ann.commentText?.isNotEmpty == true) ...[
                                const SizedBox(height: 4),
                                Text(
                                  ann.commentText!,
                                  style: TextStyle(fontSize: 12, color: t.textPrimary),
                                ),
                              ],
                              if (ann.suggestedText?.isNotEmpty == true) ...[
                                const SizedBox(height: 4),
                                Text(
                                  '→ ${ann.suggestedText}',
                                  style: TextStyle(fontSize: 11.5, color: t.accent, fontWeight: FontWeight.w600),
                                ),
                              ],
                              if (ann.status == AnnotationStatus.open && !isSealed) ...[
                                const SizedBox(height: 8),
                                Row(
                                  children: [
                                    if (ann.type == AnnotationType.revision) ...[
                                      TextButton(
                                        onPressed: () => c.acceptRevision(ann.id),
                                        style: TextButton.styleFrom(visualDensity: VisualDensity.compact),
                                        child: Text(d.acceptRevision, style: const TextStyle(fontSize: 11.5)),
                                      ),
                                      TextButton(
                                        onPressed: () => c.rejectRevision(ann.id),
                                        style: TextButton.styleFrom(visualDensity: VisualDensity.compact),
                                        child: Text(d.rejectRevision, style: const TextStyle(fontSize: 11.5)),
                                      ),
                                    ] else
                                      TextButton(
                                        onPressed: () => c.toggleResolveComment(ann.id),
                                        style: TextButton.styleFrom(visualDensity: VisualDensity.compact),
                                        child: Text(d.resolveComment, style: const TextStyle(fontSize: 11.5)),
                                      ),
                                  ],
                                ),
                              ],
                            ],
                          ),
                        ),
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }
}

class _FilterChipBtn extends StatelessWidget {
  const _FilterChipBtn({
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
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
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

class _BatchActionBtn extends StatelessWidget {
  const _BatchActionBtn({
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
      borderRadius: BorderRadius.circular(7),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
        decoration: BoxDecoration(
          color: primary ? t.accent : t.bgApp,
          borderRadius: BorderRadius.circular(7),
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
                fontSize: 10.5,
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
