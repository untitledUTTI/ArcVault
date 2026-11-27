import 'package:flutter/material.dart';

import '../core/device_layout.dart';
import '../core/tutorial_flow.dart';
import '../models/archive_models.dart';
import '../state/app_controller.dart';
import '../theme/arc_theme.dart';
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

enum _InlineModalType {
  trash,
  coverSplit,
  timeline,
  diffDarlings,
  branch,
  phrasebank,
  paperStudio,
  contextAssets,
  evolutionStudio,
  vaultLock,
  sync,
  settingsThemes,
  settingsAi,
}

class WorkspaceShell extends StatefulWidget {
  const WorkspaceShell({super.key, required this.controller});
  final AppController controller;

  @override
  State<WorkspaceShell> createState() => _WorkspaceShellState();
}

class _WorkspaceShellState extends State<WorkspaceShell> with SingleTickerProviderStateMixin {
  final GlobalKey _tourRootKey = GlobalKey();
  final ScrollController _quickFormatScroll = ScrollController();

  bool _drawerOpen = false;
  late final AnimationController _drawerAnim = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 260),
  );
  late final Animation<double> _drawerCurve = CurvedAnimation(
    parent: _drawerAnim,
    curve: Curves.easeOutCubic,
    reverseCurve: Curves.easeInCubic,
  );
  bool _annotationSheetOpen = false;
  bool _timelineCollapsed = false;
  double _leftSidebarWidth = 264;
  double _rightSidebarWidth = 290;
  bool _sharePromptShown = false;

  TutorialSceneId? _activeTutorialScene;
  _InlineModalType? _inlineModal;
  Snapshot? _inlineDiffLeft;
  Snapshot? _inlineDiffRight;
  bool _inlineDiffDarlingsTab = false;

  void _setDrawerOpen(bool open) {
    if (_drawerOpen == open) return;
    setState(() => _drawerOpen = open);
    if (open) {
      _drawerAnim.forward();
    } else {
      _drawerAnim.reverse();
    }
  }

  @override
  void dispose() {
    _drawerAnim.dispose();
    _quickFormatScroll.dispose();
    super.dispose();
  }

  void _openModalAware(BuildContext context, _InlineModalType inlineType, Widget modal) {
    if (widget.controller.tutorialMode != null) {
      setState(() => _inlineModal = inlineType);
      return;
    }
    _showGlassModal(context, modal);
  }

  void _applyTutorialScene(TutorialSceneId scene) {
    if (!mounted) return;
    final c = widget.controller;
    final layout = DeviceLayoutInfo.fromContext(context);

    // Preserve active modal/drawer state across consecutive steps sharing the same scene
    // (e.g., cover-pick-line -> cover-footer-btns, ws-spaces -> ws-trash-btn, ann-open-card -> ann-actions)
    if (_activeTutorialScene == scene) {
      if (scene == TutorialSceneId.coverSplit &&
          _inlineModal == _InlineModalType.coverSplit) {
        return;
      }
      if (scene == TutorialSceneId.workspaceSidebar &&
          (!layout.isCompact || _drawerOpen)) {
        return;
      }
      if (scene == TutorialSceneId.annotations &&
          (!layout.isCompact || _annotationSheetOpen)) {
        return;
      }
      if (scene == TutorialSceneId.timelineDome &&
          (layout.isCompact ? _inlineModal == _InlineModalType.timeline : !_timelineCollapsed)) {
        return;
      }
    }

    void activateThesis() {
      c.ensureDemoSceneDocument('doc_thesis_demo', 'sp_paper');
    }

    setState(() {
      _activeTutorialScene = scene;
      _inlineModal = null;
      _drawerOpen = false;
      _annotationSheetOpen = false;

      switch (scene) {
        case TutorialSceneId.workspaceSidebar:
          activateThesis();
          c.setSplitPreview(false);
          if (layout.isCompact) _drawerOpen = true;
          break;

        case TutorialSceneId.trashModal:
          activateThesis();
          c.setSplitPreview(false);
          _inlineModal = _InlineModalType.trash;
          break;

        case TutorialSceneId.workspaceFormat:
          activateThesis();
          if (c.activeDoc != null) {
            c.setActiveFormatForDoc(c.activeDoc!.id, EditorFormat.markdown);
          }
          c.setSplitPreview(false);
          _scrollQuickBarTo(fraction: 0.48);
          break;

        case TutorialSceneId.coverSplit:
          activateThesis();
          c.setSplitPreview(false);
          if (c.activeDoc?.baseDocxBase64 == null) {
            c.importSamplePaperDocx();
          }
          _inlineModal = _InlineModalType.coverSplit;
          break;

        case TutorialSceneId.annotations:
          activateThesis();
          c.setSplitPreview(false);
          if (layout.isCompact) _annotationSheetOpen = true;
          break;

        case TutorialSceneId.snapshotTopbar:
          activateThesis();
          c.setSplitPreview(false);
          _scrollQuickBarTo(fraction: 1.0);
          break;

        case TutorialSceneId.timelineDome:
          activateThesis();
          if (layout.isCompact) {
            _inlineModal = _InlineModalType.timeline;
          } else {
            _timelineCollapsed = false;
          }
          break;

        case TutorialSceneId.diffDarlings:
          activateThesis();
          final doc = c.activeDoc;
          final snaps = doc != null ? c.snapshotsForDoc(doc.id) : const <Snapshot>[];
          _inlineDiffLeft = snaps.isNotEmpty ? snaps.first : null;
          _inlineDiffRight = snaps.length > 1 ? snaps.last : null;
          _inlineDiffDarlingsTab = true;
          _inlineModal = _InlineModalType.diffDarlings;
          break;

        case TutorialSceneId.branchModal:
          activateThesis();
          _inlineModal = _InlineModalType.branch;
          break;

        case TutorialSceneId.editorAiBar:
          activateThesis();
          c.setSplitPreview(false);
          break;

        case TutorialSceneId.phrasebankCapsule:
          activateThesis();
          c.setSplitPreview(false);
          final pb = c.settings.phrasebank;
          if (!pb.enabled || pb.dismissed) {
            c.updateSettings(c.settings.copyWith(
              phrasebank: pb.copyWith(enabled: true, dismissed: false),
            ));
          }
          _inlineModal = _InlineModalType.phrasebank;
          break;

        case TutorialSceneId.paperStudio:
          activateThesis();
          _inlineModal = _InlineModalType.paperStudio;
          break;

        case TutorialSceneId.contextAssets:
          activateThesis();
          _inlineModal = _InlineModalType.contextAssets;
          break;

        case TutorialSceneId.evolutionStudio:
          activateThesis();
          _inlineModal = _InlineModalType.evolutionStudio;
          break;

        case TutorialSceneId.vaultLock:
          c.ensureDemoSceneDocument('doc_vault_demo', 'sp_vault');
          _inlineModal = _InlineModalType.vaultLock;
          break;

        case TutorialSceneId.syncModal:
          activateThesis();
          _inlineModal = _InlineModalType.sync;
          break;

        case TutorialSceneId.settingsThemes:
          activateThesis();
          _inlineModal = _InlineModalType.settingsThemes;
          break;

        case TutorialSceneId.settingsAi:
          activateThesis();
          _inlineModal = _InlineModalType.settingsAi;
          break;

        case TutorialSceneId.exportTopbar:
          activateThesis();
          break;

        case TutorialSceneId.formatOffice:
          c.ensureDemoSceneDocument('doc_office_demo', 'sp_office');
          c.setSplitPreview(false);
          break;

        case TutorialSceneId.limitationsOverview:
          activateThesis();
          c.setSplitPreview(false);
          break;
      }
    });
    if (_drawerOpen) {
      _drawerAnim.forward();
    } else {
      _drawerAnim.reverse();
    }
  }

  void _scrollQuickBarTo({required double fraction}) {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted || !_quickFormatScroll.hasClients) return;
      final max = _quickFormatScroll.position.maxScrollExtent;
      if (max <= 4) return;
      _quickFormatScroll.animateTo(
        (max * fraction).clamp(0.0, max),
        duration: const Duration(milliseconds: 280),
        curve: Curves.easeOutCubic,
      );
    });
  }

  void _cleanupTutorialScenes() {
    final c = widget.controller;
    setState(() {
      _activeTutorialScene = null;
      _inlineModal = null;
      _drawerOpen = false;
      _annotationSheetOpen = false;
    });
    _drawerAnim.reverse();
    c.ensureDemoSceneDocument('doc_thesis_demo', 'sp_paper');
    c.setSplitPreview(false);
  }

  @override
  Widget build(BuildContext context) {
    final c = widget.controller;
    final t = context.arcTheme;
    final s = c.settings;
    final layout = DeviceLayoutInfo.fromContext(context);
    final doc = c.activeDoc;

    // Auto-open share intake modal if native Android/iOS share payload arrived
    if (c.pendingShareText != null && !_sharePromptShown && c.tutorialMode == null) {
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

    return PopScope(
      canPop: c.tutorialMode == null,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop && c.tutorialMode == TutorialMode.replay) {
          _cleanupTutorialScenes();
          c.closeTutorialReplay();
        }
      },
      child: AnnotatedRegion(
        value: t.systemUiOverlayStyle,
        child: Scaffold(
          backgroundColor: Colors.transparent,
          resizeToAvoidBottomInset: true,
          body: Stack(
            key: _tourRootKey,
            children: [
              // Full-bleed background extending behind Status Bar & Navigation Gesture Bar
              Positioned.fill(child: Container(color: t.bgApp)),

              // Main Workspace Column
              Column(
                children: [
                  TopBar(
                    controller: c,
                    layout: layout,
                    onOpenDrawer: () => _setDrawerOpen(true),
                    onOpenTimelineSheet: () => _openTimelineSheet(context, c),
                    onOpenAnnotationsSheet: () =>
                        setState(() => _annotationSheetOpen = !_annotationSheetOpen),
                    onOpenBranches: () => _openModalAware(
                      context,
                      _InlineModalType.branch,
                      BranchModal(controller: c),
                    ),
                    onOpenPaperStudio: () => _openModalAware(
                      context,
                      _InlineModalType.paperStudio,
                      PaperStudioModal(controller: c),
                    ),
                    onOpenContextAssets: () => _openModalAware(
                      context,
                      _InlineModalType.contextAssets,
                      ContextAssetsModal(controller: c),
                    ),
                    onOpenEvolutionStudio: () => _openModalAware(
                      context,
                      _InlineModalType.evolutionStudio,
                      EvolutionStudioModal(controller: c),
                    ),
                    onOpenCoverSplit: () {
                      if (doc?.baseDocxBase64 != null) {
                        _openModalAware(
                          context,
                          _InlineModalType.coverSplit,
                          CoverSplitModal(controller: c),
                        );
                      }
                    },
                    onOpenSync: () => _openModalAware(
                      context,
                      _InlineModalType.sync,
                      SyncModal(controller: c),
                    ),
                    onOpenSettings: () => _openSettings(context, c),
                    onOpenCameraScan: () => _showGlassModal(context, CameraScanModal(controller: c)),
                    onOpenShareIntake: () => _showGlassModal(context, ShareIntakeModal(controller: c)),
                  ),

                  // Main Content Area
                  Expanded(
                    child: layout.isCompact
                        ? _buildCompactBody(c, layout, t)
                        : _buildTabletLandscapeBody(c, layout, t),
                  ),

                  // Compact Bottom Quick Format Bar (with bottom safe area inset)
                  if (layout.isCompact && doc != null)
                    SafeArea(
                      top: false,
                      child: MobileQuickFormatBar(
                        barKey: c.tourTargets.keyFor(TutorialTargetId.mobileFormatBar),
                        snapshotBtnKey: c.tourTargets.keyFor(TutorialTargetId.mobileSnapshotBtn),
                        scrollController: _quickFormatScroll,
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
                        widthFraction: s.quickBarWidthFraction,
                        onWidthFractionChanged: (v) =>
                            c.updateSettings(s.copyWith(quickBarWidthFraction: v)),
                        onUndo: c.undo,
                        onRedo: c.redo,
                        onInsertSnippet: c.insertSnippet,
                        onToggleFormat: c.toggleActiveFormat,
                        onToggleSplitPreview: () {
                          c.toggleSplitPreview();
                          c.notifyTutorialAction(TutorialActionId.togglePreview);
                        },
                        onOpenAnnotations: () =>
                            setState(() => _annotationSheetOpen = !_annotationSheetOpen),
                        onTogglePhrasebank: () => _openModalAware(
                          context,
                          _InlineModalType.phrasebank,
                          PhrasebankModalSheet(controller: c),
                        ),
                        onOpenCameraScan: () =>
                            _showGlassModal(context, CameraScanModal(controller: c)),
                        onSaveMilestone: () {
                          c.saveMilestoneSnapshot();
                          c.notifyTutorialAction(TutorialActionId.saveSnapshot);
                        },
                        onHaptic: c.triggerHaptic,
                      ),
                    ),
                ],
              ),

              // Draggable Edge-Snapping Phrasebank Capsule
              PhrasebankFloatingCapsule(
                controller: c,
                onOpenModal: () => _openModalAware(
                  context,
                  _InlineModalType.phrasebank,
                  PhrasebankModalSheet(controller: c),
                ),
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

              // Left Drawer Backdrop + Panel (Phone & Tablet Portrait) with slide+fade animation
              if (layout.isCompact)
                AnimatedBuilder(
                  animation: _drawerCurve,
                  builder: (context, child) {
                    final v = _drawerCurve.value;
                    if (v <= 0.001 && !_drawerOpen) return const SizedBox.shrink();
                    final drawerW = (layout.width * 0.82).clamp(260.0, 340.0);
                    return Stack(
                      children: [
                        Positioned.fill(
                          child: IgnorePointer(
                            ignoring: !_drawerOpen,
                            child: GestureDetector(
                              onTap: () => _setDrawerOpen(false),
                              child: Container(
                                color: Colors.black.withValues(alpha: 0.35 * v),
                              ),
                            ),
                          ),
                        ),
                        Positioned(
                          left: 8 - (1.0 - v) * (drawerW + 24),
                          top: 8,
                          bottom: 8,
                          width: drawerW,
                          child: Opacity(
                            opacity: v.clamp(0.0, 1.0),
                            child: child,
                          ),
                        ),
                      ],
                    );
                  },
                  child: SidebarPanel(
                    controller: c,
                    isDrawer: true,
                    onCloseDrawer: () => _setDrawerOpen(false),
                    onImportPicked: () => _handleImportPicked(context, c),
                    onOpenVaultLock: () => _openModalAware(
                      context,
                      _InlineModalType.vaultLock,
                      VaultLockModal(controller: c),
                    ),
                    onOpenTrash: () => _openModalAware(
                      context,
                      _InlineModalType.trash,
                      TrashModal(controller: c),
                    ),
                    onOpenSync: () => _openModalAware(
                      context,
                      _InlineModalType.sync,
                      SyncModal(controller: c),
                    ),
                    onOpenCameraScan: () => _showGlassModal(context, CameraScanModal(controller: c)),
                    onOpenShareIntake: () => _showGlassModal(context, ShareIntakeModal(controller: c)),
                  ),
                ),

              // Inline Modal Layer (stays underneath TutorialOverlay during live tutorial)
              if (_inlineModal != null) _buildInlineModalLayer(c, t),

              // Toast Notification Banner
              if (c.toastMessage != null)
                Positioned(
                  top: layout.topPadding + 58,
                  left: 24,
                  right: 24,
                  child: IgnorePointer(
                    child: Center(
                      child: ArcSurface(
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
                ),

              // First-run / Replay Live In-App Spotlight Tutorial Overlay (TOP-MOST)
              if (c.tutorialMode != null)
                TutorialOverlay(
                  key: ValueKey(c.tutorialMode),
                  controller: c,
                  mode: c.tutorialMode!,
                  rootKey: _tourRootKey,
                  onApplyScene: _applyTutorialScene,
                  onCompleteFirstRun: () async {
                    _cleanupTutorialScenes();
                    await c.completeTutorial();
                    c.showToast(s.locale.isZh
                        ? '欢迎使用 ArcVault · 穹档！可随时在「更多 / 设置」中重播使用教程'
                        : 'Welcome to ArcVault! Replay the tutorial anytime from Menu / Settings.');
                  },
                  onCloseReplay: () {
                    _cleanupTutorialScenes();
                    c.closeTutorialReplay();
                  },
                ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildInlineModalLayer(AppController c, ArcThemeTokens t) {
    final modalType = _inlineModal!;
    void closeInline() {
      if (mounted) setState(() => _inlineModal = null);
    }

    if (modalType == _InlineModalType.settingsThemes ||
        modalType == _InlineModalType.settingsAi) {
      final initialTab = modalType == _InlineModalType.settingsAi
          ? SettingsTab.ai
          : SettingsTab.appearance;
      return Positioned.fill(
        child: Theme(
          data: t.toMaterialTheme(),
          child: SettingsModal(
            controller: c,
            initialTab: initialTab,
            onOpenSync: () => setState(() => _inlineModal = _InlineModalType.sync),
            onClose: closeInline,
          ),
        ),
      );
    }

    late final Widget modalWidget;
    switch (modalType) {
      case _InlineModalType.trash:
        modalWidget = TrashModal(controller: c, onClose: closeInline);
      case _InlineModalType.coverSplit:
        modalWidget = CoverSplitModal(controller: c, onClose: closeInline);
      case _InlineModalType.timeline:
        modalWidget = TimelinePanel(
          controller: c,
          isModalSheet: true,
          onOpenDiff: (l, r, {bool openDarlingsTab = false}) {
            setState(() {
              _inlineDiffLeft = l;
              _inlineDiffRight = r;
              _inlineDiffDarlingsTab = openDarlingsTab;
              _inlineModal = _InlineModalType.diffDarlings;
            });
          },
          onClose: closeInline,
        );
      case _InlineModalType.diffDarlings:
        modalWidget = DiffViewerModal(
          controller: c,
          leftSnap: _inlineDiffLeft,
          rightSnap: _inlineDiffRight,
          initialDarlingsTab: _inlineDiffDarlingsTab,
          onClose: closeInline,
        );
      case _InlineModalType.branch:
        modalWidget = BranchModal(controller: c, onClose: closeInline);
      case _InlineModalType.phrasebank:
        modalWidget = PhrasebankModalSheet(controller: c, onClose: closeInline);
      case _InlineModalType.paperStudio:
        modalWidget = PaperStudioModal(controller: c, onClose: closeInline);
      case _InlineModalType.contextAssets:
        modalWidget = ContextAssetsModal(controller: c, onClose: closeInline);
      case _InlineModalType.evolutionStudio:
        modalWidget = EvolutionStudioModal(controller: c, onClose: closeInline);
      case _InlineModalType.vaultLock:
        modalWidget = VaultLockModal(controller: c, onClose: closeInline);
      case _InlineModalType.sync:
        modalWidget = SyncModal(controller: c, onClose: closeInline);
      case _InlineModalType.settingsThemes:
      case _InlineModalType.settingsAi:
        modalWidget = const SizedBox.shrink();
    }

    return Positioned.fill(
      child: Stack(
        children: [
          GestureDetector(
            onTap: closeInline,
            child: Container(color: Colors.black.withValues(alpha: 0.25)),
          ),
          SafeArea(
            child: Align(
              alignment: modalType == _InlineModalType.timeline
                  ? Alignment.bottomCenter
                  : Alignment.center,
              child: Padding(
                padding: EdgeInsets.fromLTRB(
                  10,
                  12,
                  10,
                  MediaQuery.viewInsetsOf(context).bottom + 10,
                ),
                child: modalWidget,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCompactBody(AppController c, DeviceLayoutInfo layout, ArcThemeTokens t) {
    return EditorWorkspace(
      controller: c,
      isCompact: true,
      onOpenCoverSplit: () => _openModalAware(
        context,
        _InlineModalType.coverSplit,
        CoverSplitModal(controller: c),
      ),
      onOpenSkillsSettings: () => _openSettings(context, c, initialTab: SettingsTab.ai),
      onTogglePhrasebank: () => _openModalAware(
        context,
        _InlineModalType.phrasebank,
        PhrasebankModalSheet(controller: c),
      ),
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
                      onOpenVaultLock: () => _openModalAware(
                        context,
                        _InlineModalType.vaultLock,
                        VaultLockModal(controller: c),
                      ),
                      onOpenTrash: () => _openModalAware(
                        context,
                        _InlineModalType.trash,
                        TrashModal(controller: c),
                      ),
                      onOpenSync: () => _openModalAware(
                        context,
                        _InlineModalType.sync,
                        SyncModal(controller: c),
                      ),
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
                      onOpenCoverSplit: () => _openModalAware(
                        context,
                        _InlineModalType.coverSplit,
                        CoverSplitModal(controller: c),
                      ),
                      onOpenSkillsSettings: () =>
                          _openSettings(context, c, initialTab: SettingsTab.ai),
                      onTogglePhrasebank: () => _openModalAware(
                        context,
                        _InlineModalType.phrasebank,
                        PhrasebankModalSheet(controller: c),
                      ),
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
            onOpenDiff: (l, r, {bool openDarlingsTab = false}) => _openModalAware(
              context,
              _InlineModalType.diffDarlings,
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
    if (c.tutorialMode != null) {
      setState(() {
        _inlineModal = initialTab == SettingsTab.ai
            ? _InlineModalType.settingsAi
            : _InlineModalType.settingsThemes;
      });
      return;
    }

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
    if (c.tutorialMode != null) {
      setState(() => _inlineModal = _InlineModalType.timeline);
      return;
    }
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
