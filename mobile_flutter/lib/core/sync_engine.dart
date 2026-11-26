import 'dart:convert';
import 'dart:io';

import 'package:http/http.dart' as http;
import 'package:uuid/uuid.dart';

import '../models/archive_models.dart';
import 'ooxml_engine.dart';
import 'vault_crypto.dart';

class SyncReconcileResult {
  const SyncReconcileResult({
    required this.added,
    required this.updated,
    required this.conflicts,
    required this.unchangedCount,
  });

  final List<ArchiveDocument> added;
  final List<ArchiveDocument> updated;
  final List<SyncConflictItem> conflicts;
  final int unchangedCount;
}

class SyncEncryptedEnvelope {
  const SyncEncryptedEnvelope({
    this.version = 1,
    required this.deviceId,
    required this.deviceName,
    required this.hlc,
    required this.createdAt,
    required this.docCount,
    required this.encryptedPayload,
  });

  final int version;
  final String deviceId;
  final String deviceName;
  final HlcTimestamp hlc;
  final String createdAt;
  final int docCount;
  final String encryptedPayload;

  Map<String, dynamic> toJson() => {
        'v': version,
        'deviceId': deviceId,
        'deviceName': deviceName,
        'hlc': hlc.toJson(),
        'createdAt': createdAt,
        'docCount': docCount,
        'encryptedPayload': encryptedPayload,
      };

  factory SyncEncryptedEnvelope.fromJson(Map<String, dynamic> json) => SyncEncryptedEnvelope(
        version: (json['v'] as num?)?.toInt() ?? 1,
        deviceId: json['deviceId']?.toString() ?? '',
        deviceName: json['deviceName']?.toString() ?? 'Peer Device',
        hlc: HlcTimestamp.fromJson(Map<String, dynamic>.from(json['hlc'] as Map)),
        createdAt: json['createdAt']?.toString() ?? '',
        docCount: (json['docCount'] as num?)?.toInt() ?? 0,
        encryptedPayload: json['encryptedPayload']?.toString() ?? '',
      );
}

class SyncEngine {
  SyncEngine._();

  static HlcTimestamp createHlc(String nodeId) => HlcTimestamp(
        wallMs: DateTime.now().millisecondsSinceEpoch,
        logical: 0,
        nodeId: nodeId,
      );

  static HlcTimestamp tickHlc(HlcTimestamp prev, {HlcTimestamp? remote}) {
    final nowMs = DateTime.now().millisecondsSinceEpoch;
    final maxWall = [
      nowMs,
      prev.wallMs,
      if (remote != null) remote.wallMs,
    ].reduce((a, b) => a > b ? a : b);

    var logical = 0;
    if (maxWall == prev.wallMs && remote != null && maxWall == remote.wallMs) {
      logical = (prev.logical > remote.logical ? prev.logical : remote.logical) + 1;
    } else if (maxWall == prev.wallMs) {
      logical = prev.logical + 1;
    } else if (remote != null && maxWall == remote.wallMs) {
      logical = remote.logical + 1;
    }
    return HlcTimestamp(wallMs: maxWall, logical: logical, nodeId: prev.nodeId);
  }

  static int compareHlc(HlcTimestamp a, HlcTimestamp b) {
    if (a.wallMs != b.wallMs) return a.wallMs.compareTo(b.wallMs);
    if (a.logical != b.logical) return a.logical.compareTo(b.logical);
    return a.nodeId.compareTo(b.nodeId);
  }

  static String buildLanPairingUri({
    required String ip,
    required int port,
    required String pin,
    required String deviceId,
    required String deviceName,
  }) {
    return Uri(
      scheme: 'arcvault',
      host: 'pair',
      queryParameters: {
        'host': ip,
        'port': '$port',
        'pin': pin,
        'id': deviceId,
        'name': deviceName,
      },
    ).toString();
  }

  static ({String peerUrl, String pin, String? deviceName})? parseLanPairingUri(String raw) {
    final trimmed = raw.trim();
    if (!trimmed.startsWith('arcvault://pair')) return null;
    try {
      final uri = Uri.parse(trimmed);
      final host = uri.queryParameters['host'];
      if (host == null || host.isEmpty) return null;
      final port = uri.queryParameters['port'] ?? '47820';
      final pin = uri.queryParameters['pin'] ?? '';
      final name = uri.queryParameters['name'];
      return (peerUrl: 'http://$host:$port', pin: pin, deviceName: name);
    } catch (_) {
      return null;
    }
  }

