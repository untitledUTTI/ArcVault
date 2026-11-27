import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../core/device_layout.dart';
import '../core/tutorial_flow.dart';
import '../i18n/dictionaries.dart';
import '../models/archive_models.dart';
import '../state/app_controller.dart';
import '../theme/arc_theme.dart';
import 'arc_vault_logo.dart';

class TopBar extends StatelessWidget {
  const TopBar({
    super.key,
    required this.controller,
    required this.layout,
    required this.onOpenDrawer,
    required this.onOpenTimelineSheet,
    required this.onOpenAnnotationsSheet,
    required this.onOpenBranches,
    required this.onOpenPaperStudio,
    required this.onOpenContextAssets,
    required this.onOpenEvolutionStudio,
    required this.onOpenCoverSplit,
    required this.onOpenSync,
    required this.onOpenSettings,
    required this.onOpenCameraScan,
    required this.onOpenShareIntake,
  });

  final AppController controller;
  final DeviceLayoutInfo layout;
  final VoidCallback onOpenDrawer;
  final VoidCallback onOpenTimelineSheet;
  final VoidCallback onOpenAnnotationsSheet;
  final VoidCallback onOpenBranches;
  final VoidCallback onOpenPaperStudio;
  final VoidCallback onOpenContextAssets;
  final VoidCallback onOpenEvolutionStudio;
  final VoidCallback onOpenCoverSplit;
  final VoidCallback onOpenSync;
  final VoidCallback onOpenSettings;
  final VoidCallback onOpenCameraScan;
  final VoidCallback onOpenShareIntake;

  @override
  Widget build(BuildContext context) {
    final t = context.arcTheme;
    final s = controller.settings;
    final d = ArcStrings.of(s.locale);
    final doc = controller.activeDoc;
    final openAnnCount =
        doc?.annotations.where((a) => a.status == AnnotationStatus.open).length ?? 0;

    final barContent = Padding(
      padding: EdgeInsets.only(
        top: layout.topPadding + 4,
        left: 10,
        right: 10,
        bottom: 8,
      ),
      child: Row(
        children: [
          if (layout.isCompact)
            _TopIconButton(
              icon: LucideIcons.menu,
              tooltip: d.openMenu,
              onTap: onOpenDrawer,
            ),
          ArcVaultLogo(size: 24, themeId: s.theme),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  doc?.title ?? d.brandName,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 13.5,
                    fontWeight: FontWeight.w700,
                    color: t.textPrimary,
                  ),
                ),
                Text(
                  controller.activeSpace.label(s.locale),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(fontSize: 10.5, color: t.textMuted),
                ),
              ],
            ),
          ),

          if (!layout.isCompact) ...[
            Row(
              key: controller.tourTargets.keyFor(TutorialTargetId.topbarFormatGroup),
              mainAxisSize: MainAxisSize.min,
              children: [
                if (doc != null) ...[
                  _TopPillButton(
                    icon: LucideIcons.arrowLeftRight,
                    label: doc.activeFormat == EditorFormat.markdown ? 'MD' : 'LaTeX',
                    onTap: controller.toggleActiveFormat,
                  ),
                  const SizedBox(width: 6),
                ],
                _TopPillButton(
                  icon: controller.splitPreview ? LucideIcons.eyeOff : LucideIcons.eye,
                  label: controller.splitPreview ? d.edit : d.preview,
                  active: controller.splitPreview,
                  onTap: () {
                    controller.toggleSplitPreview();
                    controller.notifyTutorialAction(TutorialActionId.togglePreview);
                  },
                ),
              ],
            ),
            const SizedBox(width: 6),
            KeyedSubtree(
              key: controller.tourTargets.keyFor(TutorialTargetId.topbarSnapshotBtn),
              child: _TopPillButton(
                icon: LucideIcons.bookmarkPlus,
                label: d.snapshotShort,
                primary: true,
                onTap: () {
                  controller.saveMilestoneSnapshot();
                  controller.notifyTutorialAction(TutorialActionId.saveSnapshot);
                },
              ),
            ),
            const SizedBox(width: 6),
          ],

          _TopIconButton(
            icon: LucideIcons.clock,
            tooltip: d.timelineSheet,
            onTap: onOpenTimelineSheet,
          ),
          if (layout.isCompact)
            Stack(
              clipBehavior: Clip.none,
              children: [
                _TopIconButton(
                  icon: LucideIcons.messageSquare,
                  tooltip: d.annotationsSheet,
                  onTap: onOpenAnnotationsSheet,
                ),
                if (openAnnCount > 0)
                  Positioned(
                    right: 2,
                    top: 2,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                      decoration: BoxDecoration(
                        color: t.revisionColor,
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        '$openAnnCount',
                        style: const TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.w700),
                      ),
                    ),
                  ),
              ],
            ),
          _TopIconButton(
            icon: LucideIcons.settings,
            tooltip: d.settings,
            onTap: onOpenSettings,
          ),

          KeyedSubtree(
            key: controller.tourTargets.keyFor(TutorialTargetId.topbarMoreBtn),
            child: PopupMenuButton<String>(
              icon: Icon(LucideIcons.ellipsis, size: 18, color: t.textPrimary),
              color: t.bgElevated,
              surfaceTintColor: Colors.transparent,
              elevation: 12,
              shadowColor: Colors.black.withValues(alpha: t.isDark ? 0.48 : 0.14),
              offset: const Offset(0, 40),
              menuPadding: const EdgeInsets.symmetric(vertical: 6),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(t.radius > 16 ? 20 : 16),
                side: BorderSide(color: t.borderStrong.withValues(alpha: 0.45)),
              ),
              onSelected: (value) {
                switch (value) {
                  case 'branches':
                    onOpenBranches();
                  case 'paper-studio':
                    onOpenPaperStudio();
                  case 'context-assets':
                    onOpenContextAssets();
                  case 'evolution':
                    onOpenEvolutionStudio();
                  case 'cover-split':
                    onOpenCoverSplit();
                  case 'seal':
                    controller.toggleSealActiveDoc();
                  case 'export-clean':
                    controller.exportActiveDocument('clean');
                  case 'export-redline':
                    controller.exportActiveDocument('redline');
                  case 'export-md':
                    controller.exportActiveDocument('md');
                  case 'export-tex':
                    controller.exportActiveDocument('tex');
                  case 'sync':
                    onOpenSync();
                  case 'scan':
                    onOpenCameraScan();
                  case 'share':
                    onOpenShareIntake();
                  case 'tutorial':
                    controller.openTutorialReplay();
                }
              },
              itemBuilder: (context) => [
                _menuItem('branches', LucideIcons.gitBranch, d.branches),
                _menuItem('paper-studio', LucideIcons.stethoscope, d.paperStudioShort),
                _menuItem('context-assets', LucideIcons.paperclip, d.contextAssetsShort),
                _menuItem('evolution', LucideIcons.flame, d.evolutionStudioShort),
                if (doc?.baseDocxBase64 != null)
                  _menuItem('cover-split', LucideIcons.scissors, d.adjustCover),
                _menuItem(
                  'seal',
                  doc?.isSealed == true ? LucideIcons.unlock : LucideIcons.lock,
                  doc?.isSealed == true ? d.unseal : d.seal,
                  accent: doc?.isSealed == true ? t.revisionColor : null,
                ),
                _ThemedMenuDivider(color: t.borderSubtle),
                _menuItem('export-clean', LucideIcons.download, d.exportCleanWord),
                _menuItem('export-redline', LucideIcons.download, d.exportRedlineWord),
                _menuItem('export-md', LucideIcons.download, d.exportMd),
                _menuItem('export-tex', LucideIcons.download, d.exportTex),
                _ThemedMenuDivider(color: t.borderSubtle),
                _menuItem('sync', LucideIcons.wifi, d.syncLabel),
                _menuItem('scan', LucideIcons.camera, d.cameraScan),
                _menuItem('share', LucideIcons.share2, d.shareIntake),
                _menuItem('tutorial', LucideIcons.bookOpen, d.tutorialShort),
              ],
            ),
          ),
        ],
      ),
    );

    // Immersive status bar integration: TopBar surface extends seamlessly under status bar!
    return Container(
      decoration: BoxDecoration(
        color: t.bgSurface,
        border: Border(bottom: BorderSide(color: t.borderSubtle)),
      ),
      child: barContent,
    );
  }
}

