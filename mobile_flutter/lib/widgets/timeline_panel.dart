import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../core/cas_store.dart';
import '../core/tutorial_flow.dart';
import '../i18n/dictionaries.dart';
import '../models/archive_models.dart';
import '../state/app_controller.dart';
import '../theme/arc_theme.dart';

enum _TimelineViewMode { arc, list }

class _ArcNodeLayout {
  const _ArcNodeLayout({
    required this.snap,
    required this.point,
    required this.isAlt,
  });

  final Snapshot snap;
  final Offset point;
  final bool isAlt;
}

class TimelinePanel extends StatefulWidget {
  const TimelinePanel({
    super.key,
    required this.controller,
    required this.isModalSheet,
    required this.onOpenDiff,
    this.onClose,
  });

  final AppController controller;
  final bool isModalSheet;
  final void Function(Snapshot? left, Snapshot? right, {bool openDarlingsTab})
      onOpenDiff;
  final VoidCallback? onClose;

  @override
  State<TimelinePanel> createState() => _TimelinePanelState();
}

class _TimelinePanelState extends State<TimelinePanel> {
  String _query = '';
  _TimelineViewMode _viewMode = _TimelineViewMode.arc;
  String? _focusedSnapId;
  final List<Snapshot> _selectedForDiff = [];

  void _toggleDiffSelect(Snapshot snap) {
    widget.controller.triggerHaptic(HapticPattern.selection);
    setState(() {
      _focusedSnapId = snap.id;
      final existingIdx =
          _selectedForDiff.indexWhere((s) => s.id == snap.id);
      if (existingIdx != -1) {
        _selectedForDiff.removeAt(existingIdx);
      } else {
        if (_selectedForDiff.length >= 2) {
          _selectedForDiff.removeAt(0);
        }
        _selectedForDiff.add(snap);
      }
    });
  }

  static Offset _evalQuadBezier(Offset p0, Offset p1, Offset p2, double t) {
    final u = 1.0 - t;
    return Offset(
      u * u * p0.dx + 2 * u * t * p1.dx + t * t * p2.dx,
      u * u * p0.dy + 2 * u * t * p1.dy + t * t * p2.dy,
    );
  }

  List<_ArcNodeLayout> _layoutArcNodes({
    required Size size,
    required List<Snapshot> snaps,
    required List<Branch> branches,
  }) {
    final mainSnaps = <Snapshot>[];
    final altSnaps = <Snapshot>[];
    for (final s in snaps) {
      Branch? br;
      for (final b in branches) {
        if (b.id == s.branchId) {
          br = b;
          break;
        }
      }
      if (br == null || br.isMain) {
        mainSnaps.add(s);
      } else {
        altSnaps.add(s);
      }
    }

    final padX = (size.width * 0.08).clamp(24.0, 40.0);
    final p0 = Offset(padX, size.height * 0.78);
    final p1 = Offset(size.width * 0.5, size.height * 0.06);
    final p2 = Offset(size.width - padX, size.height * 0.78);

    final b0 = Offset(size.width * 0.22, size.height * 0.84);
    final b1 = Offset(size.width * 0.5, size.height * 0.44);
    final b2 = Offset(size.width * 0.78, size.height * 0.84);

    final out = <_ArcNodeLayout>[];
    for (var i = 0; i < mainSnaps.length; i++) {
      final t = mainSnaps.length <= 1 ? 0.5 : i / (mainSnaps.length - 1);
      out.add(_ArcNodeLayout(
        snap: mainSnaps[i],
        point: _evalQuadBezier(p0, p1, p2, t),
        isAlt: false,
      ));
    }
    for (var i = 0; i < altSnaps.length; i++) {
      final t =
          altSnaps.length <= 1 ? 0.5 : (i + 0.5) / altSnaps.length;
      out.add(_ArcNodeLayout(
        snap: altSnaps[i],
        point: _evalQuadBezier(b0, b1, b2, t),
        isAlt: true,
      ));
    }
    return out;
  }

