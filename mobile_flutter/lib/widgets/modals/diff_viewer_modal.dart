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

  @override
  Widget build(BuildContext context) {
    final t = context.arcTheme;
    final c = widget.controller;
    final isZh = c.settings.locale.isZh;
    final doc = c.activeDoc;
    final leftText = widget.leftSnap != null ? (c.cas.get(widget.leftSnap!.contentHash) ?? '') : '';
    final rightText = widget.rightSnap != null
        ? (c.cas.get(widget.rightSnap!.contentHash) ?? '')
        : (doc?.activeText ?? '');
    final diff = computeDocumentDiff(leftText, rightText);
    final darlings = doc != null ? c.darlingsForDoc(doc.id) : const <DeletedDarling>[];

    return ArcSurface(
      key: c.tourTargets.keyFor(TutorialTargetId.diffModal),
      borderRadius: 24,
      child: SizedBox(
        height: MediaQuery.sizeOf(context).height * 0.8,
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
                      isZh ? '版本逐行 Diff 与废稿墓地' : 'Version Diff & Deleted Darlings',
                      style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15, color: t.textPrimary),
                    ),
                  ),
                  IconButton(
                    onPressed: () => (widget.onClose ?? () => Navigator.of(context).pop())(),
                    icon: Icon(LucideIcons.x, size: 18, color: t.textSecondary),
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 14),
              child: Row(
                children: [
                  ChoiceChip(
                    label: Text(isZh ? '差异对比 (${diff.summary})' : 'Diff (${diff.summary})',
                        style: const TextStyle(fontSize: 11.5)),
                    selected: !_darlingsTab,
                    onSelected: (_) => setState(() => _darlingsTab = false),
                  ),
                  const SizedBox(width: 8),
                  ChoiceChip(
                    label: Text(isZh ? '废稿墓地 (${darlings.length})' : 'Darlings (${darlings.length})',
                        style: const TextStyle(fontSize: 11.5)),
                    selected: _darlingsTab,
                    onSelected: (_) => setState(() => _darlingsTab = true),
                  ),
                ],
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
                              Text('${dl.charCount} 字 · ${dl.deletedAt.substring(0, 10)}',
                                  style: TextStyle(fontSize: 11, color: t.accent, fontWeight: FontWeight.w600)),
                              const SizedBox(height: 4),
                              Text(dl.text, style: TextStyle(fontSize: 12.5, color: t.textPrimary)),
                              const SizedBox(height: 6),
                              Align(
                                alignment: Alignment.centerRight,
                                child: TextButton.icon(
                                  onPressed: () {
                                    c.insertSnippet('\n${dl.text}');
                                    (widget.onClose ?? () => Navigator.of(context).pop())();
                                  },
                                  icon: const Icon(LucideIcons.undo2, size: 14),
                                  label: Text(isZh ? '捞回正文' : 'Restore to Draft'),
                                ),
                              ),
                            ],
                          ),
                        );
                      },
                    )
                  : SingleChildScrollView(
                      padding: const EdgeInsets.all(14),
                      child: SelectableText.rich(
                        TextSpan(
                          children: diff.hunks.map((h) {
                            if (h.type == DiffHunkType.added) {
                              return TextSpan(
                                text: h.value,
                                style: TextStyle(
                                  backgroundColor: Colors.green.withValues(alpha: 0.22),
                                  color: t.textPrimary,
                                ),
                              );
                            }
                            if (h.type == DiffHunkType.removed) {
                              return TextSpan(
                                text: h.value,
                                style: TextStyle(
                                  backgroundColor: Colors.red.withValues(alpha: 0.22),
                                  decoration: TextDecoration.lineThrough,
                                  color: t.textPrimary,
                                ),
                              );
                            }
                            return TextSpan(text: h.value, style: TextStyle(color: t.textSecondary));
                          }).toList(),
                        ),
                      ),
                    ),
            ),
          ],
        ),
      ),
    );
  }
}
