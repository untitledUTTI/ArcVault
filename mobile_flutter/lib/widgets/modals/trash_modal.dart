import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../../core/tutorial_flow.dart';
import '../../i18n/dictionaries.dart';
import '../../state/app_controller.dart';
import '../../theme/arc_theme.dart';
import '../../theme/liquid_glass_surface.dart';

class TrashModal extends StatefulWidget {
  const TrashModal({super.key, required this.controller, this.onClose});
  final AppController controller;
  final VoidCallback? onClose;

  @override
  State<TrashModal> createState() => _TrashModalState();
}

class _TrashModalState extends State<TrashModal> {
  String _query = '';
  String? _expandedId;

  @override
  Widget build(BuildContext context) {
    final t = context.arcTheme;
    final c = widget.controller;
    final d = ArcStrings.of(c.settings.locale);
    final items = c.trashedDocuments.where((doc) {
      if (_query.trim().isEmpty) return true;
      final q = _query.trim().toLowerCase();
      return doc.title.toLowerCase().contains(q) || doc.markdownText.toLowerCase().contains(q);
    }).toList();

    return ArcLiquidGlassSurface(
      key: c.tourTargets.keyFor(TutorialTargetId.trashModal),
      liquidGlassSettings: c.settings.liquidGlass,
      borderRadius: 24,
      child: SizedBox(
        height: MediaQuery.sizeOf(context).height * 0.78,
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 10, 6),
              child: Row(
                children: [
                  Icon(LucideIcons.trash2, size: 18, color: t.accent),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(d.trashTitle,
                            style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15, color: t.textPrimary)),
                        Text(d.trashPermanentLong,
                            style: TextStyle(fontSize: 11, color: t.accent, fontWeight: FontWeight.w600)),
                      ],
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
              child: Column(
                children: [
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: t.accentSoft,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Text(d.trashNotice, style: TextStyle(fontSize: 11.5, color: t.textPrimary)),
                  ),
                  const SizedBox(height: 8),
                  TextField(
                    onChanged: (v) => setState(() => _query = v),
                    decoration: InputDecoration(
                      isDense: true,
                      prefixIcon: const Icon(LucideIcons.search, size: 15),
                      hintText: d.trashSearchPlaceholder,
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 8),
            Expanded(
              child: items.isEmpty
                  ? Center(
                      child: Padding(
                        padding: const EdgeInsets.all(24),
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(d.trashEmptyTitle,
                                style: TextStyle(fontWeight: FontWeight.w700, color: t.textPrimary)),
                            const SizedBox(height: 6),
                            Text(d.trashEmptyDesc,
                                textAlign: TextAlign.center,
                                style: TextStyle(fontSize: 12, color: t.textMuted)),
                          ],
                        ),
                      ),
                    )
                  : ListView.separated(
                      padding: const EdgeInsets.all(14),
                      itemCount: items.length,
                      separatorBuilder: (_, __) => const SizedBox(height: 8),
                      itemBuilder: (context, idx) {
                        final doc = items[idx];
                        final expanded = _expandedId == doc.id;
                        return ArcFrostedCardSurface(
                          padding: const EdgeInsets.all(12),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Expanded(
                                    child: Text(doc.title,
                                        style: TextStyle(
                                            fontWeight: FontWeight.w700, fontSize: 13.5, color: t.textPrimary)),
                                  ),
                                  TextButton(
                                    onPressed: () => setState(() => _expandedId = expanded ? null : doc.id),
                                    child: Text(expanded ? '收起' : '预览', style: const TextStyle(fontSize: 12)),
                                  ),
                                  FilledButton(
                                    onPressed: () {
                                      c.restoreFromTrash(doc.id);
                                      (widget.onClose ?? () => Navigator.of(context).pop())();
                                    },
                                    style: FilledButton.styleFrom(
                                      backgroundColor: t.accent,
                                      foregroundColor: t.accentText,
                                      visualDensity: VisualDensity.compact,
                                    ),
                                    child: Text(d.restoreBtn, style: const TextStyle(fontSize: 12)),
                                  ),
                                ],
                              ),
                              if (expanded) ...[
                                const Divider(),
                                Text(
                                  doc.markdownText.isEmpty ? '（空）' : doc.markdownText,
                                  maxLines: 8,
                                  overflow: TextOverflow.ellipsis,
                                  style: TextStyle(fontSize: 12, color: t.textSecondary),
                                ),
                              ],
                            ],
                          ),
                        );
                      },
                    ),
            ),
          ],
        ),
      ),
    );
  }
}