  Widget _buildModeSegmented(ArcStrings d, ArcThemeTokens t) {
    return Container(
      padding: const EdgeInsets.all(2),
      decoration: BoxDecoration(
        color: t.bgSubtle,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: t.borderSubtle),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          _buildModeBtn(
            key: const ValueKey('timeline_mode_arc'),
            label: d.arcDome,
            selected: _viewMode == _TimelineViewMode.arc,
            t: t,
            onTap: () {
              widget.controller.triggerHaptic(HapticPattern.selection);
              setState(() => _viewMode = _TimelineViewMode.arc);
            },
          ),
          _buildModeBtn(
            key: const ValueKey('timeline_mode_list'),
            label: d.listCalendar,
            selected: _viewMode == _TimelineViewMode.list,
            t: t,
            onTap: () {
              widget.controller.triggerHaptic(HapticPattern.selection);
              setState(() => _viewMode = _TimelineViewMode.list);
            },
          ),
        ],
      ),
    );
  }

  Widget _buildModeBtn({
    required Key key,
    required String label,
    required bool selected,
    required ArcThemeTokens t,
    required VoidCallback onTap,
  }) {
    return InkWell(
      key: key,
      borderRadius: BorderRadius.circular(8),
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
        decoration: BoxDecoration(
          color: selected ? t.bgElevated : Colors.transparent,
          borderRadius: BorderRadius.circular(8),
          boxShadow: selected
              ? [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.06),
                    blurRadius: 3,
                    offset: const Offset(0, 1),
                  ),
                ]
              : null,
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 11.5,
            fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
            color: selected ? t.accent : t.textSecondary,
          ),
        ),
      ),
    );
  }

  Widget _buildActiveDetailCard({
    required AppController c,
    required ArcStrings d,
    required ArcThemeTokens t,
    required List<Snapshot> snaps,
    required List<Branch> branches,
    required String docId,
  }) {
    if (snaps.isEmpty) {
      return ArcCardSurface(
        padding: const EdgeInsets.all(12),
        child: Center(
          child: Text(
            c.settings.locale.isZh
                ? '暂无快照，点击顶部“快照”按钮开始记录版本演进'
                : 'No snapshots yet. Tap Snapshot above to record your progress.',
            style: TextStyle(fontSize: 12, color: t.textMuted),
          ),
        ),
      );
    }

    Snapshot active = snaps.last;
    if (_focusedSnapId != null) {
      for (final s in snaps) {
        if (s.id == _focusedSnapId) {
          active = s;
          break;
        }
      }
    }
    final isSel = _selectedForDiff.any((s) => s.id == active.id);
    final branchName = branches
        .where((b) => b.id == active.branchId)
        .map((b) => b.name)
        .firstOrNull ??
        d.mainBranch;
    final motivationCount = c
        .motivationsForDoc(docId)
        .where((m) => m.snapshotId == active.id)
        .length;
    final assetCount = c
        .assetsForDoc(docId)
        .where((a) => a.snapshotIds.contains(active.id))
        .length;
    final isZh = c.settings.locale.isZh;
    final deltaStr =
        active.deltaChars >= 0 ? '+${active.deltaChars}' : '${active.deltaChars}';

    return ArcCardSurface(
      padding: const EdgeInsets.all(11),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            children: [
              if (active.isMilestone) ...[
                const Icon(LucideIcons.star, size: 13, color: Color(0xFFF59E0B)),
                const SizedBox(width: 5),
              ],
              Expanded(
                child: Text(
                  active.label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 12.5,
                    fontWeight: FontWeight.w700,
                    color: t.textPrimary,
                  ),
                ),
              ),
              const SizedBox(width: 6),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                decoration: BoxDecoration(
                  color: t.bgSubtle,
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Text(
                  '${active.wordCount} ${isZh ? '字' : 'w'} ($deltaStr)',
                  style: TextStyle(fontSize: 10.5, color: t.textSecondary),
                ),
              ),
            ],
          ),
          const SizedBox(height: 5),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Padding(
                padding: const EdgeInsets.only(top: 1),
                child: Icon(LucideIcons.sparkles, size: 12.5, color: t.accent),
              ),
              const SizedBox(width: 5),
              Expanded(
                child: Text(
                  active.aiSummary,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 11.5,
                    color: t.textSecondary,
                    height: 1.35,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 6,
            runSpacing: 6,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              InkWell(
                key: ValueKey('arc_detail_toggle_diff_${active.id}'),
                borderRadius: BorderRadius.circular(999),
                onTap: () => _toggleDiffSelect(active),
                child: Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
                  decoration: BoxDecoration(
                    color: isSel ? t.accentSoft : t.bgSubtle,
                    borderRadius: BorderRadius.circular(999),
                    border: Border.all(
                      color: isSel ? t.accent : t.borderSubtle,
                    ),
                  ),
                  child: Text(
                    isSel
                        ? (isZh ? '取消对比勾选' : 'Unselect Diff')
                        : (isZh ? '加入差异对比' : 'Select for Diff'),
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: isSel ? t.accent : t.textPrimary,
                    ),
                  ),
                ),
              ),
              InkWell(
                borderRadius: BorderRadius.circular(999),
                onTap: () => c.rollbackToSnapshot(active),
                child: Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
                  decoration: BoxDecoration(
                    color: t.bgSubtle,
                    borderRadius: BorderRadius.circular(999),
                    border: Border.all(color: t.borderSubtle),
                  ),
                  child: Text(
                    d.rollbackBtn,
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: t.accent,
                    ),
                  ),
                ),
              ),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: t.bgSubtle,
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(LucideIcons.gitBranch, size: 11, color: t.textMuted),
                    const SizedBox(width: 4),
                    Text(
                      branchName,
                      style: TextStyle(fontSize: 10.5, color: t.textSecondary),
                    ),
                  ],
                ),
              ),
              if (motivationCount > 0)
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                  decoration: BoxDecoration(
                    color: t.bgSubtle,
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Text(
                    isZh ? '动机 $motivationCount' : 'Notes $motivationCount',
                    style: TextStyle(fontSize: 10.5, color: t.textSecondary),
                  ),
                ),
              if (assetCount > 0)
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                  decoration: BoxDecoration(
                    color: t.bgSubtle,
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Text(
                    isZh ? '资产 $assetCount' : 'Assets $assetCount',
                    style: TextStyle(fontSize: 10.5, color: t.textSecondary),
                  ),
                ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildArcDomeCanvas({
    required AppController c,
    required ArcThemeTokens t,
    required List<Snapshot> snaps,
    required List<Branch> branches,
    required double height,
  }) {
    final activeId = (_focusedSnapId != null &&
            snaps.any((s) => s.id == _focusedSnapId))
        ? _focusedSnapId
        : (snaps.isNotEmpty ? snaps.last.id : null);
    final selectedIds = _selectedForDiff.map((s) => s.id).toSet();
    final hasBranchArc =
        branches.length > 1 ||
        snaps.any((s) =>
            branches.any((b) => b.id == s.branchId && !b.isMain));

    return SizedBox(
      height: height,
      child: LayoutBuilder(
        builder: (context, constraints) {
          final size = Size(constraints.maxWidth, height);
          final nodes = _layoutArcNodes(
            size: size,
            snaps: snaps,
            branches: branches,
          );

          return Stack(
            clipBehavior: Clip.none,
            children: [
              Positioned.fill(
                child: CustomPaint(
                  painter: _ArcDomeTimelinePainter(
                    color: t.accent,
                    bgElevated: t.bgElevated,
                    textSecondary: t.textSecondary,
                    nodes: nodes,
                    selectedIds: selectedIds,
                    focusedId: activeId,
                    hasBranchArc: hasBranchArc,
                  ),
                ),
              ),
              for (final node in nodes)
                Positioned(
                  left: node.point.dx - 18,
                  top: node.point.dy - 18,
                  width: 36,
                  height: 36,
                  child: GestureDetector(
                    key: ValueKey('arc_node_${node.snap.id}'),
                    behavior: HitTestBehavior.opaque,
                    onTap: () {
                      c.triggerHaptic(HapticPattern.selection);
                      setState(() => _focusedSnapId = node.snap.id);
                    },
                    onLongPress: () => _toggleDiffSelect(node.snap),
                  ),
                ),
            ],
          );
        },
      ),
    );
  }

  Widget _buildArcView({
    required AppController c,
    required ArcStrings d,
    required ArcThemeTokens t,
    required List<Snapshot> snaps,
    required List<Branch> branches,
    required String docId,
  }) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 0, 12, 10),
      child: LayoutBuilder(
        builder: (context, constraints) {
          final isWide = constraints.maxWidth >= 680;
          final detailCard = _buildActiveDetailCard(
            c: c,
            d: d,
            t: t,
            snaps: snaps,
            branches: branches,
            docId: docId,
          );

          if (isWide) {
            return Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                Expanded(
                  flex: 6,
                  child: _buildArcDomeCanvas(
                    c: c,
                    t: t,
                    snaps: snaps,
                    branches: branches,
                    height: 158,
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(flex: 5, child: detailCard),
              ],
            );
          }

          return Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              _buildArcDomeCanvas(
                c: c,
                t: t,
                snaps: snaps,
                branches: branches,
                height: 138,
              ),
              const SizedBox(height: 8),
              detailCard,
            ],
          );
        },
      ),
    );
  }

  Widget _buildListView({
    required AppController c,
    required ArcStrings d,
    required ArcThemeTokens t,
    required List<Snapshot> snaps,
  }) {
    return SizedBox(
      height: 124,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.fromLTRB(14, 6, 14, 10),
        itemCount: snaps.length,
        separatorBuilder: (_, __) => const SizedBox(width: 10),
        itemBuilder: (context, idx) {
          final snap = snaps[idx];
          final picked = _selectedForDiff.any((s) => s.id == snap.id);
          return SizedBox(
            width: 185,
            child: ArcCardSurface(
              isActive: picked,
              padding: const EdgeInsets.all(10),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Icon(
                        snap.isMilestone
                            ? LucideIcons.star
                            : LucideIcons.gitCommitHorizontal,
                        size: 13,
                        color: t.accent,
                      ),
                      const SizedBox(width: 5),
                      Expanded(
                        child: Text(
                          snap.label,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                            color: t.textPrimary,
                          ),
                        ),
                      ),
                      InkWell(
                        onTap: () => _toggleDiffSelect(snap),
                        child: Icon(
                          picked ? LucideIcons.checkSquare : LucideIcons.square,
                          size: 14,
                          color: picked ? t.accent : t.textMuted,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    snap.aiSummary,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(fontSize: 11, color: t.textSecondary),
                  ),
                  const Spacer(),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        '${snap.wordCount} 字',
                        style: TextStyle(fontSize: 10.5, color: t.textMuted),
                      ),
                      InkWell(
                        onTap: () => c.rollbackToSnapshot(snap),
                        child: Text(
                          d.rollbackBtn,
                          style: TextStyle(
                            fontSize: 10.5,
                            color: t.accent,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final t = context.arcTheme;
    final c = widget.controller;
    final d = ArcStrings.of(c.settings.locale);
    final doc = c.activeDoc;
    if (doc == null) return const SizedBox.shrink();

    final snaps = c.snapshotsForDoc(doc.id);
    final branches = c.branchesForDoc(doc.id);
    final darlings = c.darlingsForDoc(doc.id);
    final hits = _query.trim().isNotEmpty
        ? searchAcrossSnapshots(cas: c.cas, snapshots: snaps, query: _query)
        : const <FragmentSearchHit>[];

    final body = LayoutBuilder(
      builder: (context, constraints) {
        final isWideHeader = constraints.maxWidth >= 640;

        final searchField = TextField(
          onChanged: (v) => setState(() => _query = v),
          style: TextStyle(fontSize: 12.5, color: t.textPrimary),
          decoration: InputDecoration(
            isDense: true,
            contentPadding:
                const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
            prefixIcon: Icon(LucideIcons.search, size: 14, color: t.textMuted),
            hintText: c.settings.locale.isZh
                ? '跨所有历史版本搜索片段 / 碎片考古...'
                : 'Search across all snapshots...',
            hintStyle: TextStyle(fontSize: 12, color: t.textMuted),
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
          ),
        );

        final content = Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 8, 12, 6),
              child: Row(
                children: [
                  Icon(LucideIcons.clock, size: 15, color: t.accent),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      '${d.timelineTitle} (${snaps.length})',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontWeight: FontWeight.w700,
                        fontSize: 13.5,
                        color: t.textPrimary,
                      ),
                    ),
                  ),
                  if (widget.onClose != null)
                    IconButton(
                      onPressed: widget.onClose,
                      icon:
                          Icon(LucideIcons.x, size: 16, color: t.textSecondary),
                      visualDensity: VisualDensity.compact,
                    ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 0, 12, 8),
              child: isWideHeader
                  ? Row(
                      children: [
                        _buildModeSegmented(d, t),
                        const SizedBox(width: 10),
                        Expanded(child: searchField),
                        const SizedBox(width: 10),
                        OutlinedButton.icon(
                          key: c.tourTargets
                              .keyFor(TutorialTargetId.timelineDarlingsBtn),
                          onPressed: () {
                            widget.onOpenDiff(null, null,
                                openDarlingsTab: true);
                            c.notifyTutorialAction(TutorialActionId.openDarlings);
                          },
                          icon: const Icon(LucideIcons.skull, size: 13),
                          label: Text(
                            '${d.deletedDarlings} (${darlings.length})',
                            style: const TextStyle(fontSize: 11.5),
                          ),
                          style: OutlinedButton.styleFrom(
                              visualDensity: VisualDensity.compact),
                        ),
                        if (snaps.length >= 2) ...[
                          const SizedBox(width: 6),
                          FilledButton(
                            onPressed: () {
                              if (_selectedForDiff.length == 2) {
                                widget.onOpenDiff(
                                    _selectedForDiff[0], _selectedForDiff[1]);
                              } else {
                                widget.onOpenDiff(
                                    snaps[snaps.length - 2], snaps.last);
                              }
                            },
                            style: FilledButton.styleFrom(
                              backgroundColor: t.accent,
                              foregroundColor: t.accentText,
                              visualDensity: VisualDensity.compact,
                            ),
                            child: Text(
                              _selectedForDiff.length == 2
                                  ? d.compareSelected
                                  : d.compareLatest,
                              style: const TextStyle(fontSize: 11.5),
                            ),
                          ),
                        ],
                      ],
                    )
                  : Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        SingleChildScrollView(
                          scrollDirection: Axis.horizontal,
                          child: Row(
                            children: [
                              _buildModeSegmented(d, t),
                              const SizedBox(width: 8),
                              OutlinedButton.icon(
                                key: c.tourTargets.keyFor(
                                    TutorialTargetId.timelineDarlingsBtn),
                                onPressed: () {
                                  widget.onOpenDiff(null, null,
                                      openDarlingsTab: true);
                                  c.notifyTutorialAction(
                                      TutorialActionId.openDarlings);
                                },
                                icon: const Icon(LucideIcons.skull, size: 13),
                                label: Text(
                                  '${d.deletedDarlings} (${darlings.length})',
                                  style: const TextStyle(fontSize: 11.5),
                                ),
                                style: OutlinedButton.styleFrom(
                                    visualDensity: VisualDensity.compact),
                              ),
                              if (snaps.length >= 2) ...[
                                const SizedBox(width: 6),
                                FilledButton(
                                  onPressed: () {
                                    if (_selectedForDiff.length == 2) {
                                      widget.onOpenDiff(_selectedForDiff[0],
                                          _selectedForDiff[1]);
                                    } else {
                                      widget.onOpenDiff(
                                          snaps[snaps.length - 2], snaps.last);
                                    }
                                  },
                                  style: FilledButton.styleFrom(
                                    backgroundColor: t.accent,
                                    foregroundColor: t.accentText,
                                    visualDensity: VisualDensity.compact,
                                  ),
                                  child: Text(
                                    _selectedForDiff.length == 2
                                        ? d.compareSelected
                                        : d.compareLatest,
                                    style: const TextStyle(fontSize: 11.5),
                                  ),
                                ),
                              ],
                            ],
                          ),
                        ),
                        const SizedBox(height: 8),
                        searchField,
                      ],
                    ),
            ),
            if (_query.trim().isNotEmpty)
              SizedBox(
                height: 132,
                child: hits.isEmpty
                    ? Center(
                        child: Text(
                          c.settings.locale.isZh
                              ? '未找到匹配片段'
                              : 'No matching fragments',
                          style: TextStyle(fontSize: 12, color: t.textMuted),
                        ),
                      )
                    : ListView.builder(
                        padding: const EdgeInsets.symmetric(horizontal: 12),
                        itemCount: hits.length,
                        itemBuilder: (context, idx) {
                          final h = hits[idx];
                          return ListTile(
                            dense: true,
                            title: Text(
                              h.snapshot.label,
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w700,
                                color: t.accent,
                              ),
                            ),
                            subtitle: Text(
                              h.snippet,
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                  fontSize: 11.5, color: t.textSecondary),
                            ),
                            trailing: TextButton(
                              onPressed: () =>
                                  c.rollbackToSnapshot(h.snapshot),
                              child: Text(d.rollbackBtn,
                                  style: const TextStyle(fontSize: 11.5)),
                            ),
                          );
                        },
                      ),
              )
            else if (_viewMode == _TimelineViewMode.arc)
              _buildArcView(
                c: c,
                d: d,
                t: t,
                snaps: snaps,
                branches: branches,
                docId: doc.id,
              )
            else
              _buildListView(c: c, d: d, t: t, snaps: snaps),
          ],
        );

        if (widget.isModalSheet) {
          return ConstrainedBox(
            constraints: BoxConstraints(
              maxHeight: MediaQuery.sizeOf(context).height * 0.82,
            ),
            child: SingleChildScrollView(child: content),
          );
        }
        return content;
      },
    );

    if (widget.isModalSheet) {
      return ArcSurface(
        key: c.tourTargets.keyFor(TutorialTargetId.timelinePanel),
        child: body,
      );
    }

    return Container(
      key: c.tourTargets.keyFor(TutorialTargetId.timelinePanel),
      decoration: BoxDecoration(
        color: t.bgSurface,
        border: Border(top: BorderSide(color: t.borderSubtle)),
      ),
      child: body,
    );
  }
}

