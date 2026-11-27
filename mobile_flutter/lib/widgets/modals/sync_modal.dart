import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:qr_flutter/qr_flutter.dart';
import '../../core/sync_engine.dart';
import '../../core/tutorial_flow.dart';
import '../../models/archive_models.dart';
import '../../state/app_controller.dart';
import '../../theme/arc_theme.dart';

class SyncModal extends StatefulWidget {
  const SyncModal({super.key, required this.controller, this.onClose});
  final AppController controller;
  final VoidCallback? onClose;

  @override
  State<SyncModal> createState() => _SyncModalState();
}

class _SyncModalState extends State<SyncModal> {
  String _lanIp = '192.168.1.100';
  bool _scanningQr = false;
  bool _busy = false;
  String? _status;

  @override
  void initState() {
    super.initState();
    SyncEngine.resolveLocalLanIp().then((ip) {
      if (mounted) setState(() => _lanIp = ip);
    });
  }

  @override
  Widget build(BuildContext context) {
    final t = context.arcTheme;
    final c = widget.controller;
    final s = c.settings;
    final sync = s.sync;
    final isZh = s.locale.isZh;

    final pairUri = SyncEngine.buildLanPairingUri(
      ip: _lanIp,
      port: sync.lanPort,
      pin: sync.lanPin,
      deviceId: sync.deviceId,
      deviceName: sync.deviceName,
    );

    return ArcSurface(
      key: c.tourTargets.keyFor(TutorialTargetId.syncModal),
      borderRadius: 24,
      child: SizedBox(
        height: MediaQuery.sizeOf(context).height * 0.82,
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 10, 6),
              child: Row(
                children: [
                  Icon(LucideIcons.wifi, size: 18, color: t.accent),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(isZh ? '多端 E2EE 加密同步中心' : 'E2EE Cross-Device Sync',
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
                  TextFormField(
                    initialValue: sync.e2eePassphrase,
                    obscureText: true,
                    onChanged: (v) => c.updateSettings(s.copyWith(sync: sync.copyWith(e2eePassphrase: v))),
                    decoration: InputDecoration(
                      isDense: true,
                      labelText: isZh ? '跨端 E2EE 加密口令（离端前 AES-256-GCM 加密）' : 'E2EE Passphrase',
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                    ),
                  ),
                  const SizedBox(height: 10),
                  Wrap(
                    spacing: 8,
                    children: [
                      for (final mode in SyncMode.values)
                        ChoiceChip(
                          label: Text(mode.wire.toUpperCase()),
                          selected: sync.mode == mode,
                          onSelected: (_) => c.updateSettings(s.copyWith(sync: sync.copyWith(mode: mode))),
                        ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  if (sync.mode == SyncMode.lan) ...[
                    ArcCardSurface(
                      padding: const EdgeInsets.all(12),
                      child: Column(
                        children: [
                          if (_scanningQr)
                            SizedBox(
                              height: 200,
                              child: ClipRRect(
                                borderRadius: BorderRadius.circular(12),
                                child: MobileScanner(
                                  onDetect: (capture) {
                                    final raw = capture.barcodes.firstOrNull?.rawValue;
                                    if (raw == null) return;
                                    final parsed = SyncEngine.parseLanPairingUri(raw);
                                    if (parsed != null) {
                                      c.updateSettings(s.copyWith(
                                        sync: sync.copyWith(
                                          lanPeerUrl: parsed.peerUrl,
                                          lanPin: parsed.pin,
                                        ),
                                      ));
                                      setState(() {
                                        _scanningQr = false;
                                        _status = '已配对对端：${parsed.peerUrl}';
                                      });
                                    }
                                  },
                                ),
                              ),
                            )
                          else
                            Center(
                              child: Container(
                                color: Colors.white,
                                padding: const EdgeInsets.all(8),
                                child: QrImageView(data: pairUri, size: 132),
                              ),
                            ),
                          const SizedBox(height: 8),
                          Text('本机配对 URI: $pairUri', style: TextStyle(fontSize: 11, color: t.textMuted)),
                          const SizedBox(height: 8),
                          Row(
                            children: [
                              Expanded(
                                child: TextFormField(
                                  initialValue: sync.lanPeerUrl,
                                  onChanged: (v) =>
                                      c.updateSettings(s.copyWith(sync: sync.copyWith(lanPeerUrl: v))),
                                  decoration: InputDecoration(
                                    isDense: true,
                                    labelText: isZh ? '对端局域网 URL' : 'Peer URL',
                                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                                  ),
                                ),
                              ),
                              const SizedBox(width: 8),
                              OutlinedButton.icon(
                                onPressed: () => setState(() => _scanningQr = !_scanningQr),
                                icon: const Icon(LucideIcons.scanLine, size: 15),
                                label: Text(_scanningQr ? '关闭' : '扫码配对'),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ] else if (sync.mode == SyncMode.webdav) ...[
                    TextFormField(
                      initialValue: sync.webdavUrl,
                      onChanged: (v) => c.updateSettings(s.copyWith(sync: sync.copyWith(webdavUrl: v))),
                      decoration: InputDecoration(
                        isDense: true,
                        labelText: 'WebDAV URL (坚果云 / Alist / Nextcloud)',
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                      ),
                    ),
                    const SizedBox(height: 8),
                    TextFormField(
                      initialValue: sync.webdavUsername,
                      onChanged: (v) => c.updateSettings(s.copyWith(sync: sync.copyWith(webdavUsername: v))),
                      decoration: InputDecoration(
                        isDense: true,
                        labelText: 'Username',
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                      ),
                    ),
                    const SizedBox(height: 8),
                    TextFormField(
                      initialValue: sync.webdavPassword,
                      obscureText: true,
                      onChanged: (v) => c.updateSettings(s.copyWith(sync: sync.copyWith(webdavPassword: v))),
                      decoration: InputDecoration(
                        isDense: true,
                        labelText: 'Password / App Token',
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                      ),
                    ),
                  ] else ...[
                    TextFormField(
                      initialValue: sync.s3Endpoint,
                      onChanged: (v) => c.updateSettings(s.copyWith(sync: sync.copyWith(s3Endpoint: v))),
                      decoration: InputDecoration(
                        isDense: true,
                        labelText: 'S3 Endpoint (R2 / OSS / MinIO)',
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                      ),
                    ),
                    const SizedBox(height: 8),
                    TextFormField(
                      initialValue: sync.s3Bucket,
                      onChanged: (v) => c.updateSettings(s.copyWith(sync: sync.copyWith(s3Bucket: v))),
                      decoration: InputDecoration(
                        isDense: true,
                        labelText: 'Bucket',
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                      ),
                    ),
                  ],
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: FilledButton.icon(
                          onPressed: _busy ? null : () => _push(c),
                          icon: const Icon(LucideIcons.upload, size: 15),
                          label: Text(isZh ? '加密推送' : 'Push E2EE'),
                          style: FilledButton.styleFrom(backgroundColor: t.accent, foregroundColor: t.accentText),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: OutlinedButton.icon(
                          onPressed: _busy ? null : () => _pull(c),
                          icon: const Icon(LucideIcons.download, size: 15),
                          label: Text(isZh ? '拉取合并' : 'Pull & Merge'),
                        ),
                      ),
                    ],
                  ),
                  if (_status != null) ...[
                    const SizedBox(height: 10),
                    Text(_status!, style: TextStyle(fontSize: 12.5, color: t.accent)),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _push(AppController c) async {
    setState(() => _busy = true);
    try {
      final hlc = SyncEngine.createHlc(c.settings.sync.deviceId);
      final env = await SyncEngine.buildEncryptedEnvelope(c.allDocuments, c.settings.sync, hlc);
      if (c.settings.sync.mode == SyncMode.lan) {
        await SyncEngine.pushToLanPeer(c.settings.sync, env);
      } else if (c.settings.sync.mode == SyncMode.webdav) {
        await SyncEngine.pushToWebdav(c.settings.sync, env);
      }
      setState(() => _status = '已成功推送 ${env.docCount} 份加密文档！');
    } catch (e) {
      setState(() => _status = '推送失败：$e');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _pull(AppController c) async {
    setState(() => _busy = true);
    try {
      SyncEncryptedEnvelope? env;
      if (c.settings.sync.mode == SyncMode.lan) {
        env = await SyncEngine.pullFromLanPeer(c.settings.sync);
      } else if (c.settings.sync.mode == SyncMode.webdav) {
        env = await SyncEngine.pullFromWebdav(c.settings.sync);
      }
      if (env == null) {
        setState(() => _status = '远端暂无同步包');
        return;
      }
      final docs = await SyncEngine.decryptEnvelope(env, c.settings.sync.e2eePassphrase);
      final res = SyncEngine.reconcileDocuments(
        localDocs: c.allDocuments,
        remoteDocs: docs,
        remoteDeviceName: env.deviceName,
      );
      setState(() => _status =
          '解密成功：新增 ${res.added.length}、更新 ${res.updated.length}、冲突 ${res.conflicts.length}');
    } catch (e) {
      setState(() => _status = '拉取失败：$e');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }
}
