import 'dart:async';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:local_auth/local_auth.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:permission_handler/permission_handler.dart';

import '../../core/device_layout.dart';
import '../../core/tutorial_flow.dart';
import '../../i18n/dictionaries.dart';
import '../../models/archive_models.dart';
import '../../state/app_controller.dart';
import '../../theme/arc_theme.dart';
import '../../theme/liquid_glass_surface.dart';
import '../arc_vault_logo.dart';

class TutorialOverlay extends StatefulWidget {
  const TutorialOverlay({
    super.key,
    required this.controller,
    required this.mode,
    required this.rootKey,
    required this.onApplyScene,
    required this.onCompleteFirstRun,
    required this.onCloseReplay,
  });

  final AppController controller;
  final TutorialMode mode;
  final GlobalKey rootKey;
  final void Function(TutorialSceneId scene) onApplyScene;
  final Future<void> Function() onCompleteFirstRun;
  final VoidCallback onCloseReplay;

  @override
  State<TutorialOverlay> createState() => _TutorialOverlayState();
}

class _TutorialOverlayState extends State<TutorialOverlay> {
  late TutorialPhase _phase = TutorialFlow.getInitialPhase(widget.mode);
  final Set<TutorialModuleId> _selectedReplayModules = TutorialModuleId.values.toSet();
  int _stepIdx = 0;

  // Permissions (Android first-run only)
  final Set<String> _grantedPermissions = {};

  // Cache setup (first-run second-to-last step)
  String? _cacheChoice; // 'default' | 'custom'
  late final TextEditingController _cacheCtrl;
  String? _cacheAppliedPath;
  bool _cacheApplying = false;
  String? _cacheError;

  // Mandatory warning (first-run FINAL step)
  int _remainingSec = TutorialFlow.warningCountdownSeconds;
  Timer? _countdownTimer;
  final TextEditingController _warningConfirmCtrl = TextEditingController();

  // Spotlight measurement & interaction gate
  final GlobalKey _cardKey = GlobalKey();
  SpotlightRect? _cutout;
  Size _cardSize = const Size(340, 220);
  bool _actionGateFallbackUnlocked = false;
  bool _advancing = false;
  bool _isCardTranslucent = false;

  Timer? _fallbackGateTimer;
  Timer? _advanceDelayTimer;
  final List<Timer> _measureTimers = [];
  StreamSubscription<TutorialActionId>? _actionSub;
  String? _lastAppliedStepKey;

  List<TutorialFlowStep> get _steps => TutorialFlow.buildFlow(
        widget.mode,
        selectedModules:
            widget.mode == TutorialMode.replay ? _selectedReplayModules : null,
      );

  TutorialFlowStep get _currentFlowStep {
    final list = _steps;
    return list[_stepIdx.clamp(0, list.length - 1)];
  }

  @override
  void initState() {
    super.initState();
    _cacheCtrl = TextEditingController(text: widget.controller.resolvedVaultDir);
    _actionSub = widget.controller.tourTargets.actions.listen(_handleTutorialAction);
  }

  @override
  void dispose() {
    _countdownTimer?.cancel();
    _fallbackGateTimer?.cancel();
    _advanceDelayTimer?.cancel();
    for (final t in _measureTimers) {
      t.cancel();
    }
    _actionSub?.cancel();
    _cacheCtrl.dispose();
    _warningConfirmCtrl.dispose();
    super.dispose();
  }