class _ArcDomeTimelinePainter extends CustomPainter {
  const _ArcDomeTimelinePainter({
    required this.color,
    required this.bgElevated,
    required this.textSecondary,
    required this.nodes,
    required this.selectedIds,
    required this.focusedId,
    required this.hasBranchArc,
  });

  final Color color;
  final Color bgElevated;
  final Color textSecondary;
  final List<_ArcNodeLayout> nodes;
  final Set<String> selectedIds;
  final String? focusedId;
  final bool hasBranchArc;

  void _drawDashedQuadBezier(
    Canvas canvas,
    Offset p0,
    Offset p1,
    Offset p2,
    Paint paint,
  ) {
    final path = Path()
      ..moveTo(p0.dx, p0.dy)
      ..quadraticBezierTo(p1.dx, p1.dy, p2.dx, p2.dy);
    for (final metric in path.computeMetrics()) {
      var dist = 0.0;
      const dashLen = 4.0;
      const gapLen = 5.0;
      while (dist < metric.length) {
        final next = (dist + dashLen).clamp(0.0, metric.length);
        canvas.drawPath(metric.extractPath(dist, next), paint);
        dist += dashLen + gapLen;
      }
    }
  }

  @override
  void paint(Canvas canvas, Size size) {
    final padX = (size.width * 0.08).clamp(24.0, 40.0);
    final p0 = Offset(padX, size.height * 0.78);
    final p1 = Offset(size.width * 0.5, size.height * 0.06);
    final p2 = Offset(size.width - padX, size.height * 0.78);

    final mainPath = Path()
      ..moveTo(p0.dx, p0.dy)
      ..quadraticBezierTo(p1.dx, p1.dy, p2.dx, p2.dy);

    final mainShader = ui.Gradient.linear(
      p0,
      p2,
      [
        color.withValues(alpha: 0.08),
        color.withValues(alpha: 0.36),
        color.withValues(alpha: 0.58),
        color.withValues(alpha: 0.36),
        color.withValues(alpha: 0.08),
      ],
      const [0.0, 0.22, 0.5, 0.78, 1.0],
    );

    // Whisper-soft atmospheric glow under-stroke
    canvas.drawPath(
      mainPath,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 7.0
        ..strokeCap = StrokeCap.round
        ..shader = ui.Gradient.linear(
          p0,
          p2,
          [
            color.withValues(alpha: 0.02),
            color.withValues(alpha: 0.14),
            color.withValues(alpha: 0.02),
          ],
          const [0.0, 0.5, 1.0],
        ),
    );

    // Crisp Celestial Dome Arc
    canvas.drawPath(
      mainPath,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2.2
        ..strokeCap = StrokeCap.round
        ..shader = mainShader,
    );

    // Concentric Secondary Branch Arc
    if (hasBranchArc) {
      final b0 = Offset(size.width * 0.22, size.height * 0.84);
      final b1 = Offset(size.width * 0.5, size.height * 0.44);
      final b2 = Offset(size.width * 0.78, size.height * 0.84);
      _drawDashedQuadBezier(
        canvas,
        b0,
        b1,
        b2,
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 1.5
          ..strokeCap = StrokeCap.round
          ..shader = ui.Gradient.linear(
            b0,
            b2,
            [
              color.withValues(alpha: 0.04),
              color.withValues(alpha: 0.34),
              color.withValues(alpha: 0.04),
            ],
            const [0.0, 0.5, 1.0],
          ),
      );
    }

    // Snapshot nodes + labels
    for (final node in nodes) {
      final snap = node.snap;
      final pt = node.point;
      final isSel = selectedIds.contains(snap.id);
      final isFocused = focusedId == snap.id;

      if (isSel) {
        canvas.drawCircle(
          pt,
          11.0,
          Paint()
            ..style = PaintingStyle.stroke
            ..strokeWidth = 1.6
            ..color = color.withValues(alpha: 0.7),
        );
      } else if (isFocused) {
        canvas.drawCircle(
          pt,
          10.5,
          Paint()..color = color.withValues(alpha: 0.16),
        );
      } else if (snap.isMilestone) {
        canvas.drawCircle(
          pt,
          10.0,
          Paint()..color = color.withValues(alpha: 0.10),
        );
      }

      final radius = isSel
          ? 6.4
          : isFocused
              ? 5.8
              : (snap.isMilestone ? 5.2 : 4.2);
      final filled = isSel || isFocused || (snap.isMilestone && !node.isAlt);

      canvas.drawCircle(
        pt,
        radius,
        Paint()
          ..color = filled
              ? color.withValues(alpha: isSel ? 0.96 : 0.86)
              : bgElevated,
      );
      canvas.drawCircle(
        pt,
        radius,
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = node.isAlt ? 1.8 : 2.0
          ..color = color.withValues(
            alpha: (isSel || isFocused) ? 1.0 : (node.isAlt ? 0.62 : 0.85),
          ),
      );

      final shortLabel = snap.label.length > 8
          ? '${snap.label.substring(0, 8)}…'
          : snap.label;
      final tp = TextPainter(
        text: TextSpan(
          text: shortLabel,
          style: TextStyle(
            fontSize: 9.5,
            fontWeight: isFocused ? FontWeight.w700 : FontWeight.w500,
            color: isFocused ? color : textSecondary,
          ),
        ),
        textDirection: TextDirection.ltr,
        maxLines: 1,
      )..layout(maxWidth: 72);
      tp.paint(canvas, Offset(pt.dx - tp.width / 2, pt.dy + 11));
    }
  }

  @override
  bool shouldRepaint(covariant _ArcDomeTimelinePainter oldDelegate) =>
      oldDelegate.color != color ||
      oldDelegate.focusedId != focusedId ||
      oldDelegate.hasBranchArc != hasBranchArc ||
      oldDelegate.nodes.length != nodes.length ||
      oldDelegate.selectedIds.length != selectedIds.length ||
      !oldDelegate.selectedIds.containsAll(selectedIds);
}
