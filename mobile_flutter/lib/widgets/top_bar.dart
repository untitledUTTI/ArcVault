import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../core/device_layout.dart';
import '../core/tutorial_flow.dart';
import '../i18n/dictionaries.dart';
import '../models/archive_models.dart';
import '../state/app_controller.dart';
import '../theme/arc_theme.dart';
import '../theme/liquid_glass_surface.dart';
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
        top: layout.topPadding + (t.isLiquidGlass ? 6 : 4),
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
            icon: LucideIcons.palette,
            tooltip: d.switchTheme,
            onTap: controller.cycleTheme,
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
                case 'fullscreen':
                  controller.toggleFullscreen();
                case 'locale':
                  controller.toggleLocale();
                case 'tutorial':
                  controller.openTutorialReplay();
              }
            },
            itemBuilder: (context) => [
              PopupMenuItem(value: 'branches', child: _MenuRow(LucideIcons.gitBranch, d.branches)),
              PopupMenuItem(value: 'paper-studio', child: _MenuRow(LucideIcons.stethoscope, d.paperStudioShort)),
              PopupMenuItem(value: 'context-assets', child: _MenuRow(LucideIcons.paperclip, d.contextAssetsShort)),
              PopupMenuItem(value: 'evolution', child: _MenuRow(LucideIcons.flame, d.evolutionStudioShort)),
              if (doc?.baseDocxBase64 != null)
                PopupMenuItem(value: 'cover-split', child: _MenuRow(LucideIcons.scissors, d.adjustCover)),
              PopupMenuItem(
                value: 'seal',
                child: _MenuRow(
                  doc?.isSealed == true ? LucideIcons.unlock : LucideIcons.lock,
                  doc?.isSealed == true ? d.unseal : d.seal,
                ),
              ),
              const PopupMenuDivider(),
              PopupMenuItem(value: 'export-clean', child: _MenuRow(LucideIcons.download, d.exportCleanWord)),
              PopupMenuItem(value: 'export-redline', child: _MenuRow(LucideIcons.download, d.exportRedlineWord)),
              PopupMenuItem(value: 'export-md', child: _MenuRow(LucideIcons.download, d.exportMd)),
              PopupMenuItem(value: 'export-tex', child: _MenuRow(LucideIcons.download, d.exportTex)),
              const PopupMenuDivider(),
              PopupMenuItem(value: 'sync', child: _MenuRow(LucideIcons.wifi, d.syncLabel)),
              PopupMenuItem(value: 'scan', child: _MenuRow(LucideIcons.camera, d.cameraScan)),
              PopupMenuItem(value: 'share', child: _MenuRow(LucideIcons.share2, d.shareIntake)),
              PopupMenuItem(value: 'fullscreen', child: _MenuRow(LucideIcons.maximize2, d.fullscreen)),
              PopupMenuItem(value: 'locale', child: _MenuRow(LucideIcons.languages, d.switchLanguage)),
              PopupMenuItem(value: 'tutorial', child: _MenuRow(LucideIcons.bookOpen, d.tutorialShort)),
            ],
            ),
          ),
        ],
      ),
    );

    if (t.isLiquidGlass) {
      return Padding(
        padding: const EdgeInsets.symmetric(horizontal: 8),
        child: ArcLiquidGlassSurface(
          liquidGlassSettings: s.liquidGlass,
          borderRadius: 22,
          child: barContent,
        ),
      );
    }

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

class _MenuRow extends StatelessWidget {
  const _MenuRow(this.icon, this.label);
  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    final t = context.arcTheme;
    return Row(
      children: [
        Icon(icon, size: 15, color: t.textSecondary),
        const SizedBox(width: 10),
        Expanded(
          child: Text(label, style: TextStyle(fontSize: 13, color: t.textPrimary)),
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
