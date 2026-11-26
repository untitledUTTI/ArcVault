import 'package:flutter/material.dart';
import 'package:local_auth/local_auth.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../../core/tutorial_flow.dart';
import '../../state/app_controller.dart';
import '../../theme/arc_theme.dart';
import '../../theme/liquid_glass_surface.dart';

class VaultLockModal extends StatefulWidget {
  const VaultLockModal({super.key, required this.controller, this.onClose});
  final AppController controller;
  final VoidCallback? onClose;

  @override
  State<VaultLockModal> createState() => _VaultLockModalState();
}

class _VaultLockModalState extends State<VaultLockModal> {
  final TextEditingController _passCtrl = TextEditingController();
  String? _error;

  @override
  void dispose() {
    _passCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final t = context.arcTheme;
    final c = widget.controller;
    final isZh = c.settings.locale.isZh;
    final unlocked = c.vaultUnlocked;

    return ArcLiquidGlassSurface(
      key: c.tourTargets.keyFor(TutorialTargetId.vaultLockModal),
      liquidGlassSettings: c.settings.liquidGlass,
      borderRadius: 24,
      padding: const EdgeInsets.all(18),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(unlocked ? LucideIcons.unlock : LucideIcons.lock, size: 18, color: t.accent),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  isZh ? '档案保险箱 · PBKDF2 + AES-256-GCM' : 'Private Vault · AES-256-GCM',
                  style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15, color: t.textPrimary),
                ),
              ),
              IconButton(
                  onPressed: () => (widget.onClose ?? () => Navigator.of(context).pop())(),
                  icon: const Icon(LucideIcons.x, size: 18)),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            unlocked
                ? (isZh ? '当前保险箱处于已解锁状态，可设置主密码进行 AES-256-GCM 密文封锁。' : 'Vault is unlocked. Enter passcode to lock.')
                : (isZh ? '保险箱已上锁，请输入主密码或使用生物识别解锁。' : 'Vault is locked. Enter passcode or use biometrics.'),
            style: TextStyle(fontSize: 12.5, color: t.textSecondary),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _passCtrl,
            obscureText: true,
            decoration: InputDecoration(
              isDense: true,
              labelText: isZh ? '保险箱主密码' : 'Vault Passcode',
              errorText: _error,
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
            ),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              if (!unlocked)
                OutlinedButton.icon(
                  onPressed: () async {
                    try {
                      final auth = LocalAuthentication();
                      final ok = await auth.authenticate(
                        localizedReason: isZh ? '验证指纹或面容以解锁档案保险箱' : 'Authenticate to unlock Private Vault',
                      );
                      if (ok && context.mounted) {
                        await c.unlockVaultByBiometrics();
                        if (context.mounted) {
                          (widget.onClose ?? () => Navigator.of(context).pop())();
                        }
                      }
                    } catch (_) {
                      setState(() => _error = isZh ? '生物识别不可用，请使用主密码' : 'Biometric unavailable');
                    }
                  },
                  icon: const Icon(LucideIcons.fingerprint, size: 15),
                  label: Text(isZh ? '生物识别' : 'Biometric'),
                ),
              const Spacer(),
              FilledButton(
                onPressed: () async {
                  final pass = _passCtrl.text;
                  if (unlocked) {
                    await c.lockVaultWithPasscode(pass);
                    if (context.mounted) {
                      (widget.onClose ?? () => Navigator.of(context).pop())();
                    }
                  } else {
                    final ok = await c.unlockVaultWithPasscode(pass);
                    if (ok && context.mounted) {
                      (widget.onClose ?? () => Navigator.of(context).pop())();
                    } else {
                      setState(() => _error = isZh ? '密码错误' : 'Invalid passcode');
                    }
                  }
                },
                style: FilledButton.styleFrom(backgroundColor: t.accent, foregroundColor: t.accentText),
                child: Text(unlocked ? (isZh ? '加密上锁' : 'Encrypt & Lock') : (isZh ? '解密解锁' : 'Unlock')),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
