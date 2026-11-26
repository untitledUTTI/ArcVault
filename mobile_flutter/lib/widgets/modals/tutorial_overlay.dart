import 'dart:async';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:local_auth/local_auth.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:permission_handler/permission_handler.dart';

import '../../core/tutorial_flow.dart';
import '../../i18n/dictionaries.dart';
import '../../models/archive_models.dart';
import '../../state/app_controller.dart';
import '../../theme/arc_theme.dart';
import '../../theme/liquid_glass_surface.dart';
import '../arc_vault_logo.dart';

enum _FirstRunStage { welcome, permissions, cacheSetup, warning, spotlight }

class TutorialOverlay extends StatefulWidget {
  const TutorialOverlay({
    super.key,
    required this.controller,
    required this.mode,
  });

  final AppController controller;
  final TutorialMode mode;

  @override
  State<TutorialOverlay> createState() => _TutorialOverlayState();
}

class _TutorialOverlayState extends State<TutorialOverlay> {
  late _FirstRunStage _stage =
      widget.mode == TutorialMode.firstRun ? _FirstRunStage.welcome : _FirstRunStage.spotlight;

  final Set<String> _grantedPermissions = {};
  bool _cacheUseCustom = false;
  late TextEditingController _cacheCtrl;
  int _remainingSec = TutorialFlow.warningCountdownSeconds;
  Timer? _countdownTimer;
  final TextEditingController _warningConfirmCtrl = TextEditingController();

  final Set<TutorialModuleId> _selectedReplayModules = TutorialModuleId.values.toSet();
  bool _replayPicker = false;
  int _stepIdx = 0;

  @override
  void initState() {
    super.initState();
    _replayPicker = widget.mode == TutorialMode.replay;
    _cacheCtrl = TextEditingController(text: widget.controller.resolvedVaultDir);
  }

  @override
  void dispose() {
    _countdownTimer?.cancel();
    _cacheCtrl.dispose();
    _warningConfirmCtrl.dispose();
    super.dispose();
  }