  static Future<SyncEncryptedEnvelope> buildEncryptedEnvelope(
    List<ArchiveDocument> docs,
    SyncSettingsModel settings,
    HlcTimestamp hlc,
  ) async {
    if (settings.e2eePassphrase.trim().isEmpty) {
      throw ArgumentError('请先设置跨端 E2EE 同步口令（用于加密离端内容块）');
    }
    final payloadDocs = docs
        .map((d) => {
              'id': d.id,
              'spaceId': d.spaceId,
              'title': d.title,
              'sourceExt': d.sourceExt,
              'sourceFileName': d.sourceFileName,
              'backupFormat': d.backupFormat.wire,
              'activeFormat': d.activeFormat.wire,
              'markdownText': d.markdownText,
              'latexText': d.latexText,
              'isSealed': d.isSealed,
              if (d.sealedHash != null) 'sealedHash': d.sealedHash,
              if (d.sealedAt != null) 'sealedAt': d.sealedAt,
              'updatedAt': d.updatedAt,
              'createdAt': d.createdAt,
              'currentBranchId': d.currentBranchId,
              'tags': d.tags,
              'contentHash': VaultCrypto.sha256Hex(d.markdownText),
            })
        .toList();

    final encrypted = await VaultCrypto.encryptVaultText(
      jsonEncode(payloadDocs),
      settings.e2eePassphrase,
    );

    return SyncEncryptedEnvelope(
      deviceId: settings.deviceId,
      deviceName: settings.deviceName,
      hlc: hlc,
      createdAt: DateTime.now().toIso8601String(),
      docCount: payloadDocs.length,
      encryptedPayload: encrypted,
    );
  }

  static Future<List<ArchiveDocument>> decryptEnvelope(
    SyncEncryptedEnvelope envelope,
    String passphrase,
  ) async {
    if (passphrase.trim().isEmpty) {
      throw ArgumentError('请输入跨端 E2EE 同步口令进行解密');
    }
    final plainJson = await VaultCrypto.decryptVaultText(envelope.encryptedPayload, passphrase);
    final rawList = jsonDecode(plainJson) as List<dynamic>;
    return rawList.map((e) {
      final m = Map<String, dynamic>.from(e as Map);
      final id = m['id'].toString();
      final md = m['markdownText']?.toString() ?? '';
      final tex = m['latexText']?.toString() ?? '';
      return ArchiveDocument(
        id: id,
        spaceId: m['spaceId']?.toString() ?? 'sp_paper',
        title: m['title']?.toString() ?? 'Untitled',
        sourceExt: m['sourceExt']?.toString() ?? '.md',
        sourceFileName: m['sourceFileName']?.toString() ?? 'untitled.md',
        backupFormat: BackupFormat.fromWire(m['backupFormat'] as String?),
        activeFormat: EditorFormat.fromWire(m['activeFormat'] as String?),
        markdownText: md,
        latexText: tex.isNotEmpty
            ? tex
            : OoxmlEngine.syncFormatText(md, EditorFormat.markdown, EditorFormat.latex),
        coverRule: CoverRule(
          documentId: id,
          coverEndBlockIndex: 0,
          remember: false,
          coverBlockCount: 0,
        ),
        isSealed: m['isSealed'] == true,
        sealedHash: m['sealedHash'] as String?,
        sealedAt: m['sealedAt'] as String?,
        updatedAt: m['updatedAt']?.toString() ?? DateTime.now().toIso8601String(),
        createdAt: m['createdAt']?.toString() ?? DateTime.now().toIso8601String(),
        currentBranchId: m['currentBranchId']?.toString() ?? 'branch_main',
        tags: (m['tags'] as List<dynamic>?)?.map((t) => t.toString()).toList() ?? const [],
      );
    }).toList();
  }

  static SyncReconcileResult reconcileDocuments({
    required List<ArchiveDocument> localDocs,
    required List<ArchiveDocument> remoteDocs,
    required String remoteDeviceName,
  }) {
    final localById = {for (final d in localDocs) d.id: d};
    final added = <ArchiveDocument>[];
    final updated = <ArchiveDocument>[];
    final conflicts = <SyncConflictItem>[];
    var unchanged = 0;

    for (final remote in remoteDocs) {
      final local = localById[remote.id];
      if (local == null) {
        added.add(remote);
        continue;
      }
      if (local.markdownText == remote.markdownText) {
        unchanged++;
        continue;
      }
      final localTime = DateTime.tryParse(local.updatedAt)?.millisecondsSinceEpoch ?? 0;
      final remoteTime = DateTime.tryParse(remote.updatedAt)?.millisecondsSinceEpoch ?? 0;
      if ((localTime - remoteTime).abs() < 60000) {
        conflicts.add(SyncConflictItem(
          id: 'conflict_${const Uuid().v4().substring(0, 8)}',
          docId: local.id,
          title: local.title,
          localText: local.markdownText,
          remoteText: remote.markdownText,
          baseText: '',
          localUpdatedAt: local.updatedAt,
          remoteUpdatedAt: remote.updatedAt,
          remoteDeviceName: remoteDeviceName,
          remoteDoc: remote,
        ));
      } else if (remoteTime > localTime) {
        updated.add(remote.copyWith(annotations: local.annotations));
      } else {
        unchanged++;
      }
    }

    return SyncReconcileResult(
      added: added,
      updated: updated,
      conflicts: conflicts,
      unchangedCount: unchanged,
    );
  }

