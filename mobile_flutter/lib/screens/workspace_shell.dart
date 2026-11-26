import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../core/device_layout.dart';
import '../models/archive_models.dart';
import '../state/app_controller.dart';
import '../theme/arc_theme.dart';
import '../theme/liquid_glass_surface.dart';
import '../widgets/annotation_sidebar.dart';
import '../widgets/editor_workspace.dart';
import '../widgets/mobile_annotation_sheet.dart';
import '../widgets/mobile_quick_format_bar.dart';
import '../widgets/modals/branch_modal.dart';
import '../widgets/modals/camera_scan_modal.dart';
import '../widgets/modals/context_assets_modal.dart';
import '../widgets/modals/cover_split_modal.dart';
import '../widgets/modals/diff_viewer_modal.dart';
import '../widgets/modals/evolution_studio_modal.dart';
import '../widgets/modals/paper_studio_modal.dart';
import '../widgets/modals/settings_modal.dart';
import '../widgets/modals/share_intake_modal.dart';
import '../widgets/modals/sync_modal.dart';
import '../widgets/modals/trash_modal.dart';
import '../widgets/modals/tutorial_overlay.dart';
import '../widgets/modals/vault_lock_modal.dart';
import '../widgets/phrasebank_capsule.dart';
import '../widgets/sidebar_panel.dart';
import '../widgets/timeline_panel.dart';
import '../widgets/top_bar.dart';

class WorkspaceShell extends StatefulWidget {
  const WorkspaceShell({super.key, required this.controller});
  final AppController controller;

  @override
  State<WorkspaceShell> createState() => _WorkspaceShellState();
}

class _WorkspaceShellState extends State<WorkspaceShell> {
  bool _drawerOpen = false;
  bool _annotationSheetOpen = false;
  bool _timelineCollapsed = false;
  double _leftSidebarWidth = 264;
  double _rightSidebarWidth = 290;
  bool _sharePromptShown = false;