  void _startWarningCountdown() {
    _countdownTimer?.cancel();
    setState(() {
      _stage = _FirstRunStage.warning;
      _remainingSec = TutorialFlow.warningCountdownSeconds;
    });
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

  @override
  Widget build(BuildContext context) {
    final t = context.arcTheme;
    final c = widget.controller;
    final s = c.settings;
    final d = ArcStrings.of(s.locale);
    final mq = MediaQuery.of(context);

    if (_stage == _FirstRunStage.spotlight && !_replayPicker) {
      return _buildSpotlightPlayer(c, t, mq);
    }

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
                      child: _replayPicker
                          ? _buildReplayPicker(c, t)
                          : switch (_stage) {
                              _FirstRunStage.welcome => _buildWelcome(c, s, d, t),
                              _FirstRunStage.permissions => _buildPermissions(c, t),
                              _FirstRunStage.cacheSetup => _buildCacheSetup(c, t),
                              _FirstRunStage.warning => _buildWarning(c, t),
                              _FirstRunStage.spotlight => const SizedBox.shrink(),
                            },
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

  Widget _buildWelcome(AppController c, AppSettingsModel s, ArcStrings d, ArcThemeTokens t) {
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
                  Text(d.welcomeBadge, style: TextStyle(fontSize: 11, color: t.accent, fontWeight: FontWeight.w700)),
                  Text(d.welcomeTitle, style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: t.textPrimary)),
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
        Text(d.welcomeSubtitle, style: TextStyle(fontSize: 13, color: t.textSecondary)),
        const SizedBox(height: 14),
        Text(d.welcomeHintTouch, style: TextStyle(fontSize: 12, color: t.textMuted)),
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
                  color: active ? t.accentSoft : t.bgSubtle.withValues(alpha: 0.55),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: active ? t.accent : t.borderSubtle),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    if (id == MobileThemeId.liquidGlass) ...[
                      LiquidGlassThemePreviewSwatch(width: 24, height: 18, isDark: s.liquidGlass.isDark),
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
                    Text(h.title, style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: t.textPrimary)),
                    const SizedBox(height: 2),
                    Text(h.desc, style: TextStyle(fontSize: 11.5, color: t.textSecondary)),
                  ],
                ),
              ),
            )),
        const SizedBox(height: 8),
        Text(d.tutorialHint, style: TextStyle(fontSize: 12, color: t.textMuted)),
        const SizedBox(height: 14),
        SizedBox(
          width: double.infinity,
          child: FilledButton.icon(
            onPressed: c.isReady
                ? () {
                    c.triggerHaptic(HapticPattern.medium);
                    setState(() {
                      _stage = Platform.isAndroid ? _FirstRunStage.permissions : _FirstRunStage.cacheSetup;
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
    final allGranted = TutorialFlow.areAllPermissionsGranted(_grantedPermissions);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('移动端必要权限授权',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: t.textPrimary)),
        const SizedBox(height: 6),
        Text('为保障本地文档读写、拍照扫描、局域网同步与保险箱解锁正常使用，请逐项授予权限：',
            style: TextStyle(fontSize: 12.5, color: t.textSecondary)),
        const SizedBox(height: 14),
        ...TutorialFlow.mobilePermissionCards.map((card) {
          final granted = _grantedPermissions.contains(card.id);
          return Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: ArcFrostedCardSurface(
              isActive: granted,
              padding: const EdgeInsets.all(12),
              child: Row(
                children: [
                  Icon(
                    granted ? LucideIcons.checkCircle2 : LucideIcons.shield,
                    size: 20,
                    color: granted ? Colors.green : t.accent,
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Text(card.title,
                                style: TextStyle(
                                    fontWeight: FontWeight.w700, fontSize: 13, color: t.textPrimary)),
                            if (card.required)
                              Padding(
                                padding: const EdgeInsets.only(left: 6),
                                child: Text('必需', style: TextStyle(fontSize: 10.5, color: t.revisionColor)),
                              ),
                          ],
                        ),
                        const SizedBox(height: 2),
                        Text(card.description, style: TextStyle(fontSize: 11.5, color: t.textSecondary)),
                      ],
                    ),
                  ),
                  const SizedBox(width: 8),
                  OutlinedButton(
                    onPressed: granted ? null : () => _requestPermission(card),
                    child: Text(granted ? '已授权' : card.actionLabel, style: const TextStyle(fontSize: 11.5)),
                  ),
                ],
              ),
            ),
          );
        }),
        const SizedBox(height: 10),
        Row(
          children: [
            TextButton(
              onPressed: () async {
                final proceed = await showDialog<bool>(
                  context: context,
                  builder: (ctx) => AlertDialog(
                    title: const Text('确认忽略未授权权限？'),
                    content: const Text('部分权限尚未授予，可能导致自定义缓存目录读写、相机扫描或生物识别解锁不可用。确定继续吗？'),
                    actions: [
                      TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('返回授权')),
                      FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('忽略并继续')),
                    ],
                  ),
                );
                if (proceed == true && mounted) {
                  setState(() => _stage = _FirstRunStage.cacheSetup);
                }
              },
              child: const Text('忽略并继续'),
            ),
            const Spacer(),
            FilledButton(
              onPressed: allGranted ? () => setState(() => _stage = _FirstRunStage.cacheSetup) : null,
              style: FilledButton.styleFrom(backgroundColor: t.accent, foregroundColor: t.accentText),
              child: const Text('下一步：设置缓存目录'),
            ),
          ],
        ),
      ],
    );
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
      setState(() => _grantedPermissions.add(card.id));
    }
  }

  Widget _buildCacheSetup(AppController c, ArcThemeTokens t) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('首次启动必选：设置本地缓存与档案目录',
            style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800, color: t.textPrimary)),
        const SizedBox(height: 6),
        Text('请确认本地 CAS 去重快照、索引与自动备份的存放目录：',
            style: TextStyle(fontSize: 12.5, color: t.textSecondary)),
        const SizedBox(height: 12),
        RadioListTile<bool>(
          value: false,
          groupValue: _cacheUseCustom,
          onChanged: (v) => setState(() => _cacheUseCustom = false),
          title: const Text('使用默认安全沙盒目录'),
          subtitle: Text(c.resolvedVaultDir, style: TextStyle(fontSize: 11.5, color: t.textMuted)),
        ),
        RadioListTile<bool>(
          value: true,
          groupValue: _cacheUseCustom,
          onChanged: (v) => setState(() => _cacheUseCustom = true),
          title: const Text('自定义缓存目录路径'),
        ),
        if (_cacheUseCustom) ...[
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _cacheCtrl,
                  decoration: InputDecoration(
                    isDense: true,
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              OutlinedButton(
                onPressed: () async {
                  await c.pickCustomDirectory(forBackup: false);
                  setState(() => _cacheCtrl.text = c.resolvedVaultDir);
                },
                child: const Text('选择目录'),
              ),
            ],
          ),
        ],
        const SizedBox(height: 14),
        SizedBox(
          width: double.infinity,
          child: FilledButton(
            onPressed: () async {
              if (_cacheUseCustom && _cacheCtrl.text.trim().isNotEmpty) {
                await c.setCustomDirectories(vaultDir: _cacheCtrl.text.trim());
              }
              _startWarningCountdown();
            },
            style: FilledButton.styleFrom(backgroundColor: t.accent, foregroundColor: t.accentText),
            child: const Text('应用并继续'),
          ),
        ),
      ],
    );
  }

  Widget _buildWarning(AppController c, ArcThemeTokens t) {
    final canProceed = TutorialFlow.canConfirmWarning(
      remainingSeconds: _remainingSec,
      input: _warningConfirmCtrl.text,
    );
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Icon(LucideIcons.alertTriangle, size: 22, color: t.revisionColor),
            const SizedBox(width: 8),
            Expanded(
              child: Text('使用前重要安全与消费提示',
                  style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800, color: t.textPrimary)),
            ),
          ],
        ),
        const SizedBox(height: 12),
        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: t.revisionColor.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: t.revisionColor.withValues(alpha: 0.35)),
          ),
          child: Text(
            TutorialFlow.warningText,
            style: TextStyle(fontSize: 13.5, height: 1.55, color: t.textPrimary, fontWeight: FontWeight.w500),
          ),
        ),
        const SizedBox(height: 14),
        Text(
          _remainingSec > 0
              ? '请仔细阅读以上提示（倒计时 $_remainingSec 秒后可输入确认）'
              : '请在下方输入「${TutorialFlow.confirmPhrase}」以解锁进入互动教程：',
          style: TextStyle(fontSize: 12.5, color: t.textSecondary, fontWeight: FontWeight.w600),
        ),
        const SizedBox(height: 8),
        TextField(
          controller: _warningConfirmCtrl,
          enabled: _remainingSec <= 0,
          onChanged: (_) => setState(() {}),
          decoration: InputDecoration(
            hintText: TutorialFlow.confirmPhrase,
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
          ),
        ),
        const SizedBox(height: 14),
        SizedBox(
          width: double.infinity,
          child: FilledButton(
            onPressed: canProceed ? () => setState(() => _stage = _FirstRunStage.spotlight) : null,
            style: FilledButton.styleFrom(backgroundColor: t.accent, foregroundColor: t.accentText),
            child: Text(_remainingSec > 0 ? '请等待 $_remainingSec 秒...' : '进入实景教程'),
          ),
        ),
      ],
    );
  }

  Widget _buildReplayPicker(AppController c, ArcThemeTokens t) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('重播互动使用教程（支持自选板块）',
            style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800, color: t.textPrimary)),
        const SizedBox(height: 8),
        ...TutorialModuleId.values.map((m) => CheckboxListTile(
              dense: true,
              value: _selectedReplayModules.contains(m),
              onChanged: (v) {
                setState(() {
                  if (v == true) {
                    _selectedReplayModules.add(m);
                  } else if (_selectedReplayModules.length > 1) {
                    _selectedReplayModules.remove(m);
                  }
                });
              },
              title: Text(m.title, style: TextStyle(fontSize: 13, color: t.textPrimary)),
              subtitle: Text(m.badge, style: TextStyle(fontSize: 11, color: t.textMuted)),
            )),
        const SizedBox(height: 10),
        Row(
          mainAxisAlignment: MainAxisAlignment.end,
          children: [
            TextButton(onPressed: c.closeTutorialReplay, child: const Text('取消')),
            const SizedBox(width: 8),
            FilledButton(
              onPressed: () => setState(() {
                _replayPicker = false;
                _stepIdx = 0;
              }),
              style: FilledButton.styleFrom(backgroundColor: t.accent, foregroundColor: t.accentText),
              child: const Text('开始重播'),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildSpotlightPlayer(AppController c, ArcThemeTokens t, MediaQueryData mq) {
    final steps = TutorialFlow.buildSteps(
      selectedModules: widget.mode == TutorialMode.replay ? _selectedReplayModules : null,
    );
    final step = steps[_stepIdx.clamp(0, steps.length - 1)];
    final isLast = _stepIdx >= steps.length - 1;

    return Positioned.fill(
      child: Material(
        color: Colors.black.withValues(alpha: 0.48),
        child: SafeArea(
          child: Align(
            alignment: Alignment.bottomCenter,
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 540),
                child: ArcLiquidGlassSurface(
                  liquidGlassSettings: c.settings.liquidGlass,
                  borderRadius: 22,
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                            decoration: BoxDecoration(
                              color: t.accentSoft,
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Text(
                              '${step.moduleId.shortTitle} · ${_stepIdx + 1}/${steps.length}',
                              style: TextStyle(
                                  fontSize: 11, fontWeight: FontWeight.w700, color: t.accent),
                            ),
                          ),
                          const Spacer(),
                          TextButton(
                            onPressed: () {
                              if (widget.mode == TutorialMode.firstRun) {
                                c.completeTutorial();
                              } else {
                                c.closeTutorialReplay();
                              }
                            },
                            child: const Text('跳过教程'),
                          ),
                        ],
                      ),
                      const SizedBox(height: 6),
                      Text(step.title,
                          style: TextStyle(
                              fontSize: 15.5, fontWeight: FontWeight.w800, color: t.textPrimary)),
                      const SizedBox(height: 6),
                      Text(step.description,
                          style: TextStyle(fontSize: 13, height: 1.5, color: t.textSecondary)),
                      if (step.bullets.isNotEmpty) ...[
                        const SizedBox(height: 8),
                        ...step.bullets.map((b) => Padding(
                              padding: const EdgeInsets.only(bottom: 3),
                              child: Text('• $b',
                                  style: TextStyle(fontSize: 12, color: t.textPrimary)),
                            )),
                      ],
                      const SizedBox(height: 12),
                      Row(
                        children: [
                          if (_stepIdx > 0)
                            OutlinedButton(
                              onPressed: () => setState(() => _stepIdx--),
                              child: const Text('上一步'),
                            ),
                          const Spacer(),
                          FilledButton(
                            onPressed: () {
                              if (isLast) {
                                if (widget.mode == TutorialMode.firstRun) {
                                  c.completeTutorial();
                                } else {
                                  c.closeTutorialReplay();
                                }
                              } else {
                                setState(() => _stepIdx++);
                              }
                            },
                            style: FilledButton.styleFrom(
                                backgroundColor: t.accent, foregroundColor: t.accentText),
                            child: Text(isLast ? '完成并开始使用' : '下一步'),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
