import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../../core/tutorial_flow.dart';
import '../../state/app_controller.dart';
import '../../theme/arc_theme.dart';
import '../../theme/liquid_glass_surface.dart';

class BranchModal extends StatefulWidget {
  const BranchModal({super.key, required this.controller, this.onClose});
  final AppController controller;
  final VoidCallback? onClose;

  @override
  State<BranchModal> createState() => _BranchModalState();
}

class _BranchModalState extends State<BranchModal> {
  final TextEditingController _nameCtrl = TextEditingController();

  @override
  void dispose() {
    _nameCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final t = context.arcTheme;
    final c = widget.controller;
    final doc = c.activeDoc;
    final isZh = c.settings.locale.isZh;
    final branches = doc != null ? c.branchesForDoc(doc.id) : const [];

    return ArcLiquidGlassSurface(
      key: c.tourTargets.keyFor(TutorialTargetId.branchModal),
      liquidGlassSettings: c.settings.liquidGlass,
      borderRadius: 24,
      padding: const EdgeInsets.all(16),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            children: [
              Icon(LucideIcons.gitBranch, size: 18, color: t.accent),
              const SizedBox(width: 8),
              Expanded(
                child: Text(isZh ? 'A/B 平行写作分支' : 'A/B Parallel Branches',
                    style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15, color: t.textPrimary)),
              ),
              IconButton(
                  onPressed: () => (widget.onClose ?? () => Navigator.of(context).pop())(),
                  icon: const Icon(LucideIcons.x, size: 18)),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _nameCtrl,
                  decoration: InputDecoration(
                    isDense: true,
                    hintText: isZh ? '新分支名（如：方案 C · 精简版）' : 'New branch name...',
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              FilledButton(
                onPressed: () {
                  c.createBranch(_nameCtrl.text);
                  _nameCtrl.clear();
                },
                style: FilledButton.styleFrom(backgroundColor: t.accent, foregroundColor: t.accentText),
                child: Text(isZh ? '创建并切换' : 'Create'),
              ),
            ],
          ),
          const SizedBox(height: 12),
          ...branches.map((b) {
            final active = doc?.currentBranchId == b.id;
            return Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: InkWell(
                onTap: () {
                  c.switchBranch(b.id);
                  (widget.onClose ?? () => Navigator.of(context).pop())();
                },
                child: ArcFrostedCardSurface(
                  isActive: active,
                  padding: const EdgeInsets.all(12),
                  child: Row(
                    children: [
                      Icon(LucideIcons.gitBranch, size: 15, color: active ? t.accent : t.textSecondary),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(b.name,
                            style: TextStyle(
                                fontWeight: active ? FontWeight.w700 : FontWeight.w500,
                                color: t.textPrimary)),
                      ),
                      if (active) Icon(LucideIcons.check, size: 16, color: t.accent),
                    ],
                  ),
                ),
              ),
            );
          }),
        ],
      ),
    );
  }
}
