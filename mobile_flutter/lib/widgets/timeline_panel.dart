import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../core/cas_store.dart';
import '../i18n/dictionaries.dart';
import '../models/archive_models.dart';
import '../state/app_controller.dart';
import '../theme/arc_theme.dart';
import '../theme/liquid_glass_surface.dart';

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
  final void Function(Snapshot? left, Snapshot? right, {bool openDarlingsTab}) onOpenDiff;
  final VoidCallback? onClose;

  @override
  State<TimelinePanel> createState() => _TimelinePanelState();
}

class _TimelinePanelState extends State<TimelinePanel> {
  String _query = '';
  final List<Snapshot> _selectedForDiff = [];

  @override
  Widget build(BuildContext context) {
    final t = context.arcTheme;
    final c = widget.controller;
    final d = ArcStrings.of(c.settings.locale);
    final doc = c.activeDoc;
    if (doc == null) return const SizedBox.shrink();

    final snaps = c.snapshotsForDoc(doc.id);
    final darlings = c.darlingsForDoc(doc.id);
    final hits = _query.trim().isNotEmpty
        ? searchAcrossSnapshots(cas: c.cas, snapshots: snaps, query: _query)
        : const <FragmentSearchHit>[];

    final body = Column(
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
                  '${d.arcDome} (${snaps.length})',
                  style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5, color: t.textPrimary),
                ),
              ),
              OutlinedButton.icon(
                onPressed: () => widget.onOpenDiff(null, null, openDarlingsTab: true),
                icon: const Icon(LucideIcons.skull, size: 13),
                label: Text('${d.deletedDarlings} (${darlings.length})',
                    style: const TextStyle(fontSize: 11.5)),
                style: OutlinedButton.styleFrom(visualDensity: VisualDensity.compact),
              ),
              const SizedBox(width: 6),
              if (snaps.length >= 2)
                FilledButton(
                  onPressed: () {
                    if (_selectedForDiff.length == 2) {
                      widget.onOpenDiff(_selectedForDiff[0], _selectedForDiff[1]);
                    } else {
                      widget.onOpenDiff(snaps[snaps.length - 2], snaps.last);
                    }
                  },
                  style: FilledButton.styleFrom(
                    backgroundColor: t.accent,
                    foregroundColor: t.accentText,
                    visualDensity: VisualDensity.compact,
                  ),
                  child: Text(
                    _selectedForDiff.length == 2 ? d.compareSelected : d.compareLatest,
                    style: const TextStyle(fontSize: 11.5),
                  ),
                ),
              if (widget.onClose != null)
                IconButton(
                  onPressed: widget.onClose,
                  icon: Icon(LucideIcons.x, size: 16, color: t.textSecondary),
                  visualDensity: VisualDensity.compact,
                ),
            ],
          ),
        ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12),
          child: TextField(
            onChanged: (v) => setState(() => _query = v),
            style: TextStyle(fontSize: 12.5, color: t.textPrimary),
            decoration: InputDecoration(
              isDense: true,
              prefixIcon: Icon(LucideIcons.search, size: 14, color: t.textMuted),
              hintText: c.settings.locale.isZh
                  ? '跨所有历史版本搜索片段 / 碎片考古...'
                  : 'Search across all snapshots...',
              hintStyle: TextStyle(fontSize: 12, color: t.textMuted),
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
            ),
          ),
        ),
        const SizedBox(height: 8),
        if (_query.trim().isNotEmpty)
          SizedBox(
            height: 110,
            child: hits.isEmpty
                ? Center(
                    child: Text(
                      c.settings.locale.isZh ? '未找到匹配片段' : 'No matching fragments',
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
                        title: Text(h.snapshot.label,
                            style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: t.accent)),
                        subtitle: Text(h.snippet,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(fontSize: 11.5, color: t.textSecondary)),
                        trailing: TextButton(
                          onPressed: () => c.rollbackToSnapshot(h.snapshot),
                          child: Text(d.rollbackBtn, style: const TextStyle(fontSize: 11.5)),
                        ),
                      );
                    },
                  ),
          )
        else
          SizedBox(
            height: 124,
            child: Stack(
              children: [
                Positioned.fill(
                  child: CustomPaint(
                    painter: _ArcDomeTimelinePainter(color: t.accent),
                  ),
                ),
                ListView.separated(
                  scrollDirection: Axis.horizontal,
                  padding: const EdgeInsets.fromLTRB(14, 14, 14, 10),
                  itemCount: snaps.length,
                  separatorBuilder: (_, __) => const SizedBox(width: 10),
                  itemBuilder: (context, idx) {
                    final snap = snaps[idx];
                    final picked = _selectedForDiff.any((s) => s.id == snap.id);
                    return SizedBox(
                      width: 185,
                      child: ArcFrostedCardSurface(
                        isActive: picked,
                        padding: const EdgeInsets.all(10),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Icon(
                                  snap.isMilestone ? LucideIcons.star : LucideIcons.gitCommitHorizontal,
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
                                        fontSize: 12, fontWeight: FontWeight.w700, color: t.textPrimary),
                                  ),
                                ),
                                InkWell(
                                  onTap: () {
                                    setState(() {
                                      if (picked) {
                                        _selectedForDiff.removeWhere((s) => s.id == snap.id);
                                      } else {
                                        if (_selectedForDiff.length >= 2) {
                                          _selectedForDiff.removeAt(0);
                                        }
                                        _selectedForDiff.add(snap);
                                      }
                                    });
                                  },
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
                                        fontSize: 10.5, color: t.accent, fontWeight: FontWeight.w600),
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
              ],
            ),
          ),
      ],
    );

    if (widget.isModalSheet) {
      return ArcLiquidGlassSurface(
        liquidGlassSettings: c.settings.liquidGlass,
        borderRadius: 24,
        child: body,
      );
    }

    return Container(
      decoration: BoxDecoration(
        color: t.isLiquidGlass ? t.bgSurface.withValues(alpha: 0.55) : t.bgSurface,
        border: Border(top: BorderSide(color: t.borderSubtle)),
      ),
      child: body,
    );
  }
}

class _ArcDomeTimelinePainter extends CustomPainter {
  const _ArcDomeTimelinePainter({required this.color});
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final path = Path()
      ..moveTo(12, size.height * 0.72)
      ..quadraticBezierTo(size.width * 0.5, -size.height * 0.1, size.width - 12, size.height * 0.72);
    canvas.drawPath(
      path,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2.2
        ..color = color.withValues(alpha: 0.25),
    );
    // Subtle zenith tick
    canvas.drawCircle(
      Offset(size.width * 0.5, math.max(6, size.height * 0.3)),
      3,
      Paint()..color = color.withValues(alpha: 0.35),
    );
  }

  @override
  bool shouldRepaint(covariant _ArcDomeTimelinePainter oldDelegate) => oldDelegate.color != color;
}
