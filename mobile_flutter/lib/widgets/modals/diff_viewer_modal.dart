import 'dart:async';
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../../core/diff_engine.dart';
import '../../core/tutorial_flow.dart';
import '../../models/archive_models.dart';
import '../../state/app_controller.dart';
import '../../theme/arc_theme.dart';

class DiffViewerModal extends StatefulWidget {
  const DiffViewerModal({
    super.key,
    required this.controller,
    this.leftSnap,
    this.rightSnap,
    this.initialDarlingsTab = false,
    this.onClose,
  });

  final AppController controller;
  final Snapshot? leftSnap;
  final Snapshot? rightSnap;
  final bool initialDarlingsTab;
  final VoidCallback? onClose;

  @override
  State<DiffViewerModal> createState() => _DiffViewerModalState();
}

class _DiffViewerModalState extends State<DiffViewerModal> {
  late bool _darlingsTab = widget.initialDarlingsTab;
  final ScrollController _scrollController = ScrollController();
  final GlobalKey _viewportKey = GlobalKey();
  final Map<String, GlobalKey> _sectionKeys = {};

  bool _onlyChangedChapters = false;
  bool _sidebarOpen = true;
  bool _tocExpanded = false;
  String? _activeChapterId;
  String? _flashingChapterId;
  Timer? _flashTimer;
  bool _scrollUpdateScheduled = false;

