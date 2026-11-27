import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../../core/tutorial_flow.dart';
import '../../state/app_controller.dart';
import '../../theme/arc_theme.dart';

class EvolutionStudioModal extends StatefulWidget {
  const EvolutionStudioModal({super.key, required this.controller, this.onClose});
  final AppController controller;
  final VoidCallback? onClose;

  @override
  State<EvolutionStudioModal> createState() => _EvolutionStudioModalState();
}

class _EvolutionStudioModalState extends State<EvolutionStudioModal> {
  int _snapIdx = 0;

  @override
  Widget build(BuildContext context) {
    final t = context.arcTheme;
    final c = widget.controller;
    final isZh = c.settings.locale.isZh;
    final doc = c.activeDoc;
    final snaps = doc != null ? c.snapshotsForDoc(doc.id) : const [];
    final clampedIdx = snaps.isEmpty ? 0 : _snapIdx.clamp(0, snaps.length - 1);
    final activeSnap = snaps.isNotEmpty ? snaps[clampedIdx] : null;
    final snapText = activeSnap != null ? (c.cas.get(activeSnap.contentHash) ?? '') : '';

    return ArcSurface(
      key: c.tourTargets.keyFor(TutorialTargetId.evolutionStudioModal),
      child: SizedBox(
        height: MediaQuery.sizeOf(context).height * 0.78,
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 10, 6),
              child: Row(
                children: [
                  Icon(LucideIcons.flame, size: 18, color: t.accent),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(isZh ? '写作热力图 & 进化延时回放' : 'Writing Heatmap & Evolution Replay',
                        style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15, color: t.textPrimary)),
                  ),
                  IconButton(
                      onPressed: () => (widget.onClose ?? () => Navigator.of(context).pop())(),
                      icon: const Icon(LucideIcons.x, size: 18)),
                ],
              ),
            ),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.all(14),
                children: [
                  Text(isZh ? '近 14 日写作活跃热力' : '14-Day Writing Activity',
                      style: TextStyle(fontWeight: FontWeight.w700, color: t.textPrimary)),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 6,
                    runSpacing: 6,
                    children: c.writingActivity.map((day) {
                      final alpha = (day.charsDelta / 500).clamp(0.18, 1.0);
                      return Tooltip(
                        message: '${day.date}: +${day.charsDelta} 字',
                        child: Container(
                          width: 26,
                          height: 26,
                          decoration: BoxDecoration(
                            color: t.accent.withValues(alpha: alpha),
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Center(
                            child: Text(
                              day.date.substring(8),
                              style: TextStyle(
                                fontSize: 10,
                                fontWeight: FontWeight.w700,
                                color: alpha > 0.5 ? t.accentText : t.textPrimary,
                              ),
                            ),
                          ),
                        ),
                      );
                    }).toList(),
                  ),
                  const Divider(height: 24),
                  Text(isZh ? '版本进化回放器' : 'Version Evolution Scrubber',
                      style: TextStyle(fontWeight: FontWeight.w700, color: t.textPrimary)),
                  if (snaps.isNotEmpty) ...[
                    Slider(
                      value: clampedIdx.toDouble(),
                      min: 0,
                      max: (snaps.length - 1).toDouble().clamp(0, 100),
                      divisions: snaps.length > 1 ? snaps.length - 1 : 1,
                      onChanged: (v) => setState(() => _snapIdx = v.round()),
                    ),
                    Text(
                      '${activeSnap!.label} · ${activeSnap.wordCount} 字 · ${activeSnap.aiSummary}',
                      style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: t.accent),
                    ),
                    const SizedBox(height: 8),
                    ArcCardSurface(
                      padding: const EdgeInsets.all(12),
                      child: Text(
                        snapText,
                        maxLines: 14,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(fontSize: 12.5, color: t.textPrimary, height: 1.5),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