  @override
  Widget build(BuildContext context) {
    final c = widget.controller;
    final t = context.arcTheme;
    final s = c.settings;
    final layout = DeviceLayoutInfo.fromContext(context);
    final doc = c.activeDoc;

    // Auto-open share intake modal if native Android/iOS share payload arrived
    if (c.pendingShareText != null && !_sharePromptShown) {
      _sharePromptShown = true;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        _showGlassModal(
          context,
          ShareIntakeModal(
            controller: c,
            initialTitle: c.pendingShareTitle,
            initialText: c.pendingShareText,
          ),
        ).then((_) {
          _sharePromptShown = false;
        });
      });
    }

    return AnnotatedRegion(
      value: t.systemUiOverlayStyle,
      child: Scaffold(
        backgroundColor: Colors.transparent,
        resizeToAvoidBottomInset: true,
        body: Stack(
          children: [
            // Full-bleed background extending behind Status Bar & Navigation Gesture Bar
            if (t.isLiquidGlass)
              Positioned.fill(child: ArcLiquidGlassBackdrop(settings: s.liquidGlass))
            else
              Positioned.fill(child: Container(color: t.bgApp)),

            // Main Workspace Column
            Column(
              children: [
                if (!c.isFullscreen)
                  TopBar(
                    controller: c,
                    layout: layout,
                    onOpenDrawer: () => setState(() => _drawerOpen = true),
                    onOpenTimelineSheet: () => _openTimelineSheet(context, c),
                    onOpenAnnotationsSheet: () =>
                        setState(() => _annotationSheetOpen = !_annotationSheetOpen),
                    onOpenBranches: () => _showGlassModal(context, BranchModal(controller: c)),
                    onOpenPaperStudio: () => _showGlassModal(context, PaperStudioModal(controller: c)),
                    onOpenContextAssets: () =>
                        _showGlassModal(context, ContextAssetsModal(controller: c)),
                    onOpenEvolutionStudio: () =>
                        _showGlassModal(context, EvolutionStudioModal(controller: c)),
                    onOpenCoverSplit: () {
                      if (doc?.baseDocxBase64 != null) {
                        _showGlassModal(context, CoverSplitModal(controller: c));
                      }
                    },
                    onOpenSync: () => _showGlassModal(context, SyncModal(controller: c)),
                    onOpenSettings: () => _openSettings(context, c),
                    onOpenCameraScan: () => _showGlassModal(context, CameraScanModal(controller: c)),
                    onOpenShareIntake: () => _showGlassModal(context, ShareIntakeModal(controller: c)),
                  ),

                // Main Content Area
                Expanded(
                  child: layout.isCompact || c.isFullscreen
                      ? _buildCompactBody(c, layout, t)
                      : _buildTabletLandscapeBody(c, layout, t),
                ),

                // Compact Bottom Quick Format Bar (with bottom safe area inset)
                if (layout.isCompact && !c.isFullscreen && doc != null)
                  SafeArea(
                    top: false,
                    child: MobileQuickFormatBar(
                      isZh: s.locale.isZh,
                      readOnly: doc.isSealed,
                      activeFormat: doc.activeFormat,
                      splitPreview: c.splitPreview,
                      canUndo: c.canUndo,
                      canRedo: c.canRedo,
                      openAnnotationCount: doc.annotations
                          .where((a) => a.status == AnnotationStatus.open)
                          .length,
                      phrasebankActive: s.phrasebank.enabled && !s.phrasebank.dismissed,
                      liquidGlassSettings: s.liquidGlass,
                      onUndo: c.undo,
                      onRedo: c.redo,
                      onInsertSnippet: c.insertSnippet,
                      onToggleFormat: c.toggleActiveFormat,
                      onToggleSplitPreview: c.toggleSplitPreview,
                      onOpenAnnotations: () =>
                          setState(() => _annotationSheetOpen = !_annotationSheetOpen),
                      onTogglePhrasebank: () => _showGlassModal(context, PhrasebankModalSheet(controller: c)),
                      onOpenCameraScan: () =>
                          _showGlassModal(context, CameraScanModal(controller: c)),
                      onSaveMilestone: () => c.saveMilestoneSnapshot(),
                      onHaptic: c.triggerHaptic,
                    ),
                  ),
              ],
            ),

            // Exit Fullscreen Floating Pill
            if (c.isFullscreen)
              Positioned(
                top: layout.topPadding + 10,
                right: 12,
                child: ArcLiquidGlassSurface(
                  liquidGlassSettings: s.liquidGlass,
                  borderRadius: 18,
                  child: TextButton.icon(
                    onPressed: c.toggleFullscreen,
                    icon: const Icon(LucideIcons.minimize2, size: 15),
                    label: Text(s.locale.isZh ? '退出全屏' : 'Exit Focus'),
                  ),
                ),
              ),

            // Draggable Edge-Snapping Phrasebank Capsule
            if (!c.isFullscreen)
              PhrasebankFloatingCapsule(
                controller: c,
                onOpenModal: () => _showGlassModal(context, PhrasebankModalSheet(controller: c)),
              ),

            // Compact Mobile Annotation Half-Sheet
            if (layout.isCompact && _annotationSheetOpen)
              Positioned(
                left: 0,
                right: 0,
                bottom: layout.bottomPadding + 56,
                child: MobileAnnotationSheet(
                  controller: c,
                  onClose: () => setState(() => _annotationSheetOpen = false),
                ),
              ),

            // Left Drawer Backdrop + Panel (Phone & Tablet Portrait)
            if (layout.isCompact && _drawerOpen) ...[
              Positioned.fill(
                child: GestureDetector(
                  onTap: () => setState(() => _drawerOpen = false),
                  child: Container(color: Colors.black.withValues(alpha: 0.35)),
                ),
              ),
              Positioned(
                left: 8,
                top: 8,
                bottom: 8,
                width: (layout.width * 0.82).clamp(260.0, 340.0),
                child: SidebarPanel(
                  controller: c,
                  isDrawer: true,
                  onCloseDrawer: () => setState(() => _drawerOpen = false),
                  onImportPicked: () => _handleImportPicked(context, c),
                  onOpenVaultLock: () => _showGlassModal(context, VaultLockModal(controller: c)),
                  onOpenTrash: () => _showGlassModal(context, TrashModal(controller: c)),
                  onOpenSync: () => _showGlassModal(context, SyncModal(controller: c)),
                  onOpenCameraScan: () => _showGlassModal(context, CameraScanModal(controller: c)),
                  onOpenShareIntake: () => _showGlassModal(context, ShareIntakeModal(controller: c)),
                ),
              ),
            ],

            // Toast Notification Banner
            if (c.toastMessage != null)
              Positioned(
                top: layout.topPadding + 58,
                left: 24,
                right: 24,
                child: Center(
                  child: ArcLiquidGlassSurface(
                    liquidGlassSettings: s.liquidGlass,
                    borderRadius: 16,
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                    child: Text(
                      c.toastMessage!,
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 12.5,
                        fontWeight: FontWeight.w600,
                        color: t.textPrimary,
                      ),
                    ),
                  ),
                ),
              ),

            // First-run / Replay Tutorial Overlay
            if (c.tutorialMode != null)
              TutorialOverlay(
                controller: c,
                mode: c.tutorialMode!,
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildCompactBody(AppController c, DeviceLayoutInfo layout, ArcThemeTokens t) {
    return EditorWorkspace(
      controller: c,
      isCompact: true,
      onOpenCoverSplit: () => _showGlassModal(context, CoverSplitModal(controller: c)),
      onOpenSkillsSettings: () => _openSettings(context, c, initialTab: SettingsTab.ai),
      onTogglePhrasebank: () => _showGlassModal(context, PhrasebankModalSheet(controller: c)),
      onTapHighlightedAnnotation: (_) => setState(() => _annotationSheetOpen = true),
    );
  }

  Widget _buildTabletLandscapeBody(AppController c, DeviceLayoutInfo layout, ArcThemeTokens t) {
    final doc = c.activeDoc;
    final hasSelectedAnn =
        c.selectedAnnotationId != null && (doc?.annotations.isNotEmpty ?? false);

    return Column(
      children: [
        Expanded(
          child: Stack(
            children: [
              Row(
                children: [
                  SizedBox(
                    width: _leftSidebarWidth,
                    child: SidebarPanel(
                      controller: c,
                      isDrawer: false,
                      onImportPicked: () => _handleImportPicked(context, c),
                      onOpenVaultLock: () => _showGlassModal(context, VaultLockModal(controller: c)),
                      onOpenTrash: () => _showGlassModal(context, TrashModal(controller: c)),
                      onOpenSync: () => _showGlassModal(context, SyncModal(controller: c)),
                      onOpenCameraScan: () =>
                          _showGlassModal(context, CameraScanModal(controller: c)),
                      onOpenShareIntake: () =>
                          _showGlassModal(context, ShareIntakeModal(controller: c)),
                    ),
                  ),
                  _TouchResizeSash(
                    color: t.borderSubtle,
                    onDragDelta: (dx) => setState(
                      () => _leftSidebarWidth = (_leftSidebarWidth + dx).clamp(210.0, 360.0),
                    ),
                  ),
                  Expanded(
                    child: EditorWorkspace(
                      controller: c,
                      isCompact: false,
                      onOpenCoverSplit: () => _showGlassModal(context, CoverSplitModal(controller: c)),
                      onOpenSkillsSettings: () =>
                          _openSettings(context, c, initialTab: SettingsTab.ai),
                      onTogglePhrasebank: () =>
                          _showGlassModal(context, PhrasebankModalSheet(controller: c)),
                      onTapHighlightedAnnotation: (_) {},
                    ),
                  ),
                  _TouchResizeSash(
                    color: t.borderSubtle,
                    onDragDelta: (dx) => setState(
                      () => _rightSidebarWidth = (_rightSidebarWidth - dx).clamp(220.0, 380.0),
                    ),
                  ),
                  SizedBox(
                    width: _rightSidebarWidth,
                    child: AnnotationSidebar(controller: c),
                  ),
                ],
              ),
              if (hasSelectedAnn)
                IgnorePointer(
                  child: CustomPaint(
                    size: Size.infinite,
                    painter: ArcLinkOverlayPainter(
                      start: Offset(layout.width - _rightSidebarWidth - 44, 150),
                      end: Offset(layout.width - _rightSidebarWidth + 14, 130),
                      color: t.commentColor,
                    ),
                  ),
                ),
            ],
          ),
        ),
        if (!_timelineCollapsed)
          TimelinePanel(
            controller: c,
            isModalSheet: false,
            onOpenDiff: (l, r, {bool openDarlingsTab = false}) => _showGlassModal(
              context,
              DiffViewerModal(
                controller: c,
                leftSnap: l,
                rightSnap: r,
                initialDarlingsTab: openDarlingsTab,
              ),
            ),
            onClose: () => setState(() => _timelineCollapsed = true),
          )
        else
          InkWell(
            onTap: () => setState(() => _timelineCollapsed = false),
            child: Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(vertical: 6),
              decoration: BoxDecoration(
                color: t.bgSurface,
                border: Border(top: BorderSide(color: t.borderSubtle)),
              ),
              child: Center(
                child: Text(
                  c.settings.locale.isZh ? '▲ 展开版本穹顶时间轴' : '▲ Expand Version Dome Timeline',
                  style: TextStyle(fontSize: 11.5, color: t.accent, fontWeight: FontWeight.w600),
                ),
              ),
            ),
          ),
      ],
    );
  }

  Future<void> _handleImportPicked(BuildContext context, AppController c) async {
    final bundle = await c.importFileFromPicker();
    if (bundle != null && context.mounted) {
      await _showGlassModal(context, CoverSplitModal(controller: c));
    }
  }

  void _openSettings(
    BuildContext context,
    AppController c, {
    SettingsTab initialTab = SettingsTab.appearance,
  }) {
    Navigator.of(context).push(
      MaterialPageRoute(
        fullscreenDialog: true,
        builder: (_) => AnimatedBuilder(
          animation: c,
          builder: (ctx, _) => Theme(
            data: c.themeTokens.toMaterialTheme(),
            child: AnnotatedRegion(
              value: c.themeTokens.systemUiOverlayStyle,
              child: SettingsModal(
                controller: c,
                initialTab: initialTab,
                onOpenSync: () => _showGlassModal(context, SyncModal(controller: c)),
              ),
            ),
          ),
        ),
      ),
    );
  }

  void _openTimelineSheet(BuildContext context, AppController c) {
    _showGlassModal(
      context,
      TimelinePanel(
        controller: c,
        isModalSheet: true,
        onOpenDiff: (l, r, {bool openDarlingsTab = false}) {
          Navigator.of(context).pop();
          _showGlassModal(
            context,
            DiffViewerModal(
              controller: c,
              leftSnap: l,
              rightSnap: r,
              initialDarlingsTab: openDarlingsTab,
            ),
          );
        },
        onClose: () => Navigator.of(context).pop(),
      ),
    );
  }

  Future<void> _showGlassModal(BuildContext context, Widget modal) {
    return showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => Padding(
        padding: EdgeInsets.fromLTRB(
          10,
          24,
          10,
          MediaQuery.viewInsetsOf(ctx).bottom + MediaQuery.paddingOf(ctx).bottom + 10,
        ),
        child: modal,
      ),
    );
  }
}

class _TouchResizeSash extends StatelessWidget {
  const _TouchResizeSash({required this.color, required this.onDragDelta});
  final Color color;
  final void Function(double dx) onDragDelta;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onHorizontalDragUpdate: (d) => onDragDelta(d.delta.dx),
      child: SizedBox(
        width: 12,
        child: Center(
          child: Container(width: 1.5, color: color),
        ),
      ),
    );
  }
}