  String? _cachedLeft;
  String? _cachedRight;
  bool? _cachedIsZh;
  StructuredDocumentDiff? _cachedDiff;

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_onViewportScroll);
  }

  @override
  void dispose() {
    _flashTimer?.cancel();
    _scrollController.removeListener(_onViewportScroll);
    _scrollController.dispose();
    super.dispose();
  }

  StructuredDocumentDiff _getStructuredDiff(
    String leftText,
    String rightText,
    bool isZh,
  ) {
    if (_cachedDiff != null &&
        _cachedLeft == leftText &&
        _cachedRight == rightText &&
        _cachedIsZh == isZh) {
      return _cachedDiff!;
    }
    final computed = computeStructuredDocumentDiff(
      leftText,
      rightText,
      preambleTitle: isZh ? '文首导言' : 'Preamble',
    );
    _cachedLeft = leftText;
    _cachedRight = rightText;
    _cachedIsZh = isZh;
    _cachedDiff = computed;

    final validIds = computed.chapters.map((c) => c.id).toSet();
    _sectionKeys.removeWhere((key, _) => !validIds.contains(key));
    for (final ch in computed.chapters) {
      _sectionKeys.putIfAbsent(ch.id, () => GlobalKey());
    }
    if (computed.chapters.isEmpty) {
      _activeChapterId = null;
    } else if (_activeChapterId == null || !validIds.contains(_activeChapterId)) {
      _activeChapterId = computed.chapters.first.id;
    }
    return computed;
  }

  void _onViewportScroll() {
    final diff = _cachedDiff;
    if (diff == null || diff.chapters.isEmpty || _scrollUpdateScheduled) return;
    _scrollUpdateScheduled = true;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _scrollUpdateScheduled = false;
      if (!mounted) return;
      final viewportBox =
          _viewportKey.currentContext?.findRenderObject() as RenderBox?;
      if (viewportBox == null || !viewportBox.hasSize) return;
      final viewportTop = viewportBox.localToGlobal(Offset.zero).dy;

      String? nextActive = diff.chapters.first.id;
      for (final ch in diff.chapters) {
        final box =
            _sectionKeys[ch.id]?.currentContext?.findRenderObject() as RenderBox?;
        if (box == null || !box.hasSize) continue;
        final relTop = box.localToGlobal(Offset.zero).dy - viewportTop;
        if (relTop <= 48) {
          nextActive = ch.id;
        } else {
          break;
        }
      }
      if (nextActive != null && nextActive != _activeChapterId) {
        setState(() => _activeChapterId = nextActive);
      }
    });
  }

  void _jumpToChapter(String chapterId) {
    final targetCtx = _sectionKeys[chapterId]?.currentContext;
    if (targetCtx != null) {
      Scrollable.ensureVisible(
        targetCtx,
        duration: const Duration(milliseconds: 280),
        curve: Curves.easeOutCubic,
        alignment: 0.02,
      );
    }
    widget.controller.triggerHaptic(HapticPattern.selection);
    _flashTimer?.cancel();
    setState(() {
      _activeChapterId = chapterId;
      _flashingChapterId = chapterId;
      _tocExpanded = false;
    });
    _flashTimer = Timer(const Duration(milliseconds: 900), () {
      if (!mounted) return;
      if (_flashingChapterId == chapterId) {
        setState(() => _flashingChapterId = null);
      }
    });
  }

  Widget _buildChapterStats(DiffChapter ch, ArcThemeTokens t, bool isZh) {
    if (ch.headingStatus == DiffHeadingStatus.added) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
        decoration: BoxDecoration(
          color: Colors.green.withValues(alpha: 0.16),
          borderRadius: BorderRadius.circular(999),
        ),
        child: Text(
          isZh ? '新增' : 'New',
          style: const TextStyle(
            fontSize: 10,
            fontWeight: FontWeight.w600,
            color: Color(0xFF16A34A),
          ),
        ),
      );
    }
    if (ch.headingStatus == DiffHeadingStatus.removed) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
        decoration: BoxDecoration(
          color: Colors.red.withValues(alpha: 0.16),
          borderRadius: BorderRadius.circular(999),
        ),
        child: Text(
          isZh ? '已删' : 'Del',
          style: const TextStyle(
            fontSize: 10,
            fontWeight: FontWeight.w600,
            color: Color(0xFFDC2626),
          ),
        ),
      );
    }
    if (ch.addedChars > 0 || ch.removedChars > 0) {
      return Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (ch.addedChars > 0)
            Text(
              '+${ch.addedChars}',
              style: const TextStyle(
                fontSize: 10.5,
                fontWeight: FontWeight.w600,
                color: Color(0xFF16A34A),
              ),
            ),
          if (ch.addedChars > 0 && ch.removedChars > 0) const SizedBox(width: 4),
          if (ch.removedChars > 0)
            Text(
              '-${ch.removedChars}',
              style: const TextStyle(
                fontSize: 10.5,
                fontWeight: FontWeight.w600,
                color: Color(0xFFDC2626),
              ),
            ),
        ],
      );
    }
    return const SizedBox.shrink();
  }

  Widget _buildChapterItem(DiffChapter ch, ArcThemeTokens t, bool isZh) {
    final isActive = _activeChapterId == ch.id;
    final leftPad = 8.0 + (ch.level - 1).clamp(0, 3) * 10.0;
    return InkWell(
      key: ValueKey('toc_${ch.id}'),
      borderRadius: BorderRadius.circular(8),
      onTap: () => _jumpToChapter(ch.id),
      child: Container(
        padding: EdgeInsets.fromLTRB(leftPad, 6, 8, 6),
        decoration: BoxDecoration(
          color: isActive ? t.accentSoft : Colors.transparent,
          borderRadius: BorderRadius.circular(8),
        ),
        child: Row(
          children: [
            Expanded(
              child: Text(
                ch.title,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: isActive
                      ? FontWeight.w700
                      : (ch.hasChanges ? FontWeight.w600 : FontWeight.w400),
                  color: isActive
                      ? t.accent
                      : (ch.hasChanges ? t.textPrimary : t.textSecondary),
                ),
              ),
            ),
            const SizedBox(width: 6),
            _buildChapterStats(ch, t, isZh),
          ],
        ),
      ),
    );
  }

  InlineSpan _buildHunkSpan(
    DiffHunkType type,
    String text,
    ArcThemeTokens t, {
    bool isHeading = false,
  }) {
    if (type == DiffHunkType.added) {
      return TextSpan(
        text: text,
        style: TextStyle(
          backgroundColor: Colors.green.withValues(alpha: 0.22),
          color: t.textPrimary,
          fontWeight: isHeading ? FontWeight.w700 : null,
        ),
      );
    }
    if (type == DiffHunkType.removed) {
      return TextSpan(
        text: text,
        style: TextStyle(
          backgroundColor: Colors.red.withValues(alpha: 0.22),
          decoration: TextDecoration.lineThrough,
          color: t.textPrimary,
          fontWeight: isHeading ? FontWeight.w700 : null,
        ),
      );
    }
    return TextSpan(
      text: text,
      style: TextStyle(
        color: isHeading ? t.textPrimary : t.textSecondary,
        fontWeight: isHeading ? FontWeight.w700 : null,
      ),
    );
  }

  Widget _buildSectionContent(
    DiffSectionBlock section,
    ArcThemeTokens t,
    bool isFirst,
  ) {
    final ch = section.chapter;
    final isFlashing = _flashingChapterId == ch.id;
    final spans = <InlineSpan>[];

    for (var i = 0; i < section.lines.length; i++) {
      final line = section.lines[i];
      final isHeadingLine = !ch.isPreamble && i == 0;
      if (line.tokens.isEmpty) {
        spans.add(const TextSpan(text: ''));
      } else {
        for (final tok in line.tokens) {
          spans.add(
            _buildHunkSpan(
              tok.type,
              tok.value,
              t,
              isHeading: isHeadingLine,
            ),
          );
        }
      }
      if (i < section.lines.length - 1) {
        spans.add(const TextSpan(text: '\n'));
      }
    }

    return AnimatedContainer(
      key: _sectionKeys[ch.id],
      duration: const Duration(milliseconds: 240),
      width: double.infinity,
      margin: EdgeInsets.only(top: isFirst ? 0 : 8),
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
      decoration: BoxDecoration(
        color: isFlashing ? t.accent.withValues(alpha: 0.12) : Colors.transparent,
        borderRadius: BorderRadius.circular(8),
        border: Border(
          top: isFirst || ch.isPreamble
              ? BorderSide.none
              : BorderSide(color: t.borderSubtle.withValues(alpha: 0.55)),
        ),
      ),
      child: SelectableText.rich(
        TextSpan(
          style: const TextStyle(fontSize: 13, height: 1.55),
          children: spans,
        ),
      ),
    );
  }

  Widget _buildDiffBody(
    BuildContext context,
    StructuredDocumentDiff structured,
    ArcThemeTokens t,
    bool isZh,
  ) {
    final chapters = structured.chapters;
    final visibleChapters = _onlyChangedChapters
        ? chapters.where((c) => c.hasChanges).toList(growable: false)
        : chapters;
    final changedCount = chapters.where((c) => c.hasChanges).length;
    final leftLabel = widget.leftSnap?.label ?? (isZh ? '基线版' : 'Baseline');
    final rightLabel = widget.rightSnap?.label ?? (isZh ? '当前版' : 'Current');
    final diffSummaryText = isZh
        ? structured.result.summary
        : '+${structured.result.addedChars} / -${structured.result.removedChars} chars (${structured.result.changedBlocks} changes)';

    return LayoutBuilder(
      builder: (context, constraints) {
        final isWide = constraints.maxWidth >= 720;

        final diffScrollView = Container(
          key: _viewportKey,
          decoration: BoxDecoration(
            color: t.bgApp.withValues(alpha: 0.55),
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: t.borderSubtle),
          ),
          child: SingleChildScrollView(
            controller: _scrollController,
            padding: const EdgeInsets.all(12),
            child: structured.sections.isNotEmpty
                ? Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      for (var i = 0; i < structured.sections.length; i++)
                        _buildSectionContent(structured.sections[i], t, i == 0),
                    ],
                  )
                : SelectableText.rich(
                    TextSpan(
                      style: const TextStyle(fontSize: 13, height: 1.55),
                      children: structured.result.hunks
                          .map((h) => _buildHunkSpan(h.type, h.value, t))
                          .toList(growable: false),
                    ),
                  ),
          ),
        );

        return Column(
          children: [
            // Comparison metadata & filter controls
            Padding(
              padding: const EdgeInsets.fromLTRB(14, 0, 14, 6),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
                decoration: BoxDecoration(
                  color: t.bgSubtle,
                  borderRadius: BorderRadius.circular(9),
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: Text(
                        '$leftLabel → $rightLabel · $diffSummaryText',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(fontSize: 11.5, color: t.textSecondary),
                      ),
                    ),
                    if (chapters.isNotEmpty) ...[
                      const SizedBox(width: 6),
                      InkWell(
                        borderRadius: BorderRadius.circular(999),
                        onTap: () => setState(
                            () => _onlyChangedChapters = !_onlyChangedChapters),
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(
                            color: _onlyChangedChapters
                                ? t.accentSoft
                                : t.bgElevated,
                            borderRadius: BorderRadius.circular(999),
                            border: Border.all(
                              color: _onlyChangedChapters
                                  ? t.accent
                                  : t.borderSubtle,
                            ),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(
                                LucideIcons.listFilter,
                                size: 11.5,
                                color: _onlyChangedChapters
                                    ? t.accent
                                    : t.textSecondary,
                              ),
                              const SizedBox(width: 4),
                              Text(
                                isZh
                                    ? '仅变动 ($changedCount)'
                                    : 'Changed ($changedCount)',
                                style: TextStyle(
                                  fontSize: 11,
                                  fontWeight: _onlyChangedChapters
                                      ? FontWeight.w700
                                      : FontWeight.w500,
                                  color: _onlyChangedChapters
                                      ? t.accent
                                      : t.textSecondary,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ],
                    if (isWide && chapters.isNotEmpty) ...[
                      const SizedBox(width: 6),
                      InkWell(
                        borderRadius: BorderRadius.circular(999),
                        onTap: () =>
                            setState(() => _sidebarOpen = !_sidebarOpen),
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(
                            color: _sidebarOpen ? t.accentSoft : t.bgElevated,
                            borderRadius: BorderRadius.circular(999),
                            border: Border.all(
                              color: _sidebarOpen ? t.accent : t.borderSubtle,
                            ),
                          ),
                          child: Icon(
                            LucideIcons.listTree,
                            size: 12.5,
                            color: _sidebarOpen ? t.accent : t.textSecondary,
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ),

            // Phone / Compact quick-jump chip strip & expandable chapter drawer
            if (!isWide && chapters.isNotEmpty) ...[
              Padding(
                padding: const EdgeInsets.fromLTRB(14, 0, 14, 6),
                child: Column(
                  children: [
                    Row(
                      children: [
                        InkWell(
                          key: const ValueKey('diff_mobile_toc_toggle'),
                          borderRadius: BorderRadius.circular(999),
                          onTap: () =>
                              setState(() => _tocExpanded = !_tocExpanded),
                          child: Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 9, vertical: 5),
                            decoration: BoxDecoration(
                              color: _tocExpanded ? t.accentSoft : t.bgSubtle,
                              borderRadius: BorderRadius.circular(999),
                              border: Border.all(
                                color: _tocExpanded ? t.accent : t.borderSubtle,
                              ),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(
                                  LucideIcons.listTree,
                                  size: 12.5,
                                  color:
                                      _tocExpanded ? t.accent : t.textPrimary,
                                ),
                                const SizedBox(width: 4),
                                Text(
                                  isZh
                                      ? '章节 (${visibleChapters.length})'
                                      : 'Chapters (${visibleChapters.length})',
                                  style: TextStyle(
                                    fontSize: 11.5,
                                    fontWeight: FontWeight.w600,
                                    color:
                                        _tocExpanded ? t.accent : t.textPrimary,
                                  ),
                                ),
                                const SizedBox(width: 2),
                                Icon(
                                  _tocExpanded
                                      ? LucideIcons.chevronUp
                                      : LucideIcons.chevronDown,
                                  size: 12.5,
                                  color:
                                      _tocExpanded ? t.accent : t.textSecondary,
                                ),
                              ],
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: SizedBox(
                            height: 30,
                            child: visibleChapters.isEmpty
                                ? Align(
                                    alignment: Alignment.centerLeft,
                                    child: Text(
                                      isZh ? '无变动章节' : 'No changed chapters',
                                      style: TextStyle(
                                          fontSize: 11.5, color: t.textMuted),
                                    ),
                                  )
                                : ListView.separated(
                                    scrollDirection: Axis.horizontal,
                                    itemCount: visibleChapters.length,
                                    separatorBuilder: (_, __) =>
                                        const SizedBox(width: 6),
                                    itemBuilder: (context, idx) {
                                      final ch = visibleChapters[idx];
                                      final isActive = _activeChapterId == ch.id;
                                      return InkWell(
                                        key: ValueKey('diff_chip_${ch.id}'),
                                        borderRadius:
                                            BorderRadius.circular(999),
                                        onTap: () => _jumpToChapter(ch.id),
                                        child: Container(
                                          padding: const EdgeInsets.symmetric(
                                              horizontal: 10, vertical: 4),
                                          decoration: BoxDecoration(
                                            color: isActive
                                                ? t.accentSoft
                                                : t.bgApp,
                                            borderRadius:
                                                BorderRadius.circular(999),
                                            border: Border.all(
                                              color: isActive
                                                  ? t.accent
                                                  : (ch.hasChanges
                                                      ? t.accent
                                                          .withValues(alpha: 0.4)
                                                      : t.borderSubtle),
                                            ),
                                          ),
                                          child: Row(
                                            mainAxisSize: MainAxisSize.min,
                                            children: [
                                              if (ch.hasChanges) ...[
                                                Container(
                                                  width: 6,
                                                  height: 6,
                                                  decoration: BoxDecoration(
                                                    color: t.accent,
                                                    shape: BoxShape.circle,
                                                  ),
                                                ),
                                                const SizedBox(width: 5),
                                              ],
                                              ConstrainedBox(
                                                constraints:
                                                    const BoxConstraints(
                                                        maxWidth: 130),
                                                child: Text(
                                                  ch.title,
                                                  maxLines: 1,
                                                  overflow:
                                                      TextOverflow.ellipsis,
                                                  style: TextStyle(
                                                    fontSize: 11.5,
                                                    fontWeight: isActive
                                                        ? FontWeight.w700
                                                        : FontWeight.w500,
                                                    color: isActive
                                                        ? t.accent
                                                        : t.textPrimary,
                                                  ),
                                                ),
                                              ),
                                              if (ch.addedChars > 0 ||
                                                  ch.removedChars > 0 ||
                                                  ch.headingStatus ==
                                                      DiffHeadingStatus.added ||
                                                  ch.headingStatus ==
                                                      DiffHeadingStatus
                                                          .removed) ...[
                                                const SizedBox(width: 5),
                                                _buildChapterStats(ch, t, isZh),
                                              ],
                                            ],
                                          ),
                                        ),
                                      );
                                    },
                                  ),
                          ),
                        ),
                      ],
                    ),
                    if (_tocExpanded) ...[
                      const SizedBox(height: 6),
                      Container(
                        constraints: const BoxConstraints(maxHeight: 190),
                        decoration: BoxDecoration(
                          color: t.bgApp,
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: t.borderSubtle),
                        ),
                        child: visibleChapters.isEmpty
                            ? Padding(
                                padding: const EdgeInsets.all(12),
                                child: Text(
                                  isZh
                                      ? '当前筛选下没有发生变动的章节'
                                      : 'No changed chapters',
                                  style: TextStyle(
                                      fontSize: 12, color: t.textMuted),
                                ),
                              )
                            : ListView.builder(
                                shrinkWrap: true,
                                padding: const EdgeInsets.all(6),
                                itemCount: visibleChapters.length,
                                itemBuilder: (_, idx) => _buildChapterItem(
                                    visibleChapters[idx], t, isZh),
                              ),
                      ),
                    ],
                  ],
                ),
              ),
            ],

            // Main Diff Workspace (Wide: sidebar + diff; Compact: full-width diff)
            Expanded(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(14, 0, 14, 12),
                child: isWide && chapters.isNotEmpty && _sidebarOpen
                    ? Row(
                        children: [
                          Container(
                            width: 224,
                            margin: const EdgeInsets.only(right: 10),
                            decoration: BoxDecoration(
                              color: t.bgApp.withValues(alpha: 0.65),
                              borderRadius: BorderRadius.circular(10),
                              border: Border.all(color: t.borderSubtle),
                            ),
                            child: Column(
                              children: [
                                Container(
                                  padding: const EdgeInsets.symmetric(
                                      horizontal: 10, vertical: 8),
                                  decoration: BoxDecoration(
                                    border: Border(
                                        bottom:
                                            BorderSide(color: t.borderSubtle)),
                                  ),
                                  child: Row(
                                    children: [
                                      Expanded(
                                        child: Text(
                                          isZh ? '章节快捷跳转' : 'Chapter Jump',
                                          style: TextStyle(
                                            fontSize: 12,
                                            fontWeight: FontWeight.w700,
                                            color: t.textSecondary,
                                          ),
                                        ),
                                      ),
                                      Text(
                                        '${visibleChapters.length}',
                                        style: TextStyle(
                                          fontSize: 11,
                                          color: t.textMuted,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                                Expanded(
                                  child: visibleChapters.isEmpty
                                      ? Center(
                                          child: Text(
                                            isZh
                                                ? '暂无变动章节'
                                                : 'No changed chapters',
                                            style: TextStyle(
                                              fontSize: 12,
                                              color: t.textMuted,
                                            ),
                                          ),
                                        )
                                      : ListView.builder(
                                          padding: const EdgeInsets.all(6),
                                          itemCount: visibleChapters.length,
                                          itemBuilder: (_, idx) =>
                                              _buildChapterItem(
                                                  visibleChapters[idx],
                                                  t,
                                                  isZh),
                                        ),
                                ),
                              ],
                            ),
                          ),
                          Expanded(child: diffScrollView),
                        ],
                      )
                    : diffScrollView,
              ),
            ),
          ],
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final t = context.arcTheme;
    final c = widget.controller;
    final isZh = c.settings.locale.isZh;
    final doc = c.activeDoc;
    final leftText = widget.leftSnap != null
        ? (c.cas.get(widget.leftSnap!.contentHash) ?? '')
        : '';
    final rightText = widget.rightSnap != null
        ? (c.cas.get(widget.rightSnap!.contentHash) ?? '')
        : (doc?.activeText ?? '');
    final structured = _getStructuredDiff(leftText, rightText, isZh);
    final diff = structured.result;
    final darlings =
        doc != null ? c.darlingsForDoc(doc.id) : const <DeletedDarling>[];

    return ArcSurface(
      key: c.tourTargets.keyFor(TutorialTargetId.diffModal),
      child: SizedBox(
        height: MediaQuery.sizeOf(context).height * 0.84,
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 10, 6),
              child: Row(
                children: [
                  Icon(LucideIcons.gitCompare, size: 18, color: t.accent),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      isZh
                          ? '版本逐字 Diff 与废稿墓地'
                          : 'Version Diff & Deleted Darlings',
                      style: TextStyle(
                          fontWeight: FontWeight.w700,
                          fontSize: 15,
                          color: t.textPrimary),
                    ),
                  ),
                  IconButton(
                    onPressed: () =>
                        (widget.onClose ?? () => Navigator.of(context).pop())(),
                    icon: Icon(LucideIcons.x, size: 18, color: t.textSecondary),
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 14),
              child: Align(
                alignment: Alignment.centerLeft,
                child: SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      ChoiceChip(
                        label: Text(
                          isZh
                              ? '差异对比 (${diff.summary})'
                              : 'Diff (+${diff.addedChars}/-${diff.removedChars})',
                          style: const TextStyle(fontSize: 11.5),
                        ),
                        selected: !_darlingsTab,
                        onSelected: (_) =>
                            setState(() => _darlingsTab = false),
                      ),
                      const SizedBox(width: 8),
                      ChoiceChip(
                        label: Text(
                          isZh
                              ? '废稿墓地 (${darlings.length})'
                              : 'Darlings (${darlings.length})',
                          style: const TextStyle(fontSize: 11.5),
                        ),
                        selected: _darlingsTab,
                        onSelected: (_) => setState(() => _darlingsTab = true),
                      ),
                    ],
                  ),
                ),
              ),
            ),
            const SizedBox(height: 8),
            Expanded(
              child: _darlingsTab
                  ? ListView.separated(
                      padding: const EdgeInsets.all(14),
                      itemCount: darlings.length,
                      separatorBuilder: (_, __) => const SizedBox(height: 8),
                      itemBuilder: (context, idx) {
                        final dl = darlings[idx];
                        return ArcCardSurface(
                          padding: const EdgeInsets.all(12),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                  '${dl.charCount} 字 · ${dl.deletedAt.substring(0, 10)}',
                                  style: TextStyle(
                                      fontSize: 11,
                                      color: t.accent,
                                      fontWeight: FontWeight.w600)),
                              const SizedBox(height: 4),
                              Text(dl.text,
                                  style: TextStyle(
                                      fontSize: 12.5, color: t.textPrimary)),
                              const SizedBox(height: 6),
                              Align(
                                alignment: Alignment.centerRight,
                                child: TextButton.icon(
                                  onPressed: () {
                                    c.insertSnippet('\n${dl.text}');
                                    (widget.onClose ??
                                        () => Navigator.of(context).pop())();
                                  },
                                  icon:
                                      const Icon(LucideIcons.undo2, size: 14),
                                  label: Text(
                                      isZh ? '捞回正文' : 'Restore to Draft'),
                                ),
                              ),
                            ],
                          ),
                        );
                      },
                    )
                  : _buildDiffBody(context, structured, t, isZh),
            ),
          ],
        ),
      ),
    );
  }
}
