import 'dart:convert';
import 'dart:math' as math;

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../core/academic_engines.dart';
import '../core/annotation_filter.dart';
import '../core/review_stickers.dart';
import '../models/archive_models.dart';
import '../theme/arc_theme.dart';
import 'sticker_picker_tabs.dart';
import 'sticker_text_style_controls.dart';
import 'sticker_visual.dart';

class ReviewSplitWorkspace extends StatefulWidget {
  const ReviewSplitWorkspace({
    super.key,
    required this.docId,
    required this.annotations,
    required this.selectedId,
    required this.documentText,
    required this.settings,
    required this.effectiveAiPolicy,
    required this.readOnly,
    required this.allStickers,
    required this.archiveStickers,
    required this.onAddCustomSticker,
    this.onDeleteCustomSticker,
    required this.onAddArchiveSticker,
    required this.onUpdateArchiveSticker,
    required this.onSelect,
    required this.onLocate,
    required this.onJumpToPosition,
    required this.onAcceptRevision,
    required this.onRejectRevision,
    required this.onToggleResolveComment,
    required this.onReplyComment,
    required this.onApplyAiSuggestion,
    this.onBatchAcceptRevisions,
    this.onBatchRejectRevisions,
    this.onBatchResolveComments,
    required this.onHaptic,
    this.tourKey,
    this.onRegisterBackHandler,
  });

  final String docId;
  final List<AnnotationItem> annotations;
  final String? selectedId;
  final String documentText;
  final AppSettingsModel settings;
  final AiPrivacyPolicy effectiveAiPolicy;
  final bool readOnly;
  final List<ReviewStickerDef> allStickers;
  final List<ReviewArchiveStickerItem> archiveStickers;
  final ValueChanged<ReviewStickerDef> onAddCustomSticker;
  final ValueChanged<String>? onDeleteCustomSticker;
  final ValueChanged<ReviewArchiveStickerItem> onAddArchiveSticker;
  final void Function(
    String archiveId, {
    String? stickerId,
    StickerTextStyle? textOverlay,
  }) onUpdateArchiveSticker;
  final ValueChanged<String> onSelect;
  final ValueChanged<String> onLocate;
  final ValueChanged<int> onJumpToPosition;
  final ValueChanged<String> onAcceptRevision;
  final ValueChanged<String> onRejectRevision;
  final ValueChanged<String> onToggleResolveComment;
  final void Function(String id, String text) onReplyComment;
  final void Function(String id, String rewrite) onApplyAiSuggestion;
  final ValueChanged<Set<String>>? onBatchAcceptRevisions;
  final ValueChanged<Set<String>>? onBatchRejectRevisions;
  final ValueChanged<Set<String>>? onBatchResolveComments;
  final ValueChanged<HapticPattern> onHaptic;
  final Key? tourKey;
  final ValueChanged<bool Function()?>? onRegisterBackHandler;

  @override
  State<ReviewSplitWorkspace> createState() => _ReviewSplitWorkspaceState();
}

class _ReviewSplitWorkspaceState extends State<ReviewSplitWorkspace> {
  bool _blackboardMode = false;
  final TransformationController _boardTransformCtrl = TransformationController();
  String _boardSearch = '';
  AnnotationFilterState _annFilter = const AnnotationFilterState();
  bool _showListOverview = false;
  int? _activeSectionPos;

  bool _aiLoading = false;
  ({String annId, String text, String? source, bool error})? _aiPreview;

  Map<String, ReviewDraftEntry> _draftsByAnnId = {};
  final TextEditingController _searchCtrl = TextEditingController();
  final TextEditingController _boardSearchCtrl = TextEditingController();
  final TextEditingController _draftCtrl = TextEditingController();
  final TextEditingController _customNameCtrl = TextEditingController();
  final TextEditingController _customEmojiCtrl = TextEditingController(text: '🏷️');
  String? _lastSyncedDraftAnnId;

  // Sticker Library & Detail / Edit Modals
  bool _stickerLibraryOpen = false;
  StickerCategory _libraryTab = StickerCategory.journal;
  late String _librarySelectedStickerId;
  late StickerTextStyle _libraryTextStyle;
  bool _libraryUserTouchedColor = false;
  String _customStickerColor = '#0ea5e9';

  ReviewArchiveStickerItem? _viewingStickerArchive;
  ReviewArchiveStickerItem? _editingStickerArchive;
  String _editStickerId = '';
  StickerCategory _editPickerTab = StickerCategory.journal;
  late StickerTextStyle _editTextStyle;
  bool _editUserTouchedColor = false;

  @override
  void initState() {
    super.initState();
    final firstStk = widget.allStickers.isNotEmpty
        ? widget.allStickers.first
        : kJournalStripStickers.first;
    _librarySelectedStickerId = firstStk.id;
    _libraryTextStyle = createDefaultStickerTextStyle(firstStk);
    _editTextStyle = createDefaultStickerTextStyle(firstStk);
    _loadDraftsForDoc(widget.docId);
    widget.onRegisterBackHandler?.call(_handleBack);
  }

