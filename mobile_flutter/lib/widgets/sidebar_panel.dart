import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../core/tutorial_flow.dart';
import '../i18n/dictionaries.dart';
import '../models/archive_models.dart';
import '../state/app_controller.dart';
import '../theme/arc_theme.dart';

class SidebarPanel extends StatelessWidget {
  const SidebarPanel({
    super.key,
    required this.controller,
    required this.isDrawer,
    this.onCloseDrawer,
    required this.onImportPicked,
    required this.onOpenVaultLock,
    required this.onOpenTrash,
    required this.onOpenSync,
    required this.onOpenCameraScan,
    required this.onOpenShareIntake,
  });

  final AppController controller;
  final bool isDrawer;
  final VoidCallback? onCloseDrawer;
  final Future<void> Function() onImportPicked;
  final VoidCallback onOpenVaultLock;
  final VoidCallback onOpenTrash;
  final VoidCallback onOpenSync;
  final VoidCallback onOpenCameraScan;
  final VoidCallback onOpenShareIntake;

  @override
  Widget build(BuildContext context) {
    final t = context.arcTheme;
    final s = controller.settings;
    final d = ArcStrings.of(s.locale);
    final docs = controller.activeSpaceDocuments;
    final trashedCount = controller.trashedDocuments.length;

    final inner = Column(
      children: [
        if (isDrawer)
          Padding(
            padding: const EdgeInsets.fromLTRB(14, 10, 10, 6),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    d.sidebarHeader,
                    style: TextStyle(
                      color: t.textPrimary,
                      fontWeight: FontWeight.w700,
                      fontSize: 14,
                    ),
                  ),
                ),
                IconButton(
                  onPressed: onCloseDrawer,
                  icon: Icon(LucideIcons.x, size: 17, color: t.textSecondary),
                  visualDensity: VisualDensity.compact,
                ),
              ],
            ),
          ),

        // 4 Spaces Switcher
        Padding(
          padding: const EdgeInsets.fromLTRB(10, 6, 10, 6),
          child: GridView.count(
            crossAxisCount: 2,
            mainAxisSpacing: 6,
            crossAxisSpacing: 6,
            childAspectRatio: 3.1,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            children: controller.spaces.map((sp) {
              final active = sp.id == controller.activeSpaceId;
              return InkWell(
                onTap: () => controller.selectSpace(sp.id),
                borderRadius: BorderRadius.circular(10),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8),
                  decoration: BoxDecoration(
                    color: active ? t.accentSoft : t.bgSubtle.withValues(alpha: 0.6),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: active ? t.accent : t.borderSubtle),
                  ),
                  child: Row(
                    children: [
                      Icon(
                        _spaceIcon(sp.kind),
                        size: 14,
                        color: active ? t.accent : t.textSecondary,
                      ),
                      const SizedBox(width: 6),
                      Expanded(
                        child: Text(
                          sp.label(s.locale),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: active ? FontWeight.w700 : FontWeight.w500,
                            color: active ? t.accent : t.textPrimary,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              );
            }).toList(),
          ),
        ),

        // Quick Actions
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
          child: Column(
            children: [
              SizedBox(
                width: double.infinity,
                child: FilledButton.icon(
                  onPressed: () async {
                    controller.triggerHaptic(HapticPattern.light);
                    await onImportPicked();
                    onCloseDrawer?.call();
                  },
                  icon: const Icon(LucideIcons.upload, size: 14),
                  label: Text(d.importDocx, style: const TextStyle(fontSize: 12.5)),
                  style: FilledButton.styleFrom(
                    backgroundColor: t.accent,
                    foregroundColor: t.accentText,
                    padding: const EdgeInsets.symmetric(vertical: 10),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                ),
              ),
              const SizedBox(height: 6),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: () {
                        controller.triggerHaptic(HapticPattern.light);
                        controller.importSamplePaperDocx();
                        onCloseDrawer?.call();
                      },
                      icon: const Icon(LucideIcons.sparkles, size: 13),
                      label: Text(
                        d.importSample,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(fontSize: 11.5),
                      ),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: t.textPrimary,
                        side: BorderSide(color: t.borderSubtle),
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
                      ),
                    ),
                  ),
                  const SizedBox(width: 6),
                  OutlinedButton(
                    onPressed: () {
                      controller.triggerHaptic(HapticPattern.light);
                      controller.createBlankDocument();
                      onCloseDrawer?.call();
                    },
                    style: OutlinedButton.styleFrom(
                      foregroundColor: t.textPrimary,
                      side: BorderSide(color: t.borderSubtle),
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                      minimumSize: const Size(38, 36),
                    ),
                    child: const Icon(LucideIcons.filePlus2, size: 15),
                  ),
                ],
              ),
              const SizedBox(height: 6),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: () {
                        onCloseDrawer?.call();
                        onOpenCameraScan();
                      },
                      icon: const Icon(LucideIcons.camera, size: 13),
                      label: Text(d.cameraScanShort, style: const TextStyle(fontSize: 11.5)),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: t.textPrimary,
                        side: BorderSide(color: t.borderSubtle),
                        padding: const EdgeInsets.symmetric(vertical: 8),
                      ),
                    ),
                  ),
                  const SizedBox(width: 6),
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: () {
                        onCloseDrawer?.call();
                        onOpenShareIntake();
                      },
                      icon: const Icon(LucideIcons.share2, size: 13),
                      label: Text(d.shareIntakeShort, style: const TextStyle(fontSize: 11.5)),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: t.textPrimary,
                        side: BorderSide(color: t.borderSubtle),
                        padding: const EdgeInsets.symmetric(vertical: 8),
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),

        if (controller.activeSpace.kind == SpaceKind.vault)
          Padding(
            padding: const EdgeInsets.fromLTRB(10, 4, 10, 2),
            child: SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                onPressed: onOpenVaultLock,
                icon: Icon(
                  controller.vaultUnlocked ? LucideIcons.unlock : LucideIcons.lock,
                  size: 14,
                  color: controller.vaultUnlocked ? t.accent : t.revisionColor,
                ),
                label: Text(
                  controller.vaultUnlocked ? d.vaultUnlocked : d.vaultLocked,
                  style: TextStyle(fontSize: 12, color: t.textPrimary),
                ),
                style: OutlinedButton.styleFrom(
                  side: BorderSide(color: controller.vaultUnlocked ? t.borderSubtle : t.revisionColor),
                ),
              ),
            ),
          ),

        Divider(height: 12, color: t.borderSubtle),

        // Document List (Restrained frosted cards)
        Expanded(
          child: docs.isEmpty
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(20),
                    child: Text(
                      d.sidebarEmpty,
                      textAlign: TextAlign.center,
                      style: TextStyle(fontSize: 12, color: t.textMuted),
                    ),
                  ),
                )
              : ListView.separated(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  itemCount: docs.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 6),
                  itemBuilder: (context, idx) {
                    final doc = docs[idx];
                    final active = doc.id == controller.activeDoc?.id;
                    final openAnns =
                        doc.annotations.where((a) => a.status == AnnotationStatus.open).length;
                    final snapCount = controller.snapshotsForDoc(doc.id).length;

                    return InkWell(
                      onTap: () {
                        controller.selectDocument(doc.id);
                        onCloseDrawer?.call();
                      },
                      borderRadius: BorderRadius.circular(t.radiusSm),
                      child: ArcCardSurface(
                        isActive: active,
                        padding: const EdgeInsets.all(10),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Expanded(
                                  child: Text(
                                    doc.title,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: TextStyle(
                                      fontSize: 13,
                                      fontWeight: active ? FontWeight.w700 : FontWeight.w600,
                                      color: t.textPrimary,
                                    ),
                                  ),
                                ),
                                if (doc.isSealed)
                                  Padding(
                                    padding: const EdgeInsets.only(right: 4),
                                    child: Icon(LucideIcons.lock, size: 12, color: t.accent),
                                  ),
                                InkWell(
                                  onTap: () => controller.moveToTrash(doc.id),
                                  borderRadius: BorderRadius.circular(6),
                                  child: Padding(
                                    padding: const EdgeInsets.all(3),
                                    child: Icon(
                                      LucideIcons.trash2,
                                      size: 13.5,
                                      color: controller.canMoveToTrash(doc)
                                          ? t.textMuted
                                          : t.textMuted.withValues(alpha: 0.35),
                                    ),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 4),
                            Row(
                              children: [
                                _TagChip(label: doc.sourceExt, color: t.accent),
                                const SizedBox(width: 6),
                                Text(
                                  '$snapCount ${d.snapUnit}',
                                  style: TextStyle(fontSize: 11, color: t.textMuted),
                                ),
                                if (openAnns > 0) ...[
                                  const SizedBox(width: 8),
                                  Text(
                                    '$openAnns ${d.openAnnotations}',
                                    style: TextStyle(
                                      fontSize: 11,
                                      color: t.revisionColor,
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                ],
                              ],
                            ),
                          ],
                        ),
                      ),
                    );
                  },
                ),
        ),

        // Bottom E2EE Sync + Permanent Trash Entry
        Divider(height: 1, color: t.borderSubtle),
        Padding(
          padding: const EdgeInsets.fromLTRB(10, 8, 10, 10),
          child: Column(
            children: [
              SizedBox(
                width: double.infinity,
                child: OutlinedButton.icon(
                  onPressed: () {
                    onCloseDrawer?.call();
                    onOpenSync();
                  },
                  icon: Icon(LucideIcons.wifi, size: 14, color: t.accent),
                  label: Text(d.syncLabel, style: TextStyle(fontSize: 12, color: t.textPrimary)),
                  style: OutlinedButton.styleFrom(
                    side: BorderSide(color: t.borderSubtle),
                    padding: const EdgeInsets.symmetric(vertical: 9),
                  ),
                ),
              ),
              const SizedBox(height: 6),
              InkWell(
                onTap: () {
                  onCloseDrawer?.call();
                  onOpenTrash();
                  controller.notifyTutorialAction(TutorialActionId.openTrash);
                },
                borderRadius: BorderRadius.circular(10),
                child: Container(
                  key: controller.tourTargets.keyFor(TutorialTargetId.sidebarTrashBtn),
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 9),
                  decoration: BoxDecoration(
                    color: t.bgSubtle.withValues(alpha: 0.55),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: t.borderSubtle),
                  ),
                  child: Row(
                    children: [
                      Icon(LucideIcons.trash2, size: 14, color: t.textSecondary),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          d.trashEntry,
                          style: TextStyle(
                            fontSize: 12.5,
                            fontWeight: FontWeight.w600,
                            color: t.textPrimary,
                          ),
                        ),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: t.accentSoft,
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Text(
                          '$trashedCount · ${d.trashPermanentBadge}',
                          style: TextStyle(fontSize: 10.5, color: t.accent, fontWeight: FontWeight.w600),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );

    if (isDrawer) {
      return ArcSurface(
        key: controller.tourTargets.keyFor(TutorialTargetId.sidebarPanel),
        borderRadius: t.sidebarRadius,
        color: t.bgSurface,
        child: SafeArea(left: true, top: true, bottom: true, right: false, child: inner),
      );
    }

    return Container(
      key: controller.tourTargets.keyFor(TutorialTargetId.sidebarPanel),
      decoration: BoxDecoration(
        color: t.bgSurface,
        border: Border(right: BorderSide(color: t.borderSubtle)),
      ),
      child: inner,
    );
  }

  IconData _spaceIcon(SpaceKind kind) {
    switch (kind) {
      case SpaceKind.paper:
        return LucideIcons.graduationCap;
      case SpaceKind.office:
        return LucideIcons.briefcase;
      case SpaceKind.writing:
        return LucideIcons.penTool;
      case SpaceKind.vault:
        return LucideIcons.shieldCheck;
    }
  }
}

class _TagChip extends StatelessWidget {
  const _TagChip({required this.label, required this.color});
  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.14),
        borderRadius: BorderRadius.circular(5),
      ),
      child: Text(
        label,
        style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w600, color: color),
      ),
    );
  }
}