  void _syncStepLifecycle() {
    if (_phase != TutorialPhase.player) {
      _countdownTimer?.cancel();
      _fallbackGateTimer?.cancel();
      _lastAppliedStepKey = null;
      return;
    }

    final flowStep = _currentFlowStep;
    final key = flowStep.kind == TutorialFlowStepKind.spotlight
        ? 'spot:${flowStep.step!.id}'
        : flowStep.kind.name;

    if (_lastAppliedStepKey == key) return;
    _lastAppliedStepKey = key;

    _advancing = false;
    _actionGateFallbackUnlocked = false;
    _isCardTranslucent = false;
    _fallbackGateTimer?.cancel();

    // Manage mandatory warning countdown timer
    if (flowStep.kind == TutorialFlowStepKind.warning &&
        widget.mode == TutorialMode.firstRun) {
      _startWarningCountdown();
    } else {
      _countdownTimer?.cancel();
    }

    // Apply real app scene underneath after frame
    final scene = flowStep.kind == TutorialFlowStepKind.spotlight
        ? flowStep.step!.scene
        : TutorialSceneId.limitationsOverview;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      widget.onApplyScene(scene);
      _scheduleMeasurements();
    });

    // Safeguard for action-gated steps: unlock Next after 900ms if target isn't mounted
    if (flowStep.kind == TutorialFlowStepKind.spotlight &&
        flowStep.step!.actionGate != null) {
      final targets = flowStep.step!.targetIds;
      _fallbackGateTimer = Timer(const Duration(milliseconds: 900), () {
        if (!mounted) return;
        final rect = _measureTargets(targets, flowStep.step!.padding);
        if (rect == null && !_actionGateFallbackUnlocked) {
          setState(() => _actionGateFallbackUnlocked = true);
        }
      });
    }
  }

  void _startWarningCountdown() {
    _countdownTimer?.cancel();
    if (_remainingSec <= 0) return;
    _countdownTimer = Timer.periodic(const Duration(seconds: 1), (t) {
      if (!mounted) {
        t.cancel();
        return;
      }
      if (_remainingSec <= 1) {
        t.cancel();
        setState(() => _remainingSec = 0);
      } else {
        setState(() => _remainingSec--);
      }
    });
  }

  void _scheduleMeasurements() {
    for (final t in _measureTimers) {
      t.cancel();
    }
    _measureTimers.clear();
    _measureNow();
    for (final ms in const [70, 200, 380, 620]) {
      _measureTimers.add(Timer(Duration(milliseconds: ms), () {
        if (mounted) _measureNow();
      }));
    }
  }

  void _measureNow() {
    if (_phase != TutorialPhase.player) return;
    final flowStep = _currentFlowStep;
    if (flowStep.kind != TutorialFlowStepKind.spotlight) {
      if (_cutout != null) setState(() => _cutout = null);
      return;
    }

    final step = flowStep.step!;
    final nextCutout = step.targetIds.isEmpty
        ? null
        : _measureTargets(
            step.unionTargetIds.isNotEmpty ? step.unionTargetIds : step.targetIds,
            step.padding,
            unionAll: step.unionTargetIds.isNotEmpty,
          );

    // Measure card size
    final cardCtx = _cardKey.currentContext;
    if (cardCtx != null) {
      final box = cardCtx.findRenderObject() as RenderBox?;
      if (box != null && box.hasSize) {
        final s = box.size;
        if ((s.width - _cardSize.width).abs() > 1.5 ||
            (s.height - _cardSize.height).abs() > 1.5) {
          _cardSize = s;
        }
      }
    }

    final changed = (nextCutout == null && _cutout != null) ||
        (nextCutout != null && _cutout == null) ||
        (nextCutout != null &&
            _cutout != null &&
            !nextCutout.roughlyEquals(_cutout!));

    if (changed && mounted) {
      setState(() => _cutout = nextCutout);
    }
  }

  SpotlightRect? _measureTargets(
    List<TutorialTargetId> ids,
    double pad, {
    bool unionAll = false,
  }) {
    final rootCtx = widget.rootKey.currentContext;
    if (rootCtx == null) return null;
    final rootBox = rootCtx.findRenderObject() as RenderBox?;
    if (rootBox == null || !rootBox.hasSize) return null;

    final rootSize = rootBox.size;
    final rects = <Rect>[];

    for (final id in ids) {
      final ctx = widget.controller.tourTargets.keyFor(id).currentContext;
      if (ctx == null) continue;
      final box = ctx.findRenderObject() as RenderBox?;
      if (box == null || !box.hasSize || !box.attached) continue;
      final size = box.size;
      if (size.width <= 1 || size.height <= 1) continue;
      final topLeft = box.localToGlobal(Offset.zero, ancestor: rootBox);
      final rect = topLeft & size;
      rects.add(rect);
      if (!unionAll) break;
    }

    if (rects.isEmpty) return null;
    var combined = rects.first;
    for (var i = 1; i < rects.length; i++) {
      combined = combined.expandToInclude(rects[i]);
    }

    final left = (combined.left - pad).clamp(0.0, rootSize.width);
    final top = (combined.top - pad).clamp(0.0, rootSize.height);
    final right = (combined.right + pad).clamp(0.0, rootSize.width);
    final bottom = (combined.bottom + pad).clamp(0.0, rootSize.height);
    final w = right - left;
    final h = bottom - top;
    if (w <= 2 || h <= 2) return null;

    return SpotlightRect(
      top: top.roundToDouble(),
      left: left.roundToDouble(),
      width: w.roundToDouble(),
      height: h.roundToDouble(),
    );
  }

  void _handleTutorialAction(TutorialActionId action) {
    if (!mounted || _phase != TutorialPhase.player || _advancing) return;
    final flowStep = _currentFlowStep;
    if (flowStep.kind != TutorialFlowStepKind.spotlight) return;
    final gate = flowStep.step!.actionGate;
    if (gate == null) return;

    final matches =
        action == gate.actionId || gate.fallbackActionIds.contains(action);
    if (!matches) return;

    _advancing = true;
    _advanceDelayTimer?.cancel();
    _advanceDelayTimer = Timer(const Duration(milliseconds: 220), () {
      if (!mounted) return;
      if (_stepIdx + 1 >= _steps.length) {
        if (widget.mode == TutorialMode.replay) {
          widget.controller.triggerHaptic(HapticPattern.success);
          widget.onCloseReplay();
        }
      } else {
        _goToStep(_stepIdx + 1);
      }
    });
  }

  void _goToStep(int nextIdx) {
    widget.controller.triggerHaptic(HapticPattern.selection);
    setState(() {
      _stepIdx = nextIdx.clamp(0, _steps.length - 1);
      _lastAppliedStepKey = null;
    });
  }

  @override
  Widget build(BuildContext context) {
    _syncStepLifecycle();

    final t = context.arcTheme;
    final c = widget.controller;
    final s = c.settings;
    final d = ArcStrings.of(s.locale);
    final mq = MediaQuery.of(context);
    final layout = DeviceLayoutInfo.fromContext(context);

    if (_phase == TutorialPhase.player) {
      final flowStep = _currentFlowStep;
      if (flowStep.kind == TutorialFlowStepKind.cacheSetup) {
        return _buildModalCardOverMask(
          c,
          t,
          _buildCacheSetup(c, t),
          blockOutside: true,
        );
      }
      if (flowStep.kind == TutorialFlowStepKind.warning) {
        return _buildModalCardOverMask(
          c,
          t,
          _buildWarning(c, t),
          blockOutside: true,
        );
      }
      return _buildSpotlightPlayer(c, t, mq, layout, flowStep);
    }

    if (_phase == TutorialPhase.welcome) {
      return _buildFullScreenCard(c, s, t, _buildWelcome(c, s, d, t));
    }

    if (_phase == TutorialPhase.permissions) {
      return _buildModalCardOverMask(
        c,
        t,
        _buildPermissions(c, t),
        blockOutside: true,
      );
    }

    // Replay picker
    return _buildModalCardOverMask(
      c,
      t,
      _buildReplayPicker(c, t),
      blockOutside: false,
      onBackdropTap: widget.onCloseReplay,
    );
  }

  Widget _buildFullScreenCard(
    AppController c,
    AppSettingsModel s,
    ArcThemeTokens t,
    Widget child,
  ) {
    return Positioned.fill(
      child: Material(
        color: Colors.transparent,
        child: Stack(
          children: [
            if (t.isLiquidGlass)
              Positioned.fill(child: ArcLiquidGlassBackdrop(settings: s.liquidGlass))
            else
              Positioned.fill(child: Container(color: t.bgApp)),
            SafeArea(
              child: Center(
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 640),
                  child: SingleChildScrollView(
                    padding: const EdgeInsets.all(16),
                    child: ArcLiquidGlassSurface(
                      liquidGlassSettings: s.liquidGlass,
                      borderRadius: 24,
                      padding: const EdgeInsets.all(20),
                      child: child,
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildModalCardOverMask(
    AppController c,
    ArcThemeTokens t,
    Widget child, {
    required bool blockOutside,
    VoidCallback? onBackdropTap,
  }) {
    return Positioned.fill(
      child: Material(
        color: Colors.transparent,
        child: Stack(
          children: [
            Positioned.fill(
              child: GestureDetector(
                behavior: HitTestBehavior.opaque,
                onTap: blockOutside ? () {} : onBackdropTap,
                child: Container(color: Colors.black.withValues(alpha: 0.64)),
              ),
            ),
            SafeArea(
              child: Center(
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 620),
                  child: SingleChildScrollView(
                    padding: EdgeInsets.fromLTRB(
                      14,
                      14,
                      14,
                      MediaQuery.viewInsetsOf(context).bottom + 14,
                    ),
                    child: ArcLiquidGlassSurface(
                      liquidGlassSettings: c.settings.liquidGlass,
                      borderRadius: 24,
                      padding: const EdgeInsets.all(18),
                      child: child,
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildWelcome(
    AppController c,
    AppSettingsModel s,
    ArcStrings d,
    ArcThemeTokens t,
  ) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            ArcVaultLogo(size: 38, themeId: s.theme),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(d.welcomeBadge,
                      style: TextStyle(
                          fontSize: 11,
                          color: t.accent,
                          fontWeight: FontWeight.w700)),
                  Text(d.welcomeTitle,
                      style: TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.w800,
                          color: t.textPrimary)),
                ],
              ),
            ),
            IconButton(
              onPressed: c.toggleLocale,
              icon: Icon(LucideIcons.languages, size: 18, color: t.textPrimary),
              tooltip: d.switchLanguage,
            ),
          ],
        ),
        const SizedBox(height: 6),
        Text(d.welcomeSubtitle,
            style: TextStyle(fontSize: 13, color: t.textSecondary)),
        const SizedBox(height: 14),
        Text(d.welcomeHintTouch,
            style: TextStyle(fontSize: 12, color: t.textMuted)),
        const SizedBox(height: 8),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: TutorialFlow.mobileWelcomeThemes.map((id) {
            final active = s.theme == id;
            return InkWell(
              onTap: () {
                c.triggerHaptic(HapticPattern.selection);
                c.updateSettings(s.copyWith(theme: id));
              },
              borderRadius: BorderRadius.circular(12),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
                decoration: BoxDecoration(
                  color: active
                      ? t.accentSoft
                      : t.bgSubtle.withValues(alpha: 0.55),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: active ? t.accent : t.borderSubtle),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    if (id == MobileThemeId.liquidGlass) ...[
                      LiquidGlassThemePreviewSwatch(
                          width: 24, height: 18, isDark: s.liquidGlass.isDark),
                      const SizedBox(width: 6),
                    ],
                    Text(
                      d.themeName(id),
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: active ? FontWeight.w700 : FontWeight.w500,
                        color: active ? t.accent : t.textPrimary,
                      ),
                    ),
                  ],
                ),
              ),
            );
          }).toList(),
        ),
        const SizedBox(height: 16),
        ...d.welcomeHighlights.map((h) => Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: ArcFrostedCardSurface(
                padding: const EdgeInsets.all(10),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(h.title,
                        style: TextStyle(
                            fontWeight: FontWeight.w700,
                            fontSize: 13,
                            color: t.textPrimary)),
                    const SizedBox(height: 2),
                    Text(h.desc,
                        style: TextStyle(
                            fontSize: 11.5, color: t.textSecondary)),
                  ],
                ),
              ),
            )),
        const SizedBox(height: 8),
        Text(d.tutorialHint,
            style: TextStyle(fontSize: 12, color: t.textMuted)),
        const SizedBox(height: 14),
        SizedBox(
          width: double.infinity,
          child: FilledButton.icon(
            onPressed: c.isReady
                ? () {
                    c.triggerHaptic(HapticPattern.medium);
                    setState(() {
                      if (TutorialFlow.shouldShowMobilePermissionsStep(
                        mode: widget.mode,
                        isAndroid: Platform.isAndroid,
                      )) {
                        _phase = TutorialPhase.permissions;
                      } else {
                        _stepIdx = 0;
                        _lastAppliedStepKey = null;
                        _phase = TutorialPhase.player;
                      }
                    });
                  }
                : null,
            icon: const Icon(LucideIcons.arrowRight, size: 16),
            label: Text(c.isReady ? d.enterTutorialBtn : d.preparingBtn),
            style: FilledButton.styleFrom(
              backgroundColor: t.accent,
              foregroundColor: t.accentText,
              padding: const EdgeInsets.symmetric(vertical: 14),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildPermissions(AppController c, ArcThemeTokens t) {
    final allGranted =
        TutorialFlow.areAllPermissionsGranted(_grantedPermissions);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Row(
          children: [
            Icon(LucideIcons.shield, size: 18, color: t.accent),
            const SizedBox(width: 8),
            Expanded(
              child: Text('应用权限申请',
                  style: TextStyle(
                      fontSize: 17,
                      fontWeight: FontWeight.w800,
                      color: t.textPrimary)),
            ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(
                color: t.accentSoft,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Text(
                '已授权 ${_grantedPermissions.length} / ${TutorialFlow.mobilePermissionCards.length}',
                style: TextStyle(
                    fontSize: 11, fontWeight: FontWeight.w700, color: t.accent),
              ),
            ),
          ],
        ),
        const SizedBox(height: 6),
        Text('为确保本地文档缓存、纸质稿扫码与局域网同步等功能正常使用，请点击下方卡片逐项跳转授权：',
            style: TextStyle(fontSize: 12.5, color: t.textSecondary)),
        const SizedBox(height: 12),
        ...TutorialFlow.mobilePermissionCards.map((card) {
          final granted = _grantedPermissions.contains(card.id);
          return Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: InkWell(
              onTap: granted ? null : () => _requestPermission(card),
              borderRadius: BorderRadius.circular(12),
              child: ArcFrostedCardSurface(
                isActive: granted,
                padding: const EdgeInsets.all(11),
                child: Row(
                  children: [
                    Icon(
                      granted ? LucideIcons.checkCircle2 : _permIcon(card.id),
                      size: 19,
                      color: granted ? Colors.green : t.accent,
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Flexible(
                                child: Text(card.title,
                                    style: TextStyle(
                                        fontWeight: FontWeight.w700,
                                        fontSize: 13,
                                        color: t.textPrimary)),
                              ),
                              if (card.required)
                                Padding(
                                  padding: const EdgeInsets.only(left: 6),
                                  child: Text('建议必开',
                                      style: TextStyle(
                                          fontSize: 10.5,
                                          color: t.revisionColor)),
                                ),
                            ],
                          ),
                          const SizedBox(height: 2),
                          Text(card.description,
                              style: TextStyle(
                                  fontSize: 11.5, color: t.textSecondary)),
                        ],
                      ),
                    ),
                    const SizedBox(width: 8),
                    OutlinedButton(
                      onPressed: granted ? null : () => _requestPermission(card),
                      style: OutlinedButton.styleFrom(
                          visualDensity: VisualDensity.compact),
                      child: Text(granted ? '已授权' : card.actionLabel,
                          style: const TextStyle(fontSize: 11.5)),
                    ),
                  ],
                ),
              ),
            ),
          );
        }),
        const SizedBox(height: 10),
        Row(
          children: [
            OutlinedButton.icon(
              onPressed: () {
                c.triggerHaptic(HapticPattern.selection);
                setState(() => _phase = TutorialPhase.welcome);
              },
              icon: const Icon(LucideIcons.chevronLeft, size: 15),
              label: const Text('返回'),
            ),
            const Spacer(),
            FilledButton.icon(
              onPressed: () async {
                if (allGranted) {
                  c.triggerHaptic(HapticPattern.medium);
                  setState(() {
                    _stepIdx = 0;
                    _lastAppliedStepKey = null;
                    _phase = TutorialPhase.player;
                  });
                } else {
                  c.triggerHaptic(HapticPattern.warning);
                  final proceed = await showDialog<bool>(
                    context: context,
                    builder: (ctx) => AlertDialog(
                      title: const Text('权限未全部授权'),
                      content: const Text(
                          '当前仍有部分权限未开启，忽略后可能导致本地文件存储、相机扫描或局域网同步等对应功能暂时不可用（后续仍可在系统设置中开启）。确认直接进入教程吗？'),
                      actions: [
                        TextButton(
                            onPressed: () => Navigator.pop(ctx, false),
                            child: const Text('取消')),
                        FilledButton(
                            onPressed: () => Navigator.pop(ctx, true),
                            child: const Text('确认进入')),
                      ],
                    ),
                  );
                  if (proceed == true && mounted) {
                    setState(() {
                      _stepIdx = 0;
                      _lastAppliedStepKey = null;
                      _phase = TutorialPhase.player;
                    });
                  }
                }
              },
              icon: const Icon(LucideIcons.arrowRight, size: 15),
              label: Text(allGranted ? '开始教程' : '忽略'),
              style: FilledButton.styleFrom(
                  backgroundColor: t.accent, foregroundColor: t.accentText),
            ),
          ],
        ),
      ],
    );
  }

  IconData _permIcon(String id) {
    switch (id) {
      case 'storage':
        return LucideIcons.hardDrive;
      case 'camera':
        return LucideIcons.camera;
      case 'local-network':
        return LucideIcons.wifi;
      case 'biometric':
        return LucideIcons.fingerprint;
      default:
        return LucideIcons.shield;
    }
  }

  Future<void> _requestPermission(MobilePermissionCardDef card) async {
    try {
      if (card.id == 'camera') {
        await Permission.camera.request();
      } else if (card.id == 'storage') {
        await Permission.storage.request();
      } else if (card.id == 'local-network') {
        await Permission.nearbyWifiDevices.request();
      } else if (card.id == 'biometric') {
        final auth = LocalAuthentication();
        await auth.canCheckBiometrics;
      }
    } catch (_) {}
    if (mounted) {
      widget.controller.triggerHaptic(HapticPattern.success);
      setState(() => _grantedPermissions.add(card.id));
    }
  }

  Widget _buildReplayPicker(AppController c, ArcThemeTokens t) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Row(
          children: [
            Icon(LucideIcons.bookOpen, size: 18, color: t.accent),
            const SizedBox(width: 8),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('互动使用教程 · 实景交互重播',
                      style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w800,
                          color: t.textPrimary)),
                  Text('勾选想重温的板块，将直接在真实界面上高亮引导（无末尾警告）',
                      style: TextStyle(fontSize: 11.5, color: t.textMuted)),
                ],
              ),
            ),
            IconButton(
              onPressed: widget.onCloseReplay,
              icon: Icon(LucideIcons.x, size: 18, color: t.textSecondary),
            ),
          ],
        ),
        const SizedBox(height: 10),
        Row(
          children: [
            Text(
              '已选 ${_selectedReplayModules.length} / ${TutorialModuleId.values.length} 个板块',
              style: TextStyle(fontSize: 12, color: t.textSecondary),
            ),
            const Spacer(),
            TextButton(
              onPressed: () => setState(
                  () => _selectedReplayModules.addAll(TutorialModuleId.values)),
              child: const Text('全选', style: TextStyle(fontSize: 12)),
            ),
            TextButton(
              onPressed: () => setState(() => _selectedReplayModules.clear()),
              child: const Text('清空', style: TextStyle(fontSize: 12)),
            ),
          ],
        ),
        const SizedBox(height: 4),
        ...TutorialFlow.modules.asMap().entries.map((entry) {
          final idx = entry.key;
          final mod = entry.value;
          final checked = _selectedReplayModules.contains(mod.id);
          return Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: InkWell(
              onTap: () {
                c.triggerHaptic(HapticPattern.selection);
                setState(() {
                  if (checked) {
                    _selectedReplayModules.remove(mod.id);
                  } else {
                    _selectedReplayModules.add(mod.id);
                  }
                });
              },
              borderRadius: BorderRadius.circular(12),
              child: ArcFrostedCardSurface(
                isActive: checked,
                padding: const EdgeInsets.all(10),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Checkbox(
                          value: checked,
                          visualDensity: VisualDensity.compact,
                          onChanged: (v) {
                            setState(() {
                              if (v == true) {
                                _selectedReplayModules.add(mod.id);
                              } else {
                                _selectedReplayModules.remove(mod.id);
                              }
                            });
                          },
                        ),
                        Expanded(
                          child: Text(
                            '${idx + 1}. ${mod.id.title}',
                            style: TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w700,
                                color: t.textPrimary),
                          ),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 7, vertical: 2),
                          decoration: BoxDecoration(
                            color: t.accentSoft,
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Text(mod.id.badge,
                              style: TextStyle(
                                  fontSize: 10.5,
                                  fontWeight: FontWeight.w600,
                                  color: t.accent)),
                        ),
                      ],
                    ),
                    Padding(
                      padding: const EdgeInsets.only(left: 8),
                      child: Text(mod.summary,
                          style: TextStyle(
                              fontSize: 11.5, color: t.textSecondary)),
                    ),
                    const SizedBox(height: 6),
                    Align(
                      alignment: Alignment.centerLeft,
                      child: OutlinedButton.icon(
                        onPressed: () {
                          c.triggerHaptic(HapticPattern.medium);
                          setState(() {
                            _selectedReplayModules
                              ..clear()
                              ..add(mod.id);
                            _stepIdx = 0;
                            _lastAppliedStepKey = null;
                            _phase = TutorialPhase.player;
                          });
                        },
                        icon: const Icon(LucideIcons.play, size: 12),
                        label: Text('单看本节 (${mod.steps.length} 步)',
                            style: const TextStyle(fontSize: 11.5)),
                        style: OutlinedButton.styleFrom(
                            visualDensity: VisualDensity.compact),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          );
        }),
        const SizedBox(height: 8),
        Row(
          mainAxisAlignment: MainAxisAlignment.end,
          children: [
            OutlinedButton(
              onPressed: widget.onCloseReplay,
              child: const Text('关闭'),
            ),
            const SizedBox(width: 8),
            FilledButton.icon(
              onPressed: _selectedReplayModules.isEmpty
                  ? null
                  : () {
                      c.triggerHaptic(HapticPattern.medium);
                      setState(() {
                        _stepIdx = 0;
                        _lastAppliedStepKey = null;
                        _phase = TutorialPhase.player;
                      });
                    },
              icon: const Icon(LucideIcons.play, size: 14),
              label: Text('开始实景体验 (${_selectedReplayModules.length})'),
              style: FilledButton.styleFrom(
                  backgroundColor: t.accent, foregroundColor: t.accentText),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildCacheSetup(AppController c, ArcThemeTokens t) {
    final steps = _steps;
    final canProceed = TutorialFlow.canProceedFromCacheSetup(
      choice: _cacheChoice,
      customPath: _cacheAppliedPath ?? _cacheCtrl.text,
    ) && (_cacheChoice == 'default' || _cacheAppliedPath != null);

    Future<void> applyCustom(String rawPath) async {
      final target = rawPath.trim();
      if (target.isEmpty) {
        setState(() => _cacheError = '请先选择或输入有效的自定义缓存目录路径');
        return;
      }
      setState(() {
        _cacheError = null;
        _cacheApplying = true;
      });
      try {
        await c.setCustomDirectories(vaultDir: target);
        if (mounted) {
          c.triggerHaptic(HapticPattern.success);
          setState(() {
            _cacheCtrl.text = target;
            _cacheAppliedPath = target;
            _cacheChoice = 'custom';
          });
        }
      } catch (e) {
        if (mounted) {
          c.triggerHaptic(HapticPattern.error);
          setState(() => _cacheError = e.toString());
        }
      } finally {
        if (mounted) setState(() => _cacheApplying = false);
      }
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Row(
          children: [
            Icon(LucideIcons.folderOpen, size: 18, color: t.accent),
            const SizedBox(width: 8),
            Expanded(
              child: Text('设置缓存与自动备份目录（首次启动必选）',
                  style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w800,
                      color: t.textPrimary)),
            ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(
                  color: t.accentSoft, borderRadius: BorderRadius.circular(8)),
              child: Text('第 ${_stepIdx + 1} / ${steps.length} 步',
                  style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      color: t.accent)),
            ),
          ],
        ),
        const SizedBox(height: 10),
        ArcFrostedCardSurface(
          padding: const EdgeInsets.all(12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('建议确认档案缓存目录，保障 CAS 去重快照与自动备份安全',
                  style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                      color: t.textPrimary)),
              const SizedBox(height: 4),
              Text(
                '后续你仍可在「设置 → 目录与归档」中随时查看路径或迁移自定义目录。',
                style: TextStyle(fontSize: 12, color: t.textSecondary),
              ),
              const SizedBox(height: 8),
              Text('当前缓存目录：${c.resolvedVaultDir}',
                  style: TextStyle(fontSize: 11.5, color: t.textMuted)),
              Text('自动备份目录：${c.resolvedBackupDir}',
                  style: TextStyle(fontSize: 11.5, color: t.textMuted)),
            ],
          ),
        ),
        const SizedBox(height: 12),
        ArcFrostedCardSurface(
          isActive: _cacheChoice == 'custom',
          padding: const EdgeInsets.all(12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text('方式一：指定自定义缓存目录（推荐）',
                        style: TextStyle(
                            fontWeight: FontWeight.w700,
                            fontSize: 13,
                            color: t.textPrimary)),
                  ),
                  FilledButton.icon(
                    onPressed: _cacheApplying
                        ? null
                        : () async {
                            c.triggerHaptic(HapticPattern.light);
                            await c.pickCustomDirectory(forBackup: false);
                            if (mounted) {
                              setState(() {
                                _cacheCtrl.text = c.resolvedVaultDir;
                                _cacheAppliedPath = c.resolvedVaultDir;
                                _cacheChoice = 'custom';
                                _cacheError = null;
                              });
                            }
                          },
                    icon: const Icon(LucideIcons.folderOpen, size: 13),
                    label: const Text('选择目录', style: TextStyle(fontSize: 12)),
                    style: FilledButton.styleFrom(
                        backgroundColor: t.accent,
                        foregroundColor: t.accentText,
                        visualDensity: VisualDensity.compact),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _cacheCtrl,
                      onChanged: (_) => setState(() => _cacheError = null),
                      style: TextStyle(fontSize: 12.5, color: t.textPrimary),
                      decoration: InputDecoration(
                        isDense: true,
                        border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(10)),
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  OutlinedButton(
                    onPressed: _cacheApplying || _cacheCtrl.text.trim().isEmpty
                        ? null
                        : () => applyCustom(_cacheCtrl.text),
                    child: Text(_cacheApplying ? '应用中…' : '应用',
                        style: const TextStyle(fontSize: 12)),
                  ),
                ],
              ),
              if (_cacheAppliedPath != null && _cacheChoice == 'custom') ...[
                const SizedBox(height: 6),
                Text('已设定自定义目录：$_cacheAppliedPath',
                    style: const TextStyle(
                        fontSize: 11.5,
                        color: Colors.green,
                        fontWeight: FontWeight.w600)),
              ],
              if (_cacheError != null) ...[
                const SizedBox(height: 6),
                Text(_cacheError!,
                    style: TextStyle(fontSize: 11.5, color: t.revisionColor)),
              ],
            ],
          ),
        ),
        const SizedBox(height: 8),
        InkWell(
          onTap: () {
            c.triggerHaptic(HapticPattern.selection);
            setState(() {
              _cacheError = null;
              _cacheChoice = 'default';
            });
          },
          borderRadius: BorderRadius.circular(12),
          child: ArcFrostedCardSurface(
            isActive: _cacheChoice == 'default',
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
            child: Row(
              children: [
                Expanded(
                  child: Text('方式二：暂用当前默认安全目录（后续可随时迁移）',
                      style: TextStyle(
                          fontWeight: FontWeight.w600,
                          fontSize: 12.5,
                          color: t.textPrimary)),
                ),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: _cacheChoice == 'default' ? t.accent : t.accentSoft,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    _cacheChoice == 'default' ? '已选择' : '点击确认',
                    style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        color:
                            _cacheChoice == 'default' ? t.accentText : t.accent),
                  ),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 14),
        Row(
          children: [
            OutlinedButton.icon(
              onPressed: _stepIdx > 0 ? () => _goToStep(_stepIdx - 1) : null,
              icon: const Icon(LucideIcons.chevronLeft, size: 15),
              label: const Text('上一步'),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: FilledButton.icon(
                onPressed: canProceed ? () => _goToStep(_stepIdx + 1) : null,
                icon: const Icon(LucideIcons.chevronRight, size: 15),
                label: Text(
                  canProceed ? '下一步：进入必读警告' : '请先选择或确认缓存目录',
                  overflow: TextOverflow.ellipsis,
                ),
                style: FilledButton.styleFrom(
                    backgroundColor: t.accent, foregroundColor: t.accentText),
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildWarning(AppController c, ArcThemeTokens t) {
    final steps = _steps;
    final inputUnlocked = TutorialFlow.canUnlockWarningInput(_remainingSec);
    final canProceed = TutorialFlow.canConfirmWarning(
      remainingSeconds: _remainingSec,
      input: _warningConfirmCtrl.text,
    );
    final progress = (TutorialFlow.warningCountdownSeconds - _remainingSec) /
        TutorialFlow.warningCountdownSeconds;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Row(
          children: [
            Icon(LucideIcons.shieldAlert, size: 20, color: t.revisionColor),
            const SizedBox(width: 8),
            Expanded(
              child: Text('进入前必读警告（首次启动不可跳过）',
                  style: TextStyle(
                      fontSize: 15.5,
                      fontWeight: FontWeight.w800,
                      color: t.revisionColor)),
            ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(
                  color: t.accentSoft, borderRadius: BorderRadius.circular(8)),
              child: Text('第 ${_stepIdx + 1} / ${steps.length} 步',
                  style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      color: t.accent)),
            ),
          ],
        ),
        const SizedBox(height: 12),
        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: t.revisionColor.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: t.revisionColor.withValues(alpha: 0.38)),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(LucideIcons.alertTriangle,
                  size: 18, color: Colors.amber.shade700),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  TutorialFlow.warningText,
                  style: TextStyle(
                      fontSize: 13.5,
                      height: 1.6,
                      color: t.textPrimary,
                      fontWeight: FontWeight.w600),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              inputUnlocked
                  ? '阅读计时已完成，请在下方输入确认词进入软件'
                  : '请认真阅读上述警告（$_remainingSec 秒后解锁输入框）',
              style: TextStyle(fontSize: 12, color: t.textSecondary),
            ),
            Text(
              inputUnlocked ? '已解锁' : '${_remainingSec}s',
              style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  color: inputUnlocked ? Colors.green : t.revisionColor),
            ),
          ],
        ),
        const SizedBox(height: 6),
        ClipRRect(
          borderRadius: BorderRadius.circular(4),
          child: LinearProgressIndicator(
            value: progress.clamp(0.0, 1.0),
            minHeight: 6,
            backgroundColor: t.borderSubtle,
            valueColor: AlwaysStoppedAnimation<Color>(
                inputUnlocked ? Colors.green : t.accent),
          ),
        ),
        const SizedBox(height: 12),
        Text(
          '请输入「${TutorialFlow.confirmPhrase}」以确认你已阅读并理解上述全部警告：',
          style: TextStyle(
              fontSize: 12.5,
              color: t.textPrimary,
              fontWeight: FontWeight.w600),
        ),
        const SizedBox(height: 8),
        TextField(
          controller: _warningConfirmCtrl,
          enabled: inputUnlocked,
          onChanged: (_) => setState(() {}),
          onSubmitted: (_) async {
            if (canProceed) {
              c.triggerHaptic(HapticPattern.success);
              await widget.onCompleteFirstRun();
            }
          },
          decoration: InputDecoration(
            hintText: inputUnlocked
                ? '请输入 ${TutorialFlow.confirmPhrase}'
                : '请等待倒计时结束 (${_remainingSec}s)...',
            border:
                OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
          ),
        ),
        const SizedBox(height: 14),
        Row(
          children: [
            OutlinedButton.icon(
              onPressed: _stepIdx > 0 ? () => _goToStep(_stepIdx - 1) : null,
              icon: const Icon(LucideIcons.chevronLeft, size: 15),
              label: const Text('上一步'),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: FilledButton.icon(
                onPressed: canProceed
                    ? () async {
                        c.triggerHaptic(HapticPattern.success);
                        await widget.onCompleteFirstRun();
                      }
                    : null,
                icon: const Icon(LucideIcons.checkCircle2, size: 15),
                label: Text(_remainingSec > 0
                    ? '请等待 $_remainingSec 秒...'
                    : '进入 ArcVault · 穹档'),
                style: FilledButton.styleFrom(
                    backgroundColor: t.accent, foregroundColor: t.accentText),
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildSpotlightPlayer(
    AppController c,
    ArcThemeTokens t,
    MediaQueryData mq,
    DeviceLayoutInfo layout,
    TutorialFlowStep flowStep,
  ) {
    final steps = _steps;
    final mod = flowStep.module!;
    final step = flowStep.step!;
    final relation = TutorialFlow.getStepAdvanceRelation(steps, _stepIdx);
    final isReplay = widget.mode == TutorialMode.replay;
    final isLastReplayStep = isReplay && _stepIdx >= steps.length - 1;
    final isActionGated =
        step.actionGate != null && !_actionGateFallbackUnlocked;

    final containerW = mq.size.width;
    final containerH = mq.size.height;
    final cardWidth =
        layout.isCompact ? (containerW - 20).clamp(240.0, 420.0) : 390.0;

    final cardPos = TutorialFlow.computeGuideCardPlacement(
      containerWidth: containerW,
      containerHeight: containerH,
      cutout: _cutout,
      cardWidth: cardWidth,
      cardHeight: _cardSize.height,
      preferredPlacement: step.preferredPlacement,
      forcePlacementBottom: layout.isCompact && step.phoneForceBottom,
      margin: layout.isCompact ? 10 : 14,
      gap: 12,
      topInset: mq.padding.top,
      bottomInset: mq.padding.bottom,
    );

    final nextBtnLabel = isActionGated
        ? TutorialFlow.formatActionGateButtonText(
            step.actionGate!.buttonLabel,
            relation,
          )
        : isLastReplayStep
            ? '完成重播'
            : switch (relation) {
                TutorialAdvanceRelation.cacheSetup => '设置缓存目录',
                TutorialAdvanceRelation.warning => '查看必读警告',
                TutorialAdvanceRelation.nextModule => '进入下一板块',
                TutorialAdvanceRelation.finish => '完成教程',
                TutorialAdvanceRelation.nextStep => '下一步',
              };

    final maskColor = Colors.black.withValues(alpha: 0.62);
    final cRect = _cutout;

    Widget maskPane({
      double? top,
      double? left,
      double? right,
      double? bottom,
      double? width,
      double? height,
    }) {
      return Positioned(
        top: top,
        left: left,
        right: right,
        bottom: bottom,
        width: width,
        height: height,
        child: GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTap: () {},
          onPanDown: (_) {},
          child: Container(color: maskColor),
        ),
      );
    }

    return Positioned.fill(
      child: Material(
        type: MaterialType.transparency,
        child: Stack(
          children: [
            // 4-pane semi-transparent black mask around the highlighted cutout
            if (cRect != null) ...[
              if (cRect.top > 0)
                maskPane(top: 0, left: 0, right: 0, height: cRect.top),
              if (cRect.bottom < containerH)
                maskPane(top: cRect.bottom, left: 0, right: 0, bottom: 0),
              if (cRect.left > 0)
                maskPane(
                  top: cRect.top,
                  left: 0,
                  width: cRect.left,
                  height: cRect.height,
                ),
              if (cRect.right < containerW)
                maskPane(
                  top: cRect.top,
                  left: cRect.right,
                  right: 0,
                  height: cRect.height,
                ),
              // Glowing highlight ring around interactive cutout (non-blocking)
              Positioned(
                top: cRect.top,
                left: cRect.left,
                width: cRect.width,
                height: cRect.height,
                child: IgnorePointer(
                  child: Container(
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: t.accent, width: 2.2),
                      boxShadow: [
                        BoxShadow(
                          color: t.accent.withValues(alpha: 0.42),
                          blurRadius: 14,
                          spreadRadius: 1,
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ] else
              maskPane(top: 0, left: 0, right: 0, bottom: 0),

            // Floating Guide Card above the dark mask
            Positioned(
              top: cardPos.top,
              left: cardPos.left,
              width: cardWidth,
              child: AnimatedOpacity(
                opacity: _isCardTranslucent ? 0.25 : 1.0,
                duration: const Duration(milliseconds: 180),
                child: Container(
                  key: _cardKey,
                  constraints: cardPos.maxHeight != null
                      ? BoxConstraints(maxHeight: cardPos.maxHeight!)
                      : BoxConstraints(
                          maxHeight: (containerH -
                                  mq.padding.top -
                                  mq.padding.bottom -
                                  24)
                              .clamp(200.0, 520.0),
                        ),
                  child: ArcLiquidGlassSurface(
                    liquidGlassSettings: c.settings.liquidGlass,
                    borderRadius: 20,
                    padding: const EdgeInsets.all(14),
                    fallbackColor: t.bgElevated,
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Card Header
                        Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 8, vertical: 3),
                              decoration: BoxDecoration(
                                color: t.accentSoft,
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: Text(
                                '${mod.id.shortTitle} · ${flowStep.stepIndexInModule + 1}/${flowStep.moduleStepCount}',
                                style: TextStyle(
                                    fontSize: 11,
                                    fontWeight: FontWeight.w700,
                                    color: t.accent),
                              ),
                            ),
                            const SizedBox(width: 6),
                            Text(
                              '总第 ${_stepIdx + 1}/${steps.length} 步',
                              style:
                                  TextStyle(fontSize: 11, color: t.textMuted),
                            ),
                            const Spacer(),
                            if (layout.isCompact)
                              InkWell(
                                onTap: () {
                                  c.triggerHaptic(HapticPattern.selection);
                                  setState(() =>
                                      _isCardTranslucent = !_isCardTranslucent);
                                },
                                borderRadius: BorderRadius.circular(8),
                                child: Container(
                                  padding: const EdgeInsets.symmetric(
                                      horizontal: 7, vertical: 4),
                                  decoration: BoxDecoration(
                                    color: _isCardTranslucent
                                        ? t.accentSoft
                                        : t.bgSubtle.withValues(alpha: 0.7),
                                    borderRadius: BorderRadius.circular(8),
                                    border: Border.all(
                                        color: _isCardTranslucent
                                            ? t.accent
                                            : t.borderSubtle),
                                  ),
                                  child: Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      Icon(
                                        _isCardTranslucent
                                            ? LucideIcons.eye
                                            : LucideIcons.eyeOff,
                                        size: 12,
                                        color: _isCardTranslucent
                                            ? t.accent
                                            : t.textSecondary,
                                      ),
                                      const SizedBox(width: 3),
                                      Text(
                                        _isCardTranslucent ? '恢复' : '半透明',
                                        style: TextStyle(
                                          fontSize: 10.5,
                                          fontWeight: FontWeight.w600,
                                          color: _isCardTranslucent
                                              ? t.accent
                                              : t.textSecondary,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            if (isReplay) ...[
                              const SizedBox(width: 4),
                              InkWell(
                                onTap: () {
                                  c.triggerHaptic(HapticPattern.selection);
                                  setState(() => _phase = TutorialPhase.picker);
                                },
                                borderRadius: BorderRadius.circular(8),
                                child: Padding(
                                  padding: const EdgeInsets.symmetric(
                                      horizontal: 6, vertical: 4),
                                  child: Text('重选',
                                      style: TextStyle(
                                          fontSize: 11,
                                          fontWeight: FontWeight.w600,
                                          color: t.accent)),
                                ),
                              ),
                              InkWell(
                                onTap: widget.onCloseReplay,
                                borderRadius: BorderRadius.circular(8),
                                child: Padding(
                                  padding: const EdgeInsets.all(4),
                                  child: Icon(LucideIcons.x,
                                      size: 15, color: t.textSecondary),
                                ),
                              ),
                            ],
                          ],
                        ),
                        const SizedBox(height: 8),

                        // Scrollable Body
                        Flexible(
                          child: SingleChildScrollView(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Row(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Padding(
                                      padding: const EdgeInsets.only(top: 2),
                                      child: Icon(LucideIcons.sparkles,
                                          size: 15, color: t.accent),
                                    ),
                                    const SizedBox(width: 6),
                                    Expanded(
                                      child: Text(
                                        step.title,
                                        style: TextStyle(
                                            fontSize: 14.5,
                                            fontWeight: FontWeight.w800,
                                            color: t.textPrimary),
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 6),
                                Text(
                                  step.description,
                                  style: TextStyle(
                                      fontSize: 12.5,
                                      height: 1.5,
                                      color: t.textSecondary),
                                ),
                                if (step.bullets.isNotEmpty) ...[
                                  const SizedBox(height: 7),
                                  ...step.bullets.map((b) => Padding(
                                        padding:
                                            const EdgeInsets.only(bottom: 3),
                                        child: Text('• $b',
                                            style: TextStyle(
                                                fontSize: 11.8,
                                                height: 1.45,
                                                color: t.textPrimary)),
                                      )),
                                ],
                                if (isActionGated) ...[
                                  const SizedBox(height: 8),
                                  Container(
                                    padding: const EdgeInsets.symmetric(
                                        horizontal: 9, vertical: 6),
                                    decoration: BoxDecoration(
                                      color: t.accentSoft,
                                      borderRadius: BorderRadius.circular(10),
                                      border: Border.all(
                                          color:
                                              t.accent.withValues(alpha: 0.4)),
                                    ),
                                    child: Row(
                                      children: [
                                        Icon(LucideIcons.crosshair,
                                            size: 13, color: t.accent),
                                        const SizedBox(width: 6),
                                        Expanded(
                                          child: Text(
                                            '请直接点击高亮界面中的「${step.actionGate!.buttonLabel}」按钮继续',
                                            style: TextStyle(
                                                fontSize: 11.5,
                                                fontWeight: FontWeight.w700,
                                                color: t.accent),
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                ],
                              ],
                            ),
                          ),
                        ),
                        const SizedBox(height: 10),

                        // Card Footer (Prev + Next / Action-Gated Next)
                        Row(
                          children: [
                            OutlinedButton.icon(
                              onPressed: _stepIdx > 0
                                  ? () => _goToStep(_stepIdx - 1)
                                  : null,
                              icon:
                                  const Icon(LucideIcons.chevronLeft, size: 14),
                              label: const Text('上一步',
                                  style: TextStyle(fontSize: 12)),
                              style: OutlinedButton.styleFrom(
                                  visualDensity: VisualDensity.compact),
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: FilledButton(
                                onPressed: isActionGated
                                    ? null
                                    : () {
                                        if (isLastReplayStep) {
                                          c.triggerHaptic(
                                              HapticPattern.success);
                                          widget.onCloseReplay();
                                        } else {
                                          _goToStep(_stepIdx + 1);
                                        }
                                      },
                                style: FilledButton.styleFrom(
                                  backgroundColor: t.accent,
                                  foregroundColor: t.accentText,
                                  disabledBackgroundColor:
                                      t.bgSubtle.withValues(alpha: 0.7),
                                  disabledForegroundColor: t.textMuted,
                                  visualDensity: VisualDensity.compact,
                                  padding: const EdgeInsets.symmetric(
                                      horizontal: 10, vertical: 10),
                                ),
                                child: Row(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Flexible(
                                      child: Text(
                                        nextBtnLabel,
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                        style: const TextStyle(
                                            fontSize: 12,
                                            fontWeight: FontWeight.w700),
                                      ),
                                    ),
                                    if (!isActionGated) ...[
                                      const SizedBox(width: 4),
                                      const Icon(LucideIcons.chevronRight,
                                          size: 14),
                                    ],
                                  ],
                                ),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
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