PopupMenuItem<String> _menuItem(
  String value,
  IconData icon,
  String label, {
  Color? accent,
}) {
  return PopupMenuItem<String>(
    value: value,
    height: 40,
    padding: const EdgeInsets.symmetric(horizontal: 10),
    child: _MenuRow(icon, label, accent: accent),
  );
}

class _ThemedMenuDivider extends PopupMenuEntry<String> {
  const _ThemedMenuDivider({required this.color});
  final Color color;

  @override
  double get height => 9;

  @override
  bool represents(String? value) => false;

  @override
  State<_ThemedMenuDivider> createState() => _ThemedMenuDividerState();
}

class _ThemedMenuDividerState extends State<_ThemedMenuDivider> {
  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
      child: Divider(height: 1, thickness: 1, color: widget.color),
    );
  }
}

class _MenuRow extends StatelessWidget {
  const _MenuRow(this.icon, this.label, {this.accent});
  final IconData icon;
  final String label;
  final Color? accent;

  @override
  Widget build(BuildContext context) {
    final t = context.arcTheme;
    final iconColor = accent ?? t.accent;
    final badgeBg = accent != null ? accent!.withValues(alpha: 0.14) : t.accentSoft;
    return Row(
      children: [
        Container(
          width: 26,
          height: 26,
          decoration: BoxDecoration(
            color: badgeBg,
            borderRadius: BorderRadius.circular(8),
          ),
          child: Icon(icon, size: 14, color: iconColor),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Text(
            label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w500,
              color: t.textPrimary,
            ),
          ),
        ),
      ],
    );
  }
}

class _TopIconButton extends StatelessWidget {
  const _TopIconButton({
    required this.icon,
    required this.tooltip,
    required this.onTap,
  });

  final IconData icon;
  final String tooltip;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final t = context.arcTheme;
    return IconButton(
      tooltip: tooltip,
      onPressed: onTap,
      icon: Icon(icon, size: 18, color: t.textPrimary),
      visualDensity: VisualDensity.compact,
      constraints: const BoxConstraints(minWidth: 34, minHeight: 34),
      padding: EdgeInsets.zero,
    );
  }
}

class _TopPillButton extends StatelessWidget {
  const _TopPillButton({
    required this.icon,
    required this.label,
    this.active = false,
    this.primary = false,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final bool active;
  final bool primary;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final t = context.arcTheme;
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(14),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
          color: primary ? t.accent : (active ? t.accentSoft : t.bgSubtle),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: active ? t.accent : t.borderSubtle),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 14, color: primary ? t.accentText : (active ? t.accent : t.textPrimary)),
            const SizedBox(width: 5),
            Text(
              label,
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: primary ? t.accentText : (active ? t.accent : t.textPrimary),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