  static Future<String> resolveLocalLanIp() async {
    try {
      final ifaces = await NetworkInterface.list(type: InternetAddressType.IPv4);
      for (final iface in ifaces) {
        for (final addr in iface.addresses) {
          if (!addr.isLoopback &&
              (addr.address.startsWith('192.168.') ||
                  addr.address.startsWith('10.') ||
                  addr.address.startsWith('172.'))) {
            return addr.address;
          }
        }
      }
    } catch (_) {}
    return '127.0.0.1';
  }

  static Future<void> pushToLanPeer(
    SyncSettingsModel settings,
    SyncEncryptedEnvelope envelope,
  ) async {
    final base = settings.lanPeerUrl.trim().replaceAll(RegExp(r'/+$'), '');
    if (base.isEmpty) throw ArgumentError('请填写对端设备局域网地址或扫码配对');
    final resp = await http
        .post(
          Uri.parse('$base/arcvault/sync'),
          headers: {
            'Content-Type': 'application/json',
            'X-ArcVault-Pin': settings.lanPin,
          },
          body: jsonEncode(envelope.toJson()),
        )
        .timeout(const Duration(seconds: 10));
    if (resp.statusCode < 200 || resp.statusCode >= 300) {
      throw Exception('局域网推送失败 (HTTP ${resp.statusCode})');
    }
  }

  static Future<SyncEncryptedEnvelope?> pullFromLanPeer(SyncSettingsModel settings) async {
    final base = settings.lanPeerUrl.trim().replaceAll(RegExp(r'/+$'), '');
    if (base.isEmpty) throw ArgumentError('请填写对端设备局域网地址或扫码配对');
    final resp = await http
        .get(
          Uri.parse('$base/arcvault/sync'),
          headers: {'X-ArcVault-Pin': settings.lanPin},
        )
        .timeout(const Duration(seconds: 10));
    if (resp.statusCode == 404) return null;
    if (resp.statusCode < 200 || resp.statusCode >= 300) {
      throw Exception('局域网拉取失败 (HTTP ${resp.statusCode})');
    }
    return SyncEncryptedEnvelope.fromJson(jsonDecode(resp.body) as Map<String, dynamic>);
  }

  static Future<void> pushToWebdav(
    SyncSettingsModel settings,
    SyncEncryptedEnvelope envelope,
  ) async {
    final url = _buildWebdavFileUri(settings);
    final auth = 'Basic ${base64Encode(utf8.encode('${settings.webdavUsername}:${settings.webdavPassword}'))}';
    final resp = await http
        .put(
          url,
          headers: {
            'Authorization': auth,
            'Content-Type': 'application/json',
          },
          body: jsonEncode(envelope.toJson()),
        )
        .timeout(const Duration(seconds: 20));
    if (resp.statusCode < 200 || resp.statusCode >= 300) {
      throw Exception('WebDAV 上传失败 (HTTP ${resp.statusCode})');
    }
  }

  static Future<SyncEncryptedEnvelope?> pullFromWebdav(SyncSettingsModel settings) async {
    final url = _buildWebdavFileUri(settings);
    final auth = 'Basic ${base64Encode(utf8.encode('${settings.webdavUsername}:${settings.webdavPassword}'))}';
    final resp = await http
        .get(url, headers: {'Authorization': auth})
        .timeout(const Duration(seconds: 20));
    if (resp.statusCode == 404) return null;
    if (resp.statusCode < 200 || resp.statusCode >= 300) {
      throw Exception('WebDAV 拉取失败 (HTTP ${resp.statusCode})');
    }
    return SyncEncryptedEnvelope.fromJson(jsonDecode(resp.body) as Map<String, dynamic>);
  }

  static Uri _buildWebdavFileUri(SyncSettingsModel settings) {
    final base = settings.webdavUrl.trim().replaceAll(RegExp(r'/+$'), '');
    if (base.isEmpty) throw ArgumentError('请填写 WebDAV 服务器地址');
    final path = settings.webdavBasePath.trim().replaceAll(RegExp(r'^/+|/+$'), '');
    return Uri.parse('$base/$path/arcvault_sync_latest.json');
  }
}