  @override
  void didUpdateWidget(covariant ReviewSplitWorkspace oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.docId != widget.docId) {
      _annFilter = const AnnotationFilterState();
      _searchCtrl.clear();
      _boardSearch = '';
      _boardSearchCtrl.clear();
      _showListOverview = false;
      _aiPreview = null;
      _lastSyncedDraftAnnId = null;
      _loadDraftsForDoc(widget.docId);
    }
    if (oldWidget.onRegisterBackHandler != widget.onRegisterBackHandler) {
      widget.onRegisterBackHandler?.call(_handleBack);
    }
  }

  @override
  void dispose() {
    widget.onRegisterBackHandler?.call(null);
    _boardTransformCtrl.dispose();
    _searchCtrl.dispose();
    _boardSearchCtrl.dispose();
    _draftCtrl.dispose();
    _customNameCtrl.dispose();
    _customEmojiCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadDraftsForDoc(String docId) async {
    final loaded = await ReviewStickerStore.loadDocReviewDrafts(docId);
    if (!mounted || widget.docId != docId) return;
    setState(() {
      _draftsByAnnId = loaded;
      _lastSyncedDraftAnnId = null;
    });
  }

  bool _handleBack() {
    if (!_blackboardMode) return false;
    if (_editingStickerArchive != null) {
      setState(() => _editingStickerArchive = null);
      return true;
    }
    if (_viewingStickerArchive != null) {
      setState(() => _viewingStickerArchive = null);
      return true;
    }
    if (_stickerLibraryOpen) {
      setState(() => _stickerLibraryOpen = false);
      return true;
    }
    setState(() => _blackboardMode = false);
    return true;
  }

  List<AnnotationItem> _orderedAnnotations(List<AnnotationItem> filtered) {
    final openFirst =
        filtered.where((a) => a.status == AnnotationStatus.open).toList();
    final rest =
        filtered.where((a) => a.status != AnnotationStatus.open).toList();
    return [...openFirst, ...rest];
  }

  List<({String title, int pos})> _extractSections() {
    final out = <({String title, int pos})>[];
    final lines = widget.documentText.split('\n');
    var offset = 0;
    final headingReg = RegExp(r'^#{1,3}\s+');
    for (final line in lines) {
      final trimmed = line.trim();
      if (headingReg.hasMatch(trimmed)) {
        out.add((
          title: trimmed.replaceFirst(headingReg, ''),
          pos: offset,
        ));
      }
      offset += line.length + 1;
    }
    return out;
  }

  void _updateCurrentDraft(String annId, String text) {
    setState(() {
      if (text.trim().isEmpty && !_draftsByAnnId.containsKey(annId)) {
        return;
      }
      _draftsByAnnId = {
        ..._draftsByAnnId,
        annId: ReviewDraftEntry(
          annId: annId,
          text: text,
          updatedAt: DateTime.now().millisecondsSinceEpoch,
        ),
      };
    });
    ReviewStickerStore.saveDocReviewDrafts(widget.docId, _draftsByAnnId);
  }

  void _archiveCurrentDraftIfNeeded(AnnotationItem? fromAnn) {
    if (fromAnn == null) return;
    final draft = _draftsByAnnId[fromAnn.id]?.text ?? '';
    if (draft.trim().isEmpty) return;
    ReviewArchiveStickerItem? lastForAnn;
    for (var i = widget.archiveStickers.length - 1; i >= 0; i--) {
      if (widget.archiveStickers[i].annId == fromAnn.id) {
        lastForAnn = widget.archiveStickers[i];
        break;
      }
    }
    if (lastForAnn != null && lastForAnn.draftText == draft) return;

    final now = DateTime.now().millisecondsSinceEpoch;
    final defaultStk = widget.allStickers.isNotEmpty
        ? widget.allStickers.first
        : kDefaultBasicStickers.first;
    final snippet = fromAnn.originalText.trim().isNotEmpty
        ? (fromAnn.originalText.length > 24
            ? fromAnn.originalText.substring(0, 24)
            : fromAnn.originalText)
        : fromAnn.author;
    widget.onAddArchiveSticker(
      ReviewArchiveStickerItem(
        id: 'arcstk-$now-${math.Random().nextInt(9999)}',
        annId: fromAnn.id,
        stickerId: defaultStk.id,
        draftText: draft,
        snippet: snippet,
        savedAt: now,
      ),
    );
  }

  void _switchToNote(String nextId, AnnotationItem? current) {
    if (current != null && current.id != nextId) {
      _archiveCurrentDraftIfNeeded(current);
    }
    widget.onHaptic(HapticPattern.selection);
    widget.onSelect(nextId);
    widget.onLocate(nextId);
  }

  void _stepCard(int dir, List<AnnotationItem> ordered, int activeIdx, AnnotationItem? current) {
    if (ordered.length <= 1) return;
    final nextIdx = (activeIdx + dir + ordered.length) % ordered.length;
    _switchToNote(ordered[nextIdx].id, current);
  }

  void _openEditStickerModal(ReviewArchiveStickerItem arc) {
    final stk = widget.allStickers.firstWhere(
      (s) => s.id == arc.stickerId,
      orElse: () => widget.allStickers.isNotEmpty
          ? widget.allStickers.first
          : kDefaultBasicStickers.first,
    );
    setState(() {
      _editingStickerArchive = arc;
      _editStickerId = stk.id;
      _editPickerTab = getStickerCategory(stk);
      _editTextStyle = getEffectiveStickerTextStyle(stk, arc);
      _editUserTouchedColor = false;
    });
  }

  Future<void> _handleAiRewrite(AnnotationItem ann) async {
    setState(() => _aiLoading = true);
    widget.onHaptic(HapticPattern.light);
    try {
      final ctxStart = math.max(0, ann.anchorStart - 60);
      final ctxEnd = math.min(widget.documentText.length, ann.anchorEnd + 60);
      final res = await AiGateway.generateAnnotationRewrite(
        annotation: ann,
        contextSnippet: widget.documentText.substring(ctxStart, ctxEnd),
        settings: widget.settings,
        policy: widget.effectiveAiPolicy,
      );
      if (!mounted) return;
      setState(() {
        _aiPreview = (
          annId: ann.id,
          text: res.text,
          source: res.source,
          error: false,
        );
      });
      widget.onHaptic(HapticPattern.success);
    } catch (err) {
      if (!mounted) return;
      final msg = err is AiPrivacyBlockedException
          ? err.message
          : err.toString().replaceFirst('Exception: ', '');
      setState(() {
        _aiPreview = (
          annId: ann.id,
          text: msg,
          source: null,
          error: true,
        );
      });
      widget.onHaptic(HapticPattern.error);
    } finally {
      if (mounted) setState(() => _aiLoading = false);
    }
  }

  Future<void> _handleImportStickerPng() async {
    try {
      final res = await FilePicker.platform.pickFiles(
        type: FileType.custom,
        allowedExtensions: const ['png'],
        withData: true,
      );
      if (res == null || res.files.isEmpty) return;
      final file = res.files.first;
      final bytes = file.bytes;
      if (bytes == null || bytes.isEmpty) return;
      final dataUrl = 'data:image/png;base64,${base64Encode(bytes)}';
      final rawName = file.name.replaceAll(RegExp(r'\.png$', caseSensitive: false), '');
      final label = rawName.length > 10 ? rawName.substring(0, 10) : (rawName.isNotEmpty ? rawName : 'PNG贴纸');
      final newId = 'stk-png-${DateTime.now().millisecondsSinceEpoch}';
      final newStk = ReviewStickerDef(
        id: newId,
        label: label,
        color: '#6366f1',
        category: StickerCategory.custom,
        isStripImage: true,
        textInset: const [14, 14, 14, 14],
        pngDataUrl: dataUrl,
        isCustom: true,
      );
      widget.onAddCustomSticker(newStk);
      if (!mounted) return;
      setState(() {
        _libraryTab = StickerCategory.custom;
        _librarySelectedStickerId = newId;
      });
      widget.onHaptic(HapticPattern.success);
    } catch (_) {
      // ignore picker cancellation
    }
  }

  void _zoomBlackboard(double delta) {
    final currentScale = _boardTransformCtrl.value.getMaxScaleOnAxis();
    final nextScale = (currentScale + delta).clamp(0.5, 1.9);
    final ratio = nextScale / math.max(0.01, currentScale);
    final m = _boardTransformCtrl.value.clone();
    m.scaleByDouble(ratio, ratio, 1.0, 1.0);
    setState(() {
      _boardTransformCtrl.value = m;
    });
  }

  @override
  Widget build(BuildContext context) {
    final isZh = widget.settings.locale.isZh;
    final allStats = countAnnotationStats(widget.annotations);
    final filteredAnnotations = filterAnnotations(widget.annotations, _annFilter);
    final filteredStats = countAnnotationStats(filteredAnnotations);
    final ordered = _orderedAnnotations(filteredAnnotations);
    final foundIdx = ordered.indexWhere((a) => a.id == widget.selectedId);
    final activeIdx = foundIdx >= 0 ? foundIdx : 0;
    final current = ordered.isNotEmpty ? ordered[activeIdx] : null;
    final currentDraftText = current != null ? (_draftsByAnnId[current.id]?.text ?? '') : '';

    if (_lastSyncedDraftAnnId != current?.id) {
      _lastSyncedDraftAnnId = current?.id;
      _draftCtrl.value = TextEditingValue(
        text: currentDraftText,
        selection: TextSelection.collapsed(offset: currentDraftText.length),
      );
    } else if (_draftCtrl.text != currentDraftText && current == null) {
      _draftCtrl.clear();
    }

    if (_blackboardMode) {
      return _buildBlackboardView(
        isZh: isZh,
        ordered: ordered,
        current: current,
        currentDraftText: currentDraftText,
      );
    }

    return _buildNormalReviewPane(
      context: context,
      isZh: isZh,
      allStats: allStats,
      filteredAnnotations: filteredAnnotations,
      filteredStats: filteredStats,
      ordered: ordered,
      activeIdx: activeIdx,
      current: current,
      currentDraftText: currentDraftText,
    );
  }

  Widget _buildNormalReviewPane({
    required BuildContext context,
    required bool isZh,
    required AnnotationFilterCounts allStats,
    required List<AnnotationItem> filteredAnnotations,
    required AnnotationFilterCounts filteredStats,
    required List<AnnotationItem> ordered,
    required int activeIdx,
    required AnnotationItem? current,
    required String currentDraftText,
  }) {
    final t = context.arcTheme;

    return GestureDetector(
      key: widget.tourKey,
      behavior: HitTestBehavior.translucent,
      onLongPress: () {
        widget.onHaptic(HapticPattern.medium);
        setState(() => _blackboardMode = true);
      },
      child: Container(
        color: t.bgSurface,
        child: Column(
          children: [
            // Header
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
              decoration: BoxDecoration(
                color: t.bgElevated,
                border: Border(bottom: BorderSide(color: t.borderSubtle)),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          isZh
                              ? '批注与修订 (${filteredStats.open}/${filteredAnnotations.length})'
                              : 'Review (${filteredStats.open}/${filteredAnnotations.length})',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w700,
                            color: t.textPrimary,
                          ),
                        ),
                        Text(
                          isZh ? '长按进入审阅黑板' : 'Long-press for Review Board',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(fontSize: 10.5, color: t.textMuted),
                        ),
                      ],
                    ),
                  ),
                  if (widget.annotations.isNotEmpty) ...[
                    _SmallPaneBtn(
                      icon: LucideIcons.list,
                      label: _showListOverview
                          ? (isZh ? '卡片' : 'Card')
                          : (isZh ? '速览' : 'List'),
                      active: _showListOverview,
                      onTap: () {
                        widget.onHaptic(HapticPattern.selection);
                        setState(() => _showListOverview = !_showListOverview);
                      },
                    ),
                    const SizedBox(width: 4),
                  ],
                  if (ordered.length > 1) ...[
                    _SmallSquareBtn(
                      icon: LucideIcons.chevronLeft,
                      onTap: () => _stepCard(-1, ordered, activeIdx, current),
                    ),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 4),
                      child: Text(
                        '${activeIdx + 1}/${ordered.length}',
                        style: TextStyle(fontSize: 11, color: t.textMuted),
                      ),
                    ),
                    _SmallSquareBtn(
                      icon: LucideIcons.chevronRight,
                      onTap: () => _stepCard(1, ordered, activeIdx, current),
                    ),
                    const SizedBox(width: 4),
                  ],
                  _SmallPaneBtn(
                    icon: LucideIcons.stickyNote,
                    label: isZh ? '黑板' : 'Board',
                    onTap: () {
                      widget.onHaptic(HapticPattern.medium);
                      setState(() => _blackboardMode = true);
                    },
                  ),
                ],
              ),
            ),

            // Filter & Search Toolbar
            if (widget.annotations.isNotEmpty)
              Container(
                padding: const EdgeInsets.fromLTRB(10, 6, 10, 6),
                decoration: BoxDecoration(
                  color: t.bgSurface,
                  border: Border(bottom: BorderSide(color: t.borderSubtle)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    SizedBox(
                      height: 30,
                      child: TextField(
                        controller: _searchCtrl,
                        onChanged: (val) =>
                            setState(() => _annFilter = _annFilter.copyWith(query: val)),
                        style: TextStyle(fontSize: 12, color: t.textPrimary),
                        decoration: InputDecoration(
                          isDense: true,
                          contentPadding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
                          prefixIcon: Icon(LucideIcons.search, size: 12, color: t.textMuted),
                          prefixIconConstraints:
                              const BoxConstraints(minWidth: 26, minHeight: 26),
                          suffixIcon: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              if (_annFilter.query.isNotEmpty)
                                IconButton(
                                  onPressed: () {
                                    _searchCtrl.clear();
                                    setState(() => _annFilter = _annFilter.copyWith(query: ''));
                                  },
                                  icon: Icon(LucideIcons.x, size: 12, color: t.textMuted),
                                  padding: EdgeInsets.zero,
                                  constraints: const BoxConstraints(minWidth: 22, minHeight: 22),
                                ),
                              Padding(
                                padding: const EdgeInsets.only(right: 6),
                                child: Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                                  decoration: BoxDecoration(
                                    color: t.bgSubtle,
                                    borderRadius: BorderRadius.circular(6),
                                  ),
                                  child: Text(
                                    '${filteredAnnotations.length}/${allStats.total}',
                                    style: TextStyle(
                                      fontSize: 10,
                                      fontWeight: FontWeight.w600,
                                      color: t.textSecondary,
                                    ),
                                  ),
                                ),
                              ),
                            ],
                          ),
                          hintText: isZh ? '搜索批注、原文或作者...' : 'Search notes, quotes, authors...',
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
                    const SizedBox(height: 5),
                    SingleChildScrollView(
                      scrollDirection: Axis.horizontal,
                      child: Row(
                        children: [
                          _FilterPill(
                            label: '${isZh ? '全部' : 'All'} (${allStats.total})',
                            selected: _annFilter.status == AnnotationStatusFilter.all,
                            onTap: () => setState(() =>
                                _annFilter = _annFilter.copyWith(status: AnnotationStatusFilter.all)),
                          ),
                          const SizedBox(width: 4),
                          _FilterPill(
                            label: '${isZh ? '待处理' : 'Open'} (${allStats.open})',
                            selected: _annFilter.status == AnnotationStatusFilter.open,
                            onTap: () => setState(() =>
                                _annFilter = _annFilter.copyWith(status: AnnotationStatusFilter.open)),
                          ),
                          const SizedBox(width: 4),
                          _FilterPill(
                            label: '${isZh ? '已处理' : 'Handled'} (${allStats.handled})',
                            selected: _annFilter.status == AnnotationStatusFilter.handled,
                            onTap: () => setState(() => _annFilter =
                                _annFilter.copyWith(status: AnnotationStatusFilter.handled)),
                          ),
                          const SizedBox(width: 6),
                          Container(width: 1, height: 14, color: t.borderSubtle),
                          const SizedBox(width: 6),
                          _FilterPill(
                            label: isZh ? '全类型' : 'Any',
                            selected: _annFilter.type == AnnotationTypeFilter.all,
                            onTap: () => setState(() =>
                                _annFilter = _annFilter.copyWith(type: AnnotationTypeFilter.all)),
                          ),
                          const SizedBox(width: 4),
                          _FilterPill(
                            label: '${isZh ? '批注' : 'Comment'} (${allStats.comments})',
                            selected: _annFilter.type == AnnotationTypeFilter.comment,
                            onTap: () => setState(() =>
                                _annFilter = _annFilter.copyWith(type: AnnotationTypeFilter.comment)),
                          ),
                          const SizedBox(width: 4),
                          _FilterPill(
                            label: '${isZh ? '修订' : 'Revision'} (${allStats.revisions})',
                            selected: _annFilter.type == AnnotationTypeFilter.revision,
                            onTap: () => setState(() => _annFilter =
                                _annFilter.copyWith(type: AnnotationTypeFilter.revision)),
                          ),
                        ],
                      ),
                    ),
                    if (!widget.readOnly &&
                        (filteredStats.openRevisions > 0 || filteredStats.openComments > 0)) ...[
                      const SizedBox(height: 5),
                      Wrap(
                        spacing: 6,
                        runSpacing: 4,
                        children: [
                          if (filteredStats.openRevisions > 0 &&
                              widget.onBatchAcceptRevisions != null)
                            _SmallPaneBtn(
                              icon: LucideIcons.check,
                              label: isZh
                                  ? '批量接受 (${filteredStats.openRevisions})'
                                  : 'Accept (${filteredStats.openRevisions})',
                              primary: true,
                              onTap: () {
                                final ids = filteredAnnotations
                                    .where((a) =>
                                        a.type == AnnotationType.revision &&
                                        a.status == AnnotationStatus.open)
                                    .map((a) => a.id)
                                    .toSet();
                                widget.onBatchAcceptRevisions!(ids);
                              },
                            ),
                          if (filteredStats.openRevisions > 0 &&
                              widget.onBatchRejectRevisions != null)
                            _SmallPaneBtn(
                              icon: LucideIcons.x,
                              label: isZh
                                  ? '批量拒绝 (${filteredStats.openRevisions})'
                                  : 'Reject (${filteredStats.openRevisions})',
                              onTap: () {
                                final ids = filteredAnnotations
                                    .where((a) =>
                                        a.type == AnnotationType.revision &&
                                        a.status == AnnotationStatus.open)
                                    .map((a) => a.id)
                                    .toSet();
                                widget.onBatchRejectRevisions!(ids);
                              },
                            ),
                          if (filteredStats.openComments > 0 &&
                              widget.onBatchResolveComments != null)
                            _SmallPaneBtn(
                              icon: LucideIcons.check,
                              label: isZh
                                  ? '批量解决 (${filteredStats.openComments})'
                                  : 'Resolve (${filteredStats.openComments})',
                              onTap: () {
                                final ids = filteredAnnotations
                                    .where((a) =>
                                        a.type == AnnotationType.comment &&
                                        a.status == AnnotationStatus.open)
                                    .map((a) => a.id)
                                    .toSet();
                                widget.onBatchResolveComments!(ids);
                              },
                            ),
                        ],
                      ),
                    ],
                  ],
                ),
              ),

            // Body
            Expanded(
              child: current == null
                  ? Center(
                      child: Padding(
                        padding: const EdgeInsets.all(20),
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(
                              widget.annotations.isNotEmpty && _annFilter.isActive
                                  ? (isZh
                                      ? '没有符合筛选条件的批注或修订'
                                      : 'No matching annotations or revisions')
                                  : (isZh ? '当前文档暂无批注与修订' : 'No annotations or revisions'),
                              textAlign: TextAlign.center,
                              style: TextStyle(fontSize: 12.5, color: t.textMuted),
                            ),
                            if (widget.annotations.isNotEmpty && _annFilter.isActive) ...[
                              const SizedBox(height: 8),
                              OutlinedButton(
                                onPressed: () {
                                  _searchCtrl.clear();
                                  setState(() => _annFilter = const AnnotationFilterState());
                                },
                                child: Text(isZh ? '重置筛选' : 'Reset Filters'),
                              ),
                            ],
                          ],
                        ),
                      ),
                    )
                  : _showListOverview
                      ? ListView.separated(
                          padding: const EdgeInsets.all(10),
                          itemCount: ordered.length,
                          separatorBuilder: (_, __) => const SizedBox(height: 6),
                          itemBuilder: (context, listIdx) {
                            final ann = ordered[listIdx];
                            final isComment = ann.type == AnnotationType.comment;
                            final isSel = ann.id == current.id;
                            final typeColor = isComment ? t.commentColor : t.revisionColor;
                            return InkWell(
                              borderRadius: BorderRadius.circular(10),
                              onTap: () {
                                _switchToNote(ann.id, current);
                                setState(() => _showListOverview = false);
                              },
                              child: ArcCardSurface(
                                isActive: isSel,
                                padding: const EdgeInsets.all(10),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Row(
                                      children: [
                                        Text(
                                          '#${listIdx + 1}',
                                          style: TextStyle(fontSize: 11, color: t.textMuted),
                                        ),
                                        const SizedBox(width: 5),
                                        Icon(
                                          isComment
                                              ? LucideIcons.messageSquare
                                              : LucideIcons.gitPullRequestDraft,
                                          size: 12,
                                          color: typeColor,
                                        ),
                                        const SizedBox(width: 5),
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
                                        Container(
                                          padding: const EdgeInsets.symmetric(
                                              horizontal: 6, vertical: 2),
                                          decoration: BoxDecoration(
                                            color: t.bgSubtle,
                                            borderRadius: BorderRadius.circular(6),
                                          ),
                                          child: Text(
                                            ann.status == AnnotationStatus.open
                                                ? (isZh ? '待处理' : 'Open')
                                                : ann.status.wire,
                                            style: TextStyle(
                                              fontSize: 10,
                                              color: t.textSecondary,
                                            ),
                                          ),
                                        ),
                                      ],
                                    ),
                                    const SizedBox(height: 4),
                                    Text(
                                      isComment
                                          ? (ann.commentText?.isNotEmpty == true
                                              ? ann.commentText!
                                              : ann.originalText)
                                          : '${ann.originalText} → ${ann.suggestedText ?? (isZh ? '(删除)' : '(delete)')}',
                                      maxLines: 2,
                                      overflow: TextOverflow.ellipsis,
                                      style: TextStyle(fontSize: 12, color: t.textSecondary),
                                    ),
                                  ],
                                ),
                              ),
                            );
                          },
                        )
                      : _buildDetailCard(
                          context: context,
                          isZh: isZh,
                          current: current,
                          currentDraftText: currentDraftText,
                        ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildDetailCard({
    required BuildContext context,
    required bool isZh,
    required AnnotationItem current,
    required String currentDraftText,
  }) {
    final t = context.arcTheme;
    final isComment = current.type == AnnotationType.comment;
    final typeColor = isComment ? t.commentColor : t.revisionColor;

    return SingleChildScrollView(
      padding: const EdgeInsets.all(12),
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 720),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                    decoration: BoxDecoration(
                      color: typeColor.withValues(alpha: 0.14),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          isComment
                              ? LucideIcons.messageSquare
                              : LucideIcons.gitPullRequestDraft,
                          size: 11,
                          color: typeColor,
                        ),
                        const SizedBox(width: 4),
                        Text(
                          isComment
                              ? (isZh ? '批注' : 'Comment')
                              : (isZh ? '修订' : 'Revision'),
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w700,
                            color: typeColor,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      current.author,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: 12.5,
                        fontWeight: FontWeight.w700,
                        color: t.textPrimary,
                      ),
                    ),
                  ),
                  _SmallPaneBtn(
                    icon: LucideIcons.crosshair,
                    label: isZh ? '定位原文' : 'Locate',
                    onTap: () {
                      widget.onHaptic(HapticPattern.selection);
                      widget.onLocate(current.id);
                    },
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                decoration: BoxDecoration(
                  color: t.bgSubtle,
                  borderRadius: BorderRadius.circular(8),
                  border: Border(left: BorderSide(color: typeColor, width: 3)),
                ),
                child: Text(
                  '“${current.originalText}”',
                  style: TextStyle(
                    fontSize: 12,
                    color: t.textSecondary,
                    height: 1.45,
                  ),
                ),
              ),
              if (current.commentText != null && current.commentText!.isNotEmpty) ...[
                const SizedBox(height: 8),
                Text(
                  current.commentText!,
                  style: TextStyle(fontSize: 12.5, height: 1.5, color: t.textPrimary),
                ),
              ],
              if (current.suggestedText != null && current.suggestedText!.isNotEmpty) ...[
                const SizedBox(height: 8),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
                  decoration: BoxDecoration(
                    color: t.accentSoft,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: RichText(
                    text: TextSpan(
                      style: TextStyle(fontSize: 12, color: t.textPrimary),
                      children: [
                        TextSpan(text: isZh ? '建议修改为：' : 'Suggested: '),
                        TextSpan(
                          text: current.suggestedText!,
                          style: TextStyle(fontWeight: FontWeight.w700, color: t.accent),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
              const SizedBox(height: 10),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    isZh ? '便签草稿 / 回复' : 'Note Draft / Reply',
                    style: TextStyle(fontSize: 11.5, color: t.textMuted),
                  ),
                  if (currentDraftText.trim().isNotEmpty)
                    Text(
                      isZh ? '已绑定当前便签' : 'Bound to note',
                      style: TextStyle(
                        fontSize: 11.5,
                        fontWeight: FontWeight.w700,
                        color: t.accent,
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 4),
              Row(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Expanded(
                    child: TextField(
                      controller: _draftCtrl,
                      enabled: !widget.readOnly,
                      minLines: 2,
                      maxLines: 4,
                      onChanged: (val) => _updateCurrentDraft(current.id, val),
                      style: TextStyle(fontSize: 12.5, color: t.textPrimary),
                      decoration: InputDecoration(
                        isDense: true,
                        filled: true,
                        fillColor: t.bgApp,
                        contentPadding:
                            const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                        hintText: isZh
                            ? '输入未保存草稿或回复内容...'
                            : 'Write draft or reply...',
                        hintStyle: TextStyle(fontSize: 12, color: t.textMuted),
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
                  const SizedBox(width: 6),
                  FilledButton(
                    onPressed: (!widget.readOnly && currentDraftText.trim().isNotEmpty)
                        ? () {
                            widget.onHaptic(HapticPattern.success);
                            widget.onReplyComment(current.id, currentDraftText.trim());
                            _draftCtrl.clear();
                            _updateCurrentDraft(current.id, '');
                          }
                        : null,
                    style: FilledButton.styleFrom(
                      minimumSize: const Size(38, 34),
                      padding: const EdgeInsets.symmetric(horizontal: 10),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(8),
                      ),
                    ),
                    child: const Icon(LucideIcons.send, size: 14),
                  ),
                ],
              ),
              if (current.replies.isNotEmpty) ...[
                const SizedBox(height: 8),
                ...current.replies.map(
                  (r) => Padding(
                    padding: const EdgeInsets.only(bottom: 4),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 6),
                      decoration: BoxDecoration(
                        color: t.bgSubtle,
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: RichText(
                        text: TextSpan(
                          style: TextStyle(fontSize: 11.5, color: t.textPrimary),
                          children: [
                            TextSpan(
                              text: '${r.author}: ',
                              style: const TextStyle(fontWeight: FontWeight.w700),
                            ),
                            TextSpan(text: r.text),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
              ],
              const SizedBox(height: 10),
              Wrap(
                spacing: 6,
                runSpacing: 6,
                children: [
                  if (!isComment) ...[
                    FilledButton.icon(
                      onPressed: widget.readOnly
                          ? null
                          : () {
                              widget.onHaptic(HapticPattern.success);
                              widget.onAcceptRevision(current.id);
                            },
                      icon: const Icon(LucideIcons.check, size: 13),
                      label: Text(
                        isZh ? '采纳修订' : 'Accept',
                        style: const TextStyle(fontSize: 12),
                      ),
                      style: FilledButton.styleFrom(
                        minimumSize: const Size(0, 32),
                        padding: const EdgeInsets.symmetric(horizontal: 10),
                      ),
                    ),
                    OutlinedButton.icon(
                      onPressed: widget.readOnly
                          ? null
                          : () {
                              widget.onHaptic(HapticPattern.warning);
                              widget.onRejectRevision(current.id);
                            },
                      icon: const Icon(LucideIcons.rotateCcw, size: 13),
                      label: Text(
                        isZh ? '拒绝' : 'Reject',
                        style: const TextStyle(fontSize: 12),
                      ),
                      style: OutlinedButton.styleFrom(
                        minimumSize: const Size(0, 32),
                        padding: const EdgeInsets.symmetric(horizontal: 10),
                      ),
                    ),
                  ] else
                    OutlinedButton.icon(
                      onPressed: widget.readOnly
                          ? null
                          : () {
                              widget.onHaptic(HapticPattern.medium);
                              widget.onToggleResolveComment(current.id);
                            },
                      icon: const Icon(LucideIcons.check, size: 13),
                      label: Text(
                        current.status == AnnotationStatus.open
                            ? (isZh ? '标记解决' : 'Resolve')
                            : (isZh ? '重新打开' : 'Reopen'),
                        style: const TextStyle(fontSize: 12),
                      ),
                      style: OutlinedButton.styleFrom(
                        minimumSize: const Size(0, 32),
                        padding: const EdgeInsets.symmetric(horizontal: 10),
                      ),
                    ),
                  OutlinedButton.icon(
                    onPressed: _aiLoading ? null : () => _handleAiRewrite(current),
                    icon: const Icon(LucideIcons.sparkles, size: 13),
                    label: Text(
                      _aiLoading
                          ? (isZh ? '生成中...' : 'Thinking...')
                          : (isZh ? 'AI 改写建议' : 'AI Rewrite'),
                      style: const TextStyle(fontSize: 12),
                    ),
                    style: OutlinedButton.styleFrom(
                      minimumSize: const Size(0, 32),
                      padding: const EdgeInsets.symmetric(horizontal: 10),
                    ),
                  ),
                ],
              ),
              if (_aiPreview != null && _aiPreview!.annId == current.id) ...[
                const SizedBox(height: 8),
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: _aiPreview!.error
                        ? t.revisionColor.withValues(alpha: 0.1)
                        : t.accentSoft,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(
                      color: _aiPreview!.error
                          ? t.revisionColor.withValues(alpha: 0.4)
                          : t.accent.withValues(alpha: 0.35),
                    ),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Text(
                        _aiPreview!.text,
                        style: TextStyle(
                          fontSize: 12,
                          height: 1.5,
                          color: _aiPreview!.error ? t.revisionColor : t.textPrimary,
                        ),
                      ),
                      if (!_aiPreview!.error) ...[
                        const SizedBox(height: 6),
                        Align(
                          alignment: Alignment.centerRight,
                          child: FilledButton(
                            onPressed: widget.readOnly
                                ? null
                                : () {
                                    widget.onHaptic(HapticPattern.success);
                                    widget.onApplyAiSuggestion(
                                        current.id, _aiPreview!.text);
                                    setState(() => _aiPreview = null);
                                  },
                            style: FilledButton.styleFrom(
                              minimumSize: const Size(0, 28),
                              padding: const EdgeInsets.symmetric(horizontal: 10),
                            ),
                            child: Text(
                              isZh ? '应用到正文' : 'Apply',
                              style: const TextStyle(fontSize: 11.5),
                            ),
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildBlackboardView({
    required bool isZh,
    required List<AnnotationItem> ordered,
    required AnnotationItem? current,
    required String currentDraftText,
  }) {
    final q = _boardSearch.trim().toLowerCase();
    final filteredNotes = q.isEmpty
        ? ordered
        : ordered.where((a) {
            final draft = _draftsByAnnId[a.id]?.text ?? '';
            return a.originalText.toLowerCase().contains(q) ||
                (a.commentText ?? '').toLowerCase().contains(q) ||
                (a.suggestedText ?? '').toLowerCase().contains(q) ||
                a.author.toLowerCase().contains(q) ||
                draft.toLowerCase().contains(q);
          }).toList();

    final commentNotes =
        filteredNotes.where((a) => a.type == AnnotationType.comment).toList();
    final revisionNotes =
        filteredNotes.where((a) => a.type == AnnotationType.revision).toList();
    final sections = _extractSections();

    return Container(
      key: widget.tourKey,
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF16181D), Color(0xFF121418), Color(0xFF0E1014)],
        ),
      ),
      child: Stack(
        children: [
          const Positioned.fill(
            child: IgnorePointer(
              child: CustomPaint(painter: _DotGridPainter()),
            ),
          ),
          Column(
            children: [
              // Blackboard Top Toolbar
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
                decoration: const BoxDecoration(
                  color: Color(0xC70F1115),
                  border: Border(
                    bottom: BorderSide(color: Color(0x17FFFFFF)),
                  ),
                ),
                child: Row(
                  children: [
                    const Icon(LucideIcons.stickyNote, size: 14, color: Color(0xFFFBBF24)),
                    const SizedBox(width: 6),
                    Text(
                      isZh ? '审阅黑板' : 'Review Board',
                      style: const TextStyle(
                        fontSize: 12.5,
                        fontWeight: FontWeight.w700,
                        color: Color(0xFFF8FAFC),
                      ),
                    ),
                    const SizedBox(width: 6),
                    Text(
                      '${commentNotes.length} · ${revisionNotes.length}',
                      style: const TextStyle(
                        fontSize: 10.5,
                        color: Color(0x99F8FAFC),
                      ),
                    ),
                    const Spacer(),
                    Flexible(
                      child: SingleChildScrollView(
                        scrollDirection: Axis.horizontal,
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            _BbToolbarBtn(
                              icon: LucideIcons.palette,
                              label: isZh ? '贴纸库' : 'Stickers',
                              onTap: () {
                                widget.onHaptic(HapticPattern.selection);
                                setState(() => _stickerLibraryOpen = true);
                              },
                            ),
                            const SizedBox(width: 4),
                            _BbToolbarBtn(
                              icon: LucideIcons.locateFixed,
                              label: isZh ? '回到中心' : 'Center',
                              onTap: () {
                                widget.onHaptic(HapticPattern.selection);
                                setState(() {
                                  _boardTransformCtrl.value = Matrix4.identity();
                                });
                              },
                            ),
                            const SizedBox(width: 4),
                            _BbToolbarBtn(
                              icon: LucideIcons.zoomOut,
                              onTap: () => _zoomBlackboard(-0.15),
                            ),
                            const SizedBox(width: 4),
                            _BbToolbarBtn(
                              icon: LucideIcons.zoomIn,
                              onTap: () => _zoomBlackboard(0.15),
                            ),
                            const SizedBox(width: 4),
                            InkWell(
                              borderRadius: BorderRadius.circular(7),
                              onTap: () {
                                widget.onHaptic(HapticPattern.light);
                                setState(() => _blackboardMode = false);
                              },
                              child: Container(
                                height: 26,
                                padding: const EdgeInsets.symmetric(horizontal: 9),
                                alignment: Alignment.center,
                                decoration: BoxDecoration(
                                  color: const Color(0xFFD97706),
                                  borderRadius: BorderRadius.circular(7),
                                ),
                                child: Text(
                                  isZh ? '返回编辑' : 'Edit',
                                  style: const TextStyle(
                                    fontSize: 11,
                                    fontWeight: FontWeight.w700,
                                    color: Colors.white,
                                  ),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),

              // 2D Interactive Caseboard World
              Expanded(
                child: InteractiveViewer(
                  transformationController: _boardTransformCtrl,
                  constrained: false,
                  boundaryMargin: const EdgeInsets.all(600),
                  minScale: 0.5,
                  maxScale: 1.9,
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(28, 24, 48, 120),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          isZh ? 'ROW 01 · 批注便签' : 'ROW 01 · COMMENTS',
                          style: const TextStyle(
                            fontSize: 10.5,
                            fontWeight: FontWeight.w800,
                            letterSpacing: 1.0,
                            color: Color(0xC7FBBF24),
                          ),
                        ),
                        const SizedBox(height: 12),
                        if (commentNotes.isEmpty)
                          _EmptyBoardBadge(
                            label: isZh ? '暂无批注便签' : 'No comment notes',
                          )
                        else
                          Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              for (var i = 0; i < commentNotes.length; i++) ...[
                                if (i > 0) const SizedBox(width: 28),
                                _buildBoardNode(
                                  ann: commentNotes[i],
                                  isComment: true,
                                  idx: i,
                                  isZh: isZh,
                                  current: current,
                                ),
                              ],
                            ],
                          ),
                        const SizedBox(height: 44),
                        Container(
                          width: 480,
                          height: 1,
                          color: const Color(0x38FBBF24),
                        ),
                        const SizedBox(height: 22),
                        Text(
                          isZh ? 'ROW 02 · 修订便签' : 'ROW 02 · REVISIONS',
                          style: const TextStyle(
                            fontSize: 10.5,
                            fontWeight: FontWeight.w800,
                            letterSpacing: 1.0,
                            color: Color(0xC7FBBF24),
                          ),
                        ),
                        const SizedBox(height: 12),
                        if (revisionNotes.isEmpty)
                          _EmptyBoardBadge(
                            label: isZh ? '暂无修订便签' : 'No revision notes',
                          )
                        else
                          Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              for (var i = 0; i < revisionNotes.length; i++) ...[
                                if (i > 0) const SizedBox(width: 28),
                                _buildBoardNode(
                                  ann: revisionNotes[i],
                                  isComment: false,
                                  idx: i,
                                  isZh: isZh,
                                  current: current,
                                ),
                              ],
                            ],
                          ),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),

          // Bottom Search & Chapter Sections Capsule
          Positioned(
            left: 12,
            right: 12,
            bottom: 10,
            child: Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 680),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(
                    color: const Color(0xE014171E),
                    borderRadius: BorderRadius.circular(999),
                    border: Border.all(color: const Color(0x28FFFFFF)),
                    boxShadow: const [
                      BoxShadow(
                        color: Color(0x55000000),
                        blurRadius: 14,
                        offset: Offset(0, 4),
                      ),
                    ],
                  ),
                  child: Row(
                    children: [
                      const Icon(LucideIcons.search, size: 13, color: Color(0xB8F8FAFC)),
                      const SizedBox(width: 6),
                      SizedBox(
                        width: 128,
                        child: TextField(
                          controller: _boardSearchCtrl,
                          onChanged: (val) => setState(() => _boardSearch = val),
                          style: const TextStyle(fontSize: 11.5, color: Color(0xFFF8FAFC)),
                          decoration: InputDecoration(
                            isDense: true,
                            border: InputBorder.none,
                            contentPadding: const EdgeInsets.symmetric(vertical: 4),
                            hintText: isZh ? '搜索便签/草稿...' : 'Search notes...',
                            hintStyle: const TextStyle(
                              fontSize: 11.5,
                              color: Color(0x88F8FAFC),
                            ),
                          ),
                        ),
                      ),
                      if (sections.isNotEmpty) ...[
                        Container(
                          width: 1,
                          height: 16,
                          color: const Color(0x28FFFFFF),
                          margin: const EdgeInsets.symmetric(horizontal: 6),
                        ),
                        const Icon(LucideIcons.layers, size: 13, color: Color(0xFFFBBF24)),
                        const SizedBox(width: 6),
                        Expanded(
                          child: SingleChildScrollView(
                            scrollDirection: Axis.horizontal,
                            child: Row(
                              children: sections.map((sec) {
                                final isAct = _activeSectionPos == sec.pos;
                                return Padding(
                                  padding: const EdgeInsets.only(right: 5),
                                  child: InkWell(
                                    borderRadius: BorderRadius.circular(999),
                                    onTap: () {
                                      widget.onHaptic(HapticPattern.selection);
                                      setState(() => _activeSectionPos = sec.pos);
                                      widget.onJumpToPosition(sec.pos);
                                    },
                                    child: Container(
                                      padding: const EdgeInsets.symmetric(
                                          horizontal: 8, vertical: 4),
                                      decoration: BoxDecoration(
                                        color: isAct
                                            ? const Color(0xFFD97706)
                                            : const Color(0x14FFFFFF),
                                        borderRadius: BorderRadius.circular(999),
                                      ),
                                      child: Text(
                                        sec.title,
                                        style: TextStyle(
                                          fontSize: 11,
                                          fontWeight:
                                              isAct ? FontWeight.w700 : FontWeight.w500,
                                          color: const Color(0xFFF8FAFC),
                                        ),
                                      ),
                                    ),
                                  ),
                                );
                              }).toList(),
                            ),
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ),
            ),
          ),

          // Sticker Library Modal
          if (_stickerLibraryOpen)
            _buildStickerLibraryOverlay(
              isZh: isZh,
              current: current,
              currentDraftText: currentDraftText,
            ),

          // View Sticker Content Modal
          if (_viewingStickerArchive != null)
            _buildViewingStickerOverlay(isZh: isZh),

          // Edit Board Sticker Modal
          if (_editingStickerArchive != null)
            _buildEditingStickerOverlay(isZh: isZh),
        ],
      ),
    );
  }

  Widget _buildBoardNode({
    required AnnotationItem ann,
    required bool isComment,
    required int idx,
    required bool isZh,
    required AnnotationItem? current,
  }) {
    final draft = _draftsByAnnId[ann.id]?.text ?? '';
    final isSel = ann.id == current?.id;
    final noteStickers =
        widget.archiveStickers.where((s) => s.annId == ann.id).toList();
    final tiltDeg = idx % 3 == 0 ? -1.4 : (idx % 3 == 1 ? 1.1 : -0.5);
    final angleRad = isSel ? 0.0 : tiltDeg * math.pi / 180.0;
    final pinColor =
        isComment ? const Color(0xFF2563EB) : const Color(0xFFDC2626);
    final barColor =
        isComment ? const Color(0xFF3B82F6) : const Color(0xFFEF4444);

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Transform.rotate(
          angle: angleRad,
          child: Transform.scale(
            scale: isSel ? 1.03 : 1.0,
            child: GestureDetector(
              onTap: () {
                if (ann.id == current?.id) {
                  widget.onHaptic(HapticPattern.light);
                  setState(() => _blackboardMode = false);
                } else {
                  _switchToNote(ann.id, current);
                }
              },
              onDoubleTap: () {
                _switchToNote(ann.id, current);
                setState(() => _blackboardMode = false);
              },
              child: Stack(
                clipBehavior: Clip.none,
                alignment: Alignment.topCenter,
                children: [
                  Container(
                    width: 210,
                    padding: const EdgeInsets.fromLTRB(14, 20, 14, 14),
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                        colors: isComment
                            ? const [Color(0xFFFFFDF4), Color(0xFFFEF9E6)]
                            : const [Color(0xFFFFF8F8), Color(0xFFFEF0F0)],
                      ),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                        color: isSel
                            ? const Color(0xFF60A5FA)
                            : Colors.white.withValues(alpha: 0.65),
                        width: isSel ? 2 : 1,
                      ),
                      boxShadow: const [
                        BoxShadow(
                          color: Color(0x61000000),
                          blurRadius: 22,
                          offset: Offset(0, 10),
                        ),
                      ],
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Expanded(
                              child: Text(
                                ann.author,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(
                                  fontSize: 10.5,
                                  fontWeight: FontWeight.w700,
                                  color: Color(0xFF475569),
                                ),
                              ),
                            ),
                            Text(
                              ann.status == AnnotationStatus.open
                                  ? (isComment
                                      ? (isZh ? '待处理' : 'Open')
                                      : (isZh ? '待修订' : 'Open'))
                                  : (isZh ? '已处理' : ann.status.wire),
                              style: const TextStyle(
                                fontSize: 10.5,
                                fontWeight: FontWeight.w700,
                                color: Color(0xFF475569),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 6),
                        Text(
                          '“${ann.originalText}”',
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                            color: Color(0xFF0F172A),
                          ),
                        ),
                        if (isComment &&
                            ann.commentText != null &&
                            ann.commentText!.isNotEmpty) ...[
                          const SizedBox(height: 5),
                          Text(
                            ann.commentText!,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              fontSize: 11,
                              color: Color(0xFF334155),
                            ),
                          ),
                        ],
                        if (!isComment &&
                            ann.suggestedText != null &&
                            ann.suggestedText!.isNotEmpty) ...[
                          const SizedBox(height: 5),
                          Text(
                            '→ ${ann.suggestedText}',
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w600,
                              color: Color(0xFFB91C1C),
                            ),
                          ),
                        ],
                        if (draft.trim().isNotEmpty) ...[
                          const SizedBox(height: 6),
                          Container(
                            width: double.infinity,
                            padding: const EdgeInsets.symmetric(
                                horizontal: 6, vertical: 3),
                            decoration: BoxDecoration(
                              color: const Color(0x1A0F172A),
                              borderRadius: BorderRadius.circular(5),
                            ),
                            child: Text(
                              '${isZh ? '未保存草稿：' : 'Draft: '}$draft',
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                fontSize: 10.5,
                                fontWeight: FontWeight.w600,
                                color: Color(0xFF0F172A),
                              ),
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                  // Top accent bar
                  Positioned(
                    top: 0,
                    left: 14,
                    right: 14,
                    child: Container(
                      height: 3,
                      decoration: BoxDecoration(
                        color: barColor.withValues(alpha: 0.78),
                        borderRadius: const BorderRadius.vertical(
                          bottom: Radius.circular(4),
                        ),
                      ),
                    ),
                  ),
                  // Pushpin
                  Positioned(
                    top: -7,
                    child: Container(
                      width: 14,
                      height: 14,
                      decoration: BoxDecoration(
                        color: pinColor,
                        shape: BoxShape.circle,
                        border: Border.all(color: Colors.white, width: 2),
                        boxShadow: const [
                          BoxShadow(
                            color: Color(0x73000000),
                            blurRadius: 6,
                            offset: Offset(0, 3),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),

        // Attached Archive Stickers Column (newest at bottom)
        if (noteStickers.isNotEmpty) ...[
          Container(
            width: 2,
            height: 16,
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [Color(0xFFDC2626), Color(0xFF991B1B)],
              ),
            ),
          ),
          ...noteStickers.map((arc) {
            final stk = widget.allStickers.firstWhere(
              (s) => s.id == arc.stickerId,
              orElse: () => widget.allStickers.isNotEmpty
                  ? widget.allStickers.first
                  : kDefaultBasicStickers.first,
            );
            final hash = arc.id.codeUnits.fold<int>(0, (a, b) => a + b);
            final slipTilt = (hash % 2 == 0 ? -1.4 : 1.3) * math.pi / 180.0;
            final stripMode = isStripImageSticker(stk);

            return Padding(
              padding: const EdgeInsets.only(top: 6),
              child: Transform.rotate(
                angle: slipTilt,
                child: GestureDetector(
                  onTap: () {
                    widget.onHaptic(HapticPattern.selection);
                    setState(() => _viewingStickerArchive = arc);
                  },
                  onLongPress: () {
                    widget.onHaptic(HapticPattern.medium);
                    _openEditStickerModal(arc);
                  },
                  child: stripMode
                      ? StickerVisual(
                          sticker: stk,
                          textStyle: getEffectiveStickerTextStyle(stk, arc),
                          fallbackText: arc.draftText,
                          mode: StickerVisualMode.board,
                          isZh: isZh,
                        )
                      : _buildBasicArchiveSlip(stk, arc),
                ),
              ),
            );
          }),
        ],
      ],
    );
  }

  Widget _buildBasicArchiveSlip(
    ReviewStickerDef stk,
    ReviewArchiveStickerItem arc,
  ) {
    final accent = parseStickerHexColor(stk.color, const Color(0xFF6366F1));
    final timeStr = DateFormat('HH:mm').format(
      DateTime.fromMillisecondsSinceEpoch(arc.savedAt),
    );
    final pngBytes = decodeStickerPngBytes(stk.pngDataUrl);

    return Container(
      width: 192,
      padding: const EdgeInsets.fromLTRB(10, 8, 10, 8),
      decoration: BoxDecoration(
        color: const Color(0xD91E2430),
        borderRadius: BorderRadius.circular(9),
        border: Border(
          left: BorderSide(color: accent, width: 3.5),
          top: const BorderSide(color: Color(0x26FFFFFF)),
          right: const BorderSide(color: Color(0x26FFFFFF)),
          bottom: const BorderSide(color: Color(0x26FFFFFF)),
        ),
        boxShadow: const [
          BoxShadow(
            color: Color(0x4D000000),
            blurRadius: 10,
            offset: Offset(0, 4),
          ),
        ],
      ),
      child: Row(
        children: [
          if (pngBytes != null)
            Image.memory(pngBytes, width: 18, height: 18, fit: BoxFit.contain)
          else
            Text(stk.emoji ?? '🏷️', style: const TextStyle(fontSize: 16)),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        stk.label,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontSize: 10.5,
                          fontWeight: FontWeight.w700,
                          color: Color(0xFFF8FAFC),
                        ),
                      ),
                    ),
                    Text(
                      timeStr,
                      style: const TextStyle(
                        fontSize: 9.5,
                        color: Color(0xA6F8FAFC),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 2),
                if (arc.textOverlay != null &&
                    (arc.textOverlay!.text.trim().isNotEmpty ||
                        arc.draftText.trim().isNotEmpty))
                  StickerOverlayText(
                    style: arc.textOverlay!,
                    fallbackText: arc.draftText,
                    maxLines: 1,
                    scale: 0.86,
                  )
                else
                  Text(
                    arc.draftText,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 10.5,
                      color: Color(0xC7F8FAFC),
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildModalShell({
    required Widget header,
    required Widget body,
    required Widget footer,
    required VoidCallback onDismiss,
    double maxWidth = 460,
  }) {
    return Positioned.fill(
      child: GestureDetector(
        onTap: onDismiss,
        child: Container(
          color: const Color(0x99000000),
          alignment: Alignment.center,
          padding: const EdgeInsets.all(14),
          child: GestureDetector(
            onTap: () {},
            child: ConstrainedBox(
              constraints: BoxConstraints(
                maxWidth: maxWidth,
                maxHeight: MediaQuery.sizeOf(context).height * 0.82,
              ),
              child: Container(
                decoration: BoxDecoration(
                  color: const Color(0xFF1A1F29),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: const Color(0x28FFFFFF)),
                  boxShadow: const [
                    BoxShadow(
                      color: Color(0x88000000),
                      blurRadius: 28,
                      offset: Offset(0, 10),
                    ),
                  ],
                ),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Padding(
                      padding: const EdgeInsets.fromLTRB(14, 12, 10, 10),
                      child: header,
                    ),
                    const Divider(height: 1, color: Color(0x1EFFFFFF)),
                    Flexible(
                      child: SingleChildScrollView(
                        padding: const EdgeInsets.all(14),
                        child: body,
                      ),
                    ),
                    const Divider(height: 1, color: Color(0x1EFFFFFF)),
                    Padding(
                      padding: const EdgeInsets.all(12),
                      child: footer,
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildStickerLibraryOverlay({
    required bool isZh,
    required AnnotationItem? current,
    required String currentDraftText,
  }) {
    final selectedStk = widget.allStickers.firstWhere(
      (s) => s.id == _librarySelectedStickerId,
      orElse: () => widget.allStickers.isNotEmpty
          ? widget.allStickers.first
          : kJournalStripStickers.first,
    );
    const customColorSwatches = [
      '#0ea5e9',
      '#6366f1',
      '#10b981',
      '#f59e0b',
      '#ef4444',
      '#ec4899',
    ];

    return _buildModalShell(
      onDismiss: () => setState(() => _stickerLibraryOpen = false),
      maxWidth: 500,
      header: Row(
        children: [
          Expanded(
            child: Text(
              isZh ? '贴纸库（手帐贴纸 & 文字叠加）' : 'Sticker Library & Text Overlay',
              style: const TextStyle(
                fontSize: 13.5,
                fontWeight: FontWeight.w700,
                color: Color(0xFFF8FAFC),
              ),
            ),
          ),
          _BbToolbarBtn(
            icon: LucideIcons.x,
            onTap: () => setState(() => _stickerLibraryOpen = false),
          ),
        ],
      ),
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          StickerPickerTabs(
            allStickers: widget.allStickers,
            selectedStickerId: selectedStk.id,
            activeTab: _libraryTab,
            onTabChange: (tab) => setState(() => _libraryTab = tab),
            onSelect: (stk) {
              widget.onHaptic(HapticPattern.selection);
              setState(() {
                _librarySelectedStickerId = stk.id;
                if (stk.defaultTextStyle != null) {
                  _libraryTextStyle = stk.defaultTextStyle!.copyWith(
                    text: _libraryTextStyle.text.isNotEmpty
                        ? _libraryTextStyle.text
                        : stk.defaultTextStyle!.text,
                  );
                } else if (!_libraryUserTouchedColor) {
                  _libraryTextStyle = _libraryTextStyle.copyWith(
                    color: stk.defaultTextColor ?? _libraryTextStyle.color,
                    strokeColor:
                        stk.defaultStrokeColor ?? _libraryTextStyle.strokeColor,
                  );
                }
              });
            },
            onDeleteCustomSticker: widget.onDeleteCustomSticker,
            isZh: isZh,
            surface: StickerSurface.dark,
          ),
          const SizedBox(height: 10),
          Container(
            padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 10),
            decoration: BoxDecoration(
              color: const Color(0xFF11141B),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0x1EFFFFFF)),
            ),
            child: Center(
              child: StickerVisual(
                sticker: selectedStk,
                textStyle: _libraryTextStyle,
                mode: StickerVisualMode.preview,
                isZh: isZh,
              ),
            ),
          ),
          const SizedBox(height: 10),
          StickerTextStyleControls(
            value: _libraryTextStyle,
            onChange: (next) => setState(() => _libraryTextStyle = next),
            onColorTouched: () => _libraryUserTouchedColor = true,
            isZh: isZh,
            surface: StickerSurface.dark,
            compact: true,
            draftFallbackText: currentDraftText,
          ),
          if (_libraryTab == StickerCategory.custom) ...[
            const SizedBox(height: 10),
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: const Color(0x0DFFFFFF),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: const Color(0x22FFFFFF)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: TextField(
                          controller: _customNameCtrl,
                          style: const TextStyle(
                              fontSize: 12, color: Color(0xFFF8FAFC)),
                          decoration: InputDecoration(
                            isDense: true,
                            contentPadding: const EdgeInsets.symmetric(
                                horizontal: 8, vertical: 7),
                            hintText: isZh ? '新建贴纸名称' : 'New sticker name',
                            hintStyle: const TextStyle(
                                fontSize: 12, color: Color(0x80F8FAFC)),
                            filled: true,
                            fillColor: const Color(0x14FFFFFF),
                            border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(8),
                              borderSide:
                                  const BorderSide(color: Color(0x22FFFFFF)),
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 6),
                      SizedBox(
                        width: 48,
                        child: TextField(
                          controller: _customEmojiCtrl,
                          textAlign: TextAlign.center,
                          style: const TextStyle(
                              fontSize: 13, color: Color(0xFFF8FAFC)),
                          decoration: InputDecoration(
                            isDense: true,
                            contentPadding: const EdgeInsets.symmetric(
                                horizontal: 4, vertical: 6),
                            filled: true,
                            fillColor: const Color(0x14FFFFFF),
                            border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(8),
                              borderSide:
                                  const BorderSide(color: Color(0x22FFFFFF)),
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      ...customColorSwatches.map((hex) {
                        final act = _customStickerColor == hex;
                        return Padding(
                          padding: const EdgeInsets.only(right: 6),
                          child: InkWell(
                            onTap: () => setState(() => _customStickerColor = hex),
                            borderRadius: BorderRadius.circular(999),
                            child: Container(
                              width: 20,
                              height: 20,
                              decoration: BoxDecoration(
                                color: parseStickerHexColor(hex),
                                shape: BoxShape.circle,
                                border: Border.all(
                                  color: act ? Colors.white : Colors.white24,
                                  width: act ? 2 : 1,
                                ),
                              ),
                            ),
                          ),
                        );
                      }),
                      const Spacer(),
                      _BbToolbarBtn(
                        icon: LucideIcons.plus,
                        label: isZh ? '添加' : 'Add',
                        onTap: () {
                          final newId =
                              'stk-custom-${DateTime.now().millisecondsSinceEpoch}';
                          final name = _customNameCtrl.text.trim();
                          widget.onAddCustomSticker(
                            ReviewStickerDef(
                              id: newId,
                              label: name.isNotEmpty
                                  ? name
                                  : (isZh ? '自定义' : 'Custom'),
                              emoji: _customEmojiCtrl.text.trim().isNotEmpty
                                  ? _customEmojiCtrl.text.trim()
                                  : '🏷️',
                              color: _customStickerColor,
                              category: StickerCategory.custom,
                              isCustom: true,
                            ),
                          );
                          _customNameCtrl.clear();
                          setState(() => _librarySelectedStickerId = newId);
                          widget.onHaptic(HapticPattern.success);
                        },
                      ),
                      const SizedBox(width: 6),
                      _BbToolbarBtn(
                        icon: LucideIcons.imagePlus,
                        label: isZh ? '导入 PNG' : 'PNG',
                        onTap: _handleImportStickerPng,
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
      footer: Wrap(
        spacing: 8,
        runSpacing: 8,
        alignment: WrapAlignment.end,
        children: [
          _BbToolbarBtn(
            icon: LucideIcons.plus,
            label: isZh ? '保存为自定义贴纸' : 'Save as Custom',
            onTap: () {
              final newId =
                  'stk-custom-txt-${DateTime.now().millisecondsSinceEpoch}';
              final tTrim = _libraryTextStyle.text.trim();
              final labelZh = tTrim.isNotEmpty
                  ? (tTrim.length > 10 ? tTrim.substring(0, 10) : tTrim)
                  : selectedStk.label;
              final labelEn = tTrim.isNotEmpty
                  ? (tTrim.length > 14 ? tTrim.substring(0, 14) : tTrim)
                  : (selectedStk.labelEn ?? selectedStk.label);
              widget.onAddCustomSticker(
                ReviewStickerDef(
                  id: newId,
                  label: labelZh,
                  labelEn: labelEn,
                  emoji: selectedStk.emoji,
                  color: selectedStk.color,
                  category: StickerCategory.custom,
                  assetPath: selectedStk.assetPath,
                  pngDataUrl: selectedStk.pngDataUrl,
                  isStripImage: isStripImageSticker(selectedStk),
                  textInset: selectedStk.textInset,
                  defaultTextColor: _libraryTextStyle.color,
                  defaultStrokeColor: _libraryTextStyle.strokeColor,
                  defaultTextStyle: _libraryTextStyle,
                  isCustom: true,
                ),
              );
              setState(() {
                _libraryTab = StickerCategory.custom;
                _librarySelectedStickerId = newId;
              });
              widget.onHaptic(HapticPattern.success);
            },
          ),
          if (current != null)
            FilledButton(
              onPressed: () {
                final now = DateTime.now().millisecondsSinceEpoch;
                final draft = _libraryTextStyle.text.trim().isNotEmpty
                    ? _libraryTextStyle.text.trim()
                    : (currentDraftText.trim().isNotEmpty
                        ? currentDraftText.trim()
                        : (current.originalText.isNotEmpty
                            ? (current.originalText.length > 24
                                ? current.originalText.substring(0, 24)
                                : current.originalText)
                            : current.author));
                final snippet = current.originalText.isNotEmpty
                    ? (current.originalText.length > 24
                        ? current.originalText.substring(0, 24)
                        : current.originalText)
                    : current.author;
                widget.onAddArchiveSticker(
                  ReviewArchiveStickerItem(
                    id: 'arcstk-$now-${math.Random().nextInt(9999)}',
                    annId: current.id,
                    stickerId: selectedStk.id,
                    draftText: draft,
                    snippet: snippet,
                    savedAt: now,
                    textOverlay: _libraryTextStyle,
                  ),
                );
                widget.onHaptic(HapticPattern.success);
                setState(() => _stickerLibraryOpen = false);
              },
              style: FilledButton.styleFrom(
                backgroundColor: const Color(0xFFD97706),
                minimumSize: const Size(0, 32),
              ),
              child: Text(
                isZh ? '贴到当前便签' : 'Attach to Note',
                style: const TextStyle(fontSize: 12),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildViewingStickerOverlay({required bool isZh}) {
    final arc = _viewingStickerArchive!;
    final stk = widget.allStickers.firstWhere(
      (s) => s.id == arc.stickerId,
      orElse: () => widget.allStickers.isNotEmpty
          ? widget.allStickers.first
          : kDefaultBasicStickers.first,
    );
    final effectiveStyle = getEffectiveStickerTextStyle(stk, arc);
    final savedStr = DateFormat('yyyy-MM-dd HH:mm')
        .format(DateTime.fromMillisecondsSinceEpoch(arc.savedAt));

    return _buildModalShell(
      onDismiss: () => setState(() => _viewingStickerArchive = null),
      header: Row(
        children: [
          if (!isStripImageSticker(stk))
            Padding(
              padding: const EdgeInsets.only(right: 6),
              child: Text(stk.emoji ?? '🏷️', style: const TextStyle(fontSize: 18)),
            ),
          Expanded(
            child: Text(
              isZh ? stk.label : (stk.labelEn ?? stk.label),
              style: const TextStyle(
                fontSize: 13.5,
                fontWeight: FontWeight.w700,
                color: Color(0xFFF8FAFC),
              ),
            ),
          ),
          _BbToolbarBtn(
            icon: LucideIcons.x,
            onTap: () => setState(() => _viewingStickerArchive = null),
          ),
        ],
      ),
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (isStripImageSticker(stk)) ...[
            Container(
              padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 10),
              decoration: BoxDecoration(
                color: const Color(0xFF11141B),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0x1EFFFFFF)),
              ),
              child: Center(
                child: StickerVisual(
                  sticker: stk,
                  textStyle: effectiveStyle,
                  fallbackText: arc.draftText,
                  mode: StickerVisualMode.preview,
                  isZh: isZh,
                ),
              ),
            ),
            const SizedBox(height: 10),
          ],
          Text(
            '${arc.snippet} · $savedStr',
            style: const TextStyle(fontSize: 11.5, color: Color(0xAEF8FAFC)),
          ),
          const SizedBox(height: 8),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: const Color(0x12FFFFFF),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: const Color(0x1EFFFFFF)),
            ),
            child: SelectableText(
              arc.draftText,
              style: const TextStyle(
                fontSize: 13,
                height: 1.5,
                color: Color(0xFFF8FAFC),
              ),
            ),
          ),
        ],
      ),
      footer: Wrap(
        spacing: 8,
        runSpacing: 8,
        alignment: WrapAlignment.end,
        children: [
          _BbToolbarBtn(
            icon: LucideIcons.palette,
            label: isZh ? '编辑贴纸' : 'Edit Sticker',
            onTap: () {
              setState(() => _viewingStickerArchive = null);
              _openEditStickerModal(arc);
            },
          ),
          _BbToolbarBtn(
            label: isZh ? '关闭' : 'Close',
            onTap: () => setState(() => _viewingStickerArchive = null),
          ),
          FilledButton(
            onPressed: () {
              widget.onHaptic(HapticPattern.medium);
              _updateCurrentDraft(arc.annId, arc.draftText);
              _lastSyncedDraftAnnId = arc.annId;
              _draftCtrl.value = TextEditingValue(
                text: arc.draftText,
                selection: TextSelection.collapsed(offset: arc.draftText.length),
              );
              widget.onSelect(arc.annId);
              widget.onLocate(arc.annId);
              setState(() {
                _viewingStickerArchive = null;
                _blackboardMode = false;
              });
            },
            style: FilledButton.styleFrom(
              backgroundColor: const Color(0xFFD97706),
              minimumSize: const Size(0, 32),
            ),
            child: Text(
              isZh ? '载入并定位' : 'Load & Locate',
              style: const TextStyle(fontSize: 12),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildEditingStickerOverlay({required bool isZh}) {
    final arc = _editingStickerArchive!;
    final editStk = widget.allStickers.firstWhere(
      (s) => s.id == _editStickerId,
      orElse: () => widget.allStickers.isNotEmpty
          ? widget.allStickers.first
          : kDefaultBasicStickers.first,
    );

    return _buildModalShell(
      onDismiss: () => setState(() => _editingStickerArchive = null),
      maxWidth: 500,
      header: Row(
        children: [
          Expanded(
            child: Text(
              isZh ? '编辑黑板贴纸（样式与叠加文字）' : 'Edit Board Sticker',
              style: const TextStyle(
                fontSize: 13.5,
                fontWeight: FontWeight.w700,
                color: Color(0xFFF8FAFC),
              ),
            ),
          ),
          _BbToolbarBtn(
            icon: LucideIcons.x,
            onTap: () => setState(() => _editingStickerArchive = null),
          ),
        ],
      ),
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Container(
            padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 10),
            decoration: BoxDecoration(
              color: const Color(0xFF11141B),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0x1EFFFFFF)),
            ),
            child: Center(
              child: StickerVisual(
                sticker: editStk,
                textStyle: _editTextStyle,
                fallbackText: arc.draftText,
                mode: StickerVisualMode.preview,
                isZh: isZh,
              ),
            ),
          ),
          const SizedBox(height: 10),
          StickerPickerTabs(
            allStickers: widget.allStickers,
            selectedStickerId: editStk.id,
            activeTab: _editPickerTab,
            onTabChange: (tab) => setState(() => _editPickerTab = tab),
            onSelect: (stk) {
              widget.onHaptic(HapticPattern.selection);
              setState(() {
                _editStickerId = stk.id;
                if (stk.defaultTextStyle != null) {
                  _editTextStyle = stk.defaultTextStyle!.copyWith(
                    text: _editTextStyle.text.isNotEmpty
                        ? _editTextStyle.text
                        : stk.defaultTextStyle!.text,
                  );
                } else if (!_editUserTouchedColor) {
                  _editTextStyle = _editTextStyle.copyWith(
                    color: stk.defaultTextColor ?? _editTextStyle.color,
                    strokeColor:
                        stk.defaultStrokeColor ?? _editTextStyle.strokeColor,
                  );
                }
              });
            },
            isZh: isZh,
            surface: StickerSurface.dark,
          ),
          const SizedBox(height: 10),
          StickerTextStyleControls(
            value: _editTextStyle,
            onChange: (next) => setState(() => _editTextStyle = next),
            onColorTouched: () => _editUserTouchedColor = true,
            draftFallbackText: arc.draftText,
            isZh: isZh,
            surface: StickerSurface.dark,
            compact: true,
          ),
        ],
      ),
      footer: Row(
        mainAxisAlignment: MainAxisAlignment.end,
        children: [
          _BbToolbarBtn(
            label: isZh ? '取消' : 'Cancel',
            onTap: () => setState(() => _editingStickerArchive = null),
          ),
          const SizedBox(width: 8),
          FilledButton.icon(
            onPressed: () {
              widget.onHaptic(HapticPattern.success);
              widget.onUpdateArchiveSticker(
                arc.id,
                stickerId: editStk.id,
                textOverlay: _editTextStyle,
              );
              setState(() => _editingStickerArchive = null);
            },
            icon: const Icon(LucideIcons.check, size: 13),
            label: Text(
              isZh ? '保存修改' : 'Save Changes',
              style: const TextStyle(fontSize: 12),
            ),
            style: FilledButton.styleFrom(
              backgroundColor: const Color(0xFFD97706),
              minimumSize: const Size(0, 32),
            ),
          ),
        ],
      ),
    );
  }
}

class _DotGridPainter extends CustomPainter {
  const _DotGridPainter();

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = const Color(0x12FFFFFF)
      ..style = PaintingStyle.fill;
    const step = 24.0;
    for (var x = 12.0; x < size.width; x += step) {
      for (var y = 12.0; y < size.height; y += step) {
        canvas.drawCircle(Offset(x, y), 1.0, paint);
      }
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

class _EmptyBoardBadge extends StatelessWidget {
  const _EmptyBoardBadge({required this.label});
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: const Color(0x3DFEF3C7)),
      ),
      child: Text(
        label,
        style: const TextStyle(fontSize: 11.5, color: Color(0x9EFEF3C7)),
      ),
    );
  }
}

class _BbToolbarBtn extends StatelessWidget {
  const _BbToolbarBtn({
    this.icon,
    this.label,
    required this.onTap,
  });

  final IconData? icon;
  final String? label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      borderRadius: BorderRadius.circular(7),
      onTap: onTap,
      child: Container(
        height: 26,
        padding: const EdgeInsets.symmetric(horizontal: 7),
        decoration: BoxDecoration(
          color: const Color(0x12FFFFFF),
          borderRadius: BorderRadius.circular(7),
          border: Border.all(color: const Color(0x38FEF3C7)),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (icon != null) Icon(icon, size: 12, color: const Color(0xFFFEF3C7)),
            if (icon != null && label != null) const SizedBox(width: 4),
            if (label != null)
              Text(
                label!,
                style: const TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                  color: Color(0xFFFEF3C7),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _SmallPaneBtn extends StatelessWidget {
  const _SmallPaneBtn({
    required this.icon,
    required this.label,
    required this.onTap,
    this.primary = false,
    this.active = false,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final bool primary;
  final bool active;

  @override
  Widget build(BuildContext context) {
    final t = context.arcTheme;
    final filled = primary || active;
    return InkWell(
      borderRadius: BorderRadius.circular(8),
      onTap: onTap,
      child: Container(
        height: 28,
        padding: const EdgeInsets.symmetric(horizontal: 8),
        decoration: BoxDecoration(
          color: filled ? t.accent : t.bgSubtle,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: filled ? t.accent : t.borderSubtle),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 12, color: filled ? t.accentText : t.textPrimary),
            const SizedBox(width: 4),
            Text(
              label,
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w600,
                color: filled ? t.accentText : t.textPrimary,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SmallSquareBtn extends StatelessWidget {
  const _SmallSquareBtn({required this.icon, required this.onTap});
  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final t = context.arcTheme;
    return InkWell(
      borderRadius: BorderRadius.circular(8),
      onTap: onTap,
      child: Container(
        width: 28,
        height: 28,
        decoration: BoxDecoration(
          color: t.bgSubtle,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: t.borderSubtle),
        ),
        child: Icon(icon, size: 14, color: t.textPrimary),
      ),
    );
  }
}

class _FilterPill extends StatelessWidget {
  const _FilterPill({
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
      borderRadius: BorderRadius.circular(999),
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3.5),
        decoration: BoxDecoration(
          color: selected ? t.accentSoft : t.bgSubtle,
          borderRadius: BorderRadius.circular(999),
          border: Border.all(color: selected ? t.accent : t.borderSubtle),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 10.5,
            fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
            color: selected ? t.accent : t.textSecondary,
          ),
        ),
      ),
    );
  }
}
